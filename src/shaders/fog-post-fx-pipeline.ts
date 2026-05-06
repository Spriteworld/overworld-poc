/**
 * Fog weather effect. Two scrolling samples of a tileable cloud texture in
 * world space, drifted with a slight horizontal bias (wind feel), combined
 * to a smooth density field, then mixed toward a fog colour.
 *
 * Textured rather than procedural — the artist-supplied PNG (default
 * `shader_fog_diagonal`) gives a more natural cloud silhouette than value
 * noise. The two layers sample at different scales and drift speeds so the
 * field never reads as a flat repeating tile.
 *
 * UV is wrapped with `fract()` so the texture doesn't need REPEAT set on
 * its GL wrap mode (Phaser's default CLAMP_TO_EDGE is fine).
 */

const frag = `
#define SHADER_NAME FOG_POST_FX

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uFogTex;     // unit 1 — tileable cloud-noise texture
uniform sampler2D uZoneMask;   // unit 2 — effect zone mask
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec2  uMapSize;
uniform vec2  uTexSize;        // fog texture's pixel dimensions
uniform float uTime;
uniform float uIntensity;      // 0..1 — overall fog density multiplier
uniform vec3  uColor;
uniform float uDriftX;         // px/sec horizontal drift (positive = right)
uniform float uHasZoneMask;

varying vec2 outTexCoord;

void main() {
  vec2 uv      = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 worldPx = uv * uResolution + uScroll;

  // Two layers, both drifting in the SAME direction (right-to-left when
  // uDriftX > 0 — positive drift advances the sample point right in the
  // texture, which streams content leftward across the screen). The second
  // layer rides at half speed and a larger texel scale for a parallax feel.
  // Tiny opposing Y wobbles keep the field from looking like a flat slide.
  float t = uTime;
  vec2 ts = max(uTexSize, vec2(1.0));

  vec2 uv1 = fract((worldPx        + vec2(uDriftX * 1.0 * t,  uDriftX *  0.15 * t)) / ts);
  vec2 uv2 = fract((worldPx * 0.6  + vec2(uDriftX * 0.5 * t,  uDriftX * -0.10 * t)) / ts);

  float n1 = texture2D(uFogTex, uv1).r;
  float n2 = texture2D(uFogTex, uv2).r;
  float n  = n1 * 0.6 + n2 * 0.4;

  // Soften extremes so we don't get pockets of zero or full opacity.
  n = smoothstep(0.20, 0.90, n);

  vec4 src = texture2D(uMainSampler, outTexCoord);
  float fog = n * uIntensity;
  vec3 col = mix(src.rgb, uColor, fog);

  if (uHasZoneMask > 0.5) {
    vec2 maskUv = worldPx / uMapSize;
    float zone = 0.0;
    if (maskUv.x >= 0.0 && maskUv.x <= 1.0 && maskUv.y >= 0.0 && maskUv.y <= 1.0) {
      zone = texture2D(uZoneMask, maskUv).r;
    }
    col = mix(src.rgb, col, zone);
  }

  gl_FragColor = vec4(col, src.a);
}
`;

export class FogPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _time: number;
  private _intensity: number;
  private _color: [number, number, number];
  private _drift: number;
  private _fogTex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _fogKey: string | null;
  private _zoneMaskTex: any;
  private _mapW: number;
  private _mapH: number;
  private _texW: number;
  private _texH: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._resW      = game.scale.width;
    this._resH      = game.scale.height;
    this._scrollX   = 0;
    this._scrollY   = 0;
    this._time      = 0;
    this._intensity = 0.55;
    this._color     = [0.85, 0.88, 0.92];
    this._drift     = 6.0;
    this._fogTex    = null;
    this._fogKey    = null;
    this._zoneMaskTex = null;
    this._mapW      = 1;
    this._mapH      = 1;
    this._texW      = 1;
    this._texH      = 1;
    this._cam       = null;
  }

  onBoot(): void {
    if (this._fogKey) this._bind(this._fogKey);
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setTime(seconds: number)            { this._time = seconds; }
  setIntensity(v: number)             { this._intensity = Math.max(0, Math.min(1, v)); }
  setColor(r: number, g: number, b: number) { this._color = [r, g, b]; }
  setDrift(px: number)                { this._drift = px; }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)     { this._scrollX = x; this._scrollY = y; }

  /** Bind the (already-loaded) cloud-noise texture used for the fog field. */
  setTexture(key: string) {
    this._fogKey = key;
    this._bind(key);
  }

  setZoneMask(key: string, mapW: number, mapH: number) {
    this._mapW = Math.max(1, mapW);
    this._mapH = Math.max(1, mapH);
    if (!this.game.textures.exists(key)) { this._zoneMaskTex = null; return; }
    const frame = this.game.textures.getFrame(key);
    this._zoneMaskTex = frame?.glTexture ?? null;
  }

  clearZoneMask() {
    this._zoneMaskTex = null;
  }

  private _bind(key: string) {
    if (!this.game.textures.exists(key)) {
      this._fogTex = null;
      this._texW = 1;
      this._texH = 1;
      return;
    }
    const frame = this.game.textures.getFrame(key);
    this._fogTex = frame?.glTexture ?? null;
    // Frame width/height = source-image dimensions, used for tiling math.
    this._texW = frame?.width  || 1;
    this._texH = frame?.height || 1;
  }

  onPreRender(): void {
    // Use camera.worldView (world-pixel rect of visible viewport) — see the
    // darkness pipeline for the rationale. scrollX/Y is not zoom-aware.
    const cam = this._cam;
    const sx  = cam ? cam.worldView.x : this._scrollX;
    const sy  = cam ? cam.worldView.y : this._scrollY;
    // World-pixel uResolution — see the darkness pipeline for the rationale.
    const rw = this._resW || this.renderTargets?.[0]?.width  || this.renderer.width;
    const rh = this._resH || this.renderTargets?.[0]?.height || this.renderer.height;

    this.set2f('uResolution', rw, rh);
    this.set2f('uScroll',     sx, sy);
    this.set2f('uTexSize',    this._texW, this._texH);
    this.set1f('uTime',       this._time);
    this.set1f('uIntensity',  this._intensity);
    this.set3f('uColor',      this._color[0], this._color[1], this._color[2]);
    this.set1f('uDriftX',     this._drift);
    this.set2f('uMapSize',    this._mapW, this._mapH);
    this.set1f('uHasZoneMask', this._zoneMaskTex ? 1.0 : 0.0);
    this.set1i('uFogTex',     1);
    this.set1i('uZoneMask',   2);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._fogTex) this.bindTexture(this._fogTex, 1);
    if (this._zoneMaskTex) this.bindTexture(this._zoneMaskTex, 2);
    this.bindAndDraw(renderTarget);
  }
}
