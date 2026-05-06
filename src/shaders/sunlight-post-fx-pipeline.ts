/**
 * Harsh-sunlight weather effect. No animation — a static colour grade that
 * pushes the scene toward "midday glare":
 *
 *   1. Contrast boost (push pixels away from 0.5 midtone) — shadows feel
 *      crunchier, highlights blow out.
 *   2. Brightness lift — a small additive nudge so the average pixel reads
 *      as "lit by direct sun".
 *   3. Highlight warmth — bright pixels get tinted toward warm yellow; the
 *      darker pixels keep their original chroma so shadows still read cool.
 *   4. Full effect lerped against the source via uIntensity, so weather
 *      transitions can fade it in/out smoothly later.
 */

const frag = `
#define SHADER_NAME SUNLIGHT_POST_FX

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uZoneMask;     // unit 1 — effect zone mask
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec2  uMapSize;
uniform float uIntensity;        // 0..1 — blend the whole effect vs source
uniform vec3  uTint;             // warm tint, e.g. (1.0, 0.92, 0.78)
uniform float uContrast;         // 1.0 = no change; 1.15 = +15% contrast
uniform float uBrightness;       // additive value (typically small, 0..0.1)
uniform float uHighlightWarmth;  // 0..1 — how strongly highlights pull warm
uniform float uHasZoneMask;

varying vec2 outTexCoord;

void main() {
  vec4 src = texture2D(uMainSampler, outTexCoord);
  vec3 col = src.rgb;

  // Contrast pivot at midtone (0.5).
  col = (col - 0.5) * uContrast + 0.5;
  col += uBrightness;

  // Warm bias on bright pixels only — keeps shadow chroma intact.
  // Rec.601 luma is fine here; we only need a perceptual brightness gate.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float warmth = smoothstep(0.35, 0.85, lum) * uHighlightWarmth;
  col = mix(col, col * uTint, warmth);

  col = clamp(col, 0.0, 1.0);
  col = mix(src.rgb, col, uIntensity);

  if (uHasZoneMask > 0.5) {
    vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
    vec2 worldPx = uv * uResolution + uScroll;
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

export class SunlightPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _intensity: number;
  private _tint: [number, number, number];
  private _contrast: number;
  private _brightness: number;
  private _highlightWarmth: number;
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _zoneMaskTex: any;
  private _mapW: number;
  private _mapH: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._intensity       = 0.85;
    this._tint            = [1.0, 0.92, 0.78];
    this._contrast        = 1.18;
    this._brightness      = 0.05;
    this._highlightWarmth = 0.6;
    this._resW            = game.scale.width;
    this._resH            = game.scale.height;
    this._scrollX         = 0;
    this._scrollY         = 0;
    this._zoneMaskTex     = null;
    this._mapW            = 1;
    this._mapH            = 1;
    this._cam             = null;
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)     { this._scrollX = x; this._scrollY = y; }
  setIntensity(v: number)        { this._intensity       = Math.max(0, Math.min(1, v)); }
  setTint(r: number, g: number, b: number) { this._tint = [r, g, b]; }
  setContrast(v: number)         { this._contrast        = Math.max(0, v); }
  setBrightness(v: number)       { this._brightness      = v; }
  setHighlightWarmth(v: number)  { this._highlightWarmth = Math.max(0, Math.min(1, v)); }

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

  onPreRender(): void {
    const cam = this._cam;
    const sx  = cam ? cam.worldView.x : this._scrollX;
    const sy  = cam ? cam.worldView.y : this._scrollY;
    const rw  = this._resW || this.renderTargets?.[0]?.width  || this.renderer.width;
    const rh  = this._resH || this.renderTargets?.[0]?.height || this.renderer.height;

    this.set2f('uResolution',      rw, rh);
    this.set2f('uScroll',          sx, sy);
    this.set2f('uMapSize',         this._mapW, this._mapH);
    this.set1f('uIntensity',       this._intensity);
    this.set3f('uTint',            this._tint[0], this._tint[1], this._tint[2]);
    this.set1f('uContrast',        this._contrast);
    this.set1f('uBrightness',      this._brightness);
    this.set1f('uHighlightWarmth', this._highlightWarmth);
    this.set1f('uHasZoneMask',     this._zoneMaskTex ? 1.0 : 0.0);
    this.set1i('uZoneMask',        1);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._zoneMaskTex) this.bindTexture(this._zoneMaskTex, 1);
    this.bindAndDraw(renderTarget);
  }
}
