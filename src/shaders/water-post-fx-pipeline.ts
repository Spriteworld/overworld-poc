/**
 * Water post-FX pipeline.
 *
 * Two extra samplers, both authored in WORLD pixel space and sized to the full
 * map (not the screen):
 *   - uWaterMask : red = 1 wherever the floor layer has an `sw_water` tile.
 *   - uTrailMask : red = trail intensity stamped by WaterFx while the player
 *                  is in the SURF state. Decays per frame.
 *
 * The shader only touches pixels where mask > 0.5. Inside water:
 *   1) animated sin/cos displacement, amplified by trail intensity → ripples
 *      that swell where the player just passed.
 *   2) a faint caustic stripe modulated by time and worldPx — gives the surface
 *      visible movement even when standing still.
 *   3) a small blue brightening pulse on trail pixels.
 *
 * Reflections are NOT done in-shader — the existing sprite-based Reflection
 * system runs underneath this pass and is mirrored / displaced naturally
 * because the displacement is applied to the final composited scene.
 */

const frag = `
#define SHADER_NAME WATER_POST_FX

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uWaterMask;
uniform sampler2D uTrailMask;
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec2  uMapSize;
uniform float uTime;

varying vec2 outTexCoord;

void main() {
  // Phaser's post-FX outTexCoord is Y-flipped relative to world Y. Same trick
  // as DARKNESS_LIQUID_POST_FX — flip once to compute world coords for the
  // mask lookup, then use the unflipped outTexCoord to sample the scene.
  vec2 uv      = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 worldPx = uv * uResolution + uScroll;
  vec2 maskUv  = worldPx / uMapSize;

  if (maskUv.x < 0.0 || maskUv.x > 1.0 || maskUv.y < 0.0 || maskUv.y > 1.0) {
    gl_FragColor = texture2D(uMainSampler, outTexCoord);
    return;
  }

  float mask  = texture2D(uWaterMask, maskUv).r;
  float trail = texture2D(uTrailMask, maskUv).r;

  if (mask < 0.5) {
    gl_FragColor = texture2D(uMainSampler, outTexCoord);
    return;
  }

  // Wave displacement in world pixels — divide by uResolution (also world
  // pixels) to get the corresponding UV delta on the post-FX target.
  float t = uTime;
  vec2 wave;
  wave.x = sin(worldPx.y * 0.10 + t * 1.6) * 0.8;
  wave.y = cos(worldPx.x * 0.08 - t * 1.2) * 0.6;
  wave  *= 1.0 + trail * 6.0;

  vec2 sampleUv = outTexCoord + wave / uResolution;
  vec4 src = texture2D(uMainSampler, sampleUv);

  float stripe = 0.06 * sin(worldPx.x * 0.15 - worldPx.y * 0.12 - t * 2.0);
  vec3 watered = src.rgb + vec3(stripe * 0.5, stripe * 0.7, stripe);
  watered     += vec3(0.20, 0.28, 0.35) * trail;

  gl_FragColor = vec4(watered, src.a);
}
`;

export class WaterPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _maskTex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _trailTex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _maskKey: string | null;
  private _trailKey: string | null;
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _mapW: number;
  private _mapH: number;
  private _time: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._maskTex  = null;
    this._trailTex = null;
    this._maskKey  = null;
    this._trailKey = null;
    this._resW     = game.scale.width;
    this._resH     = game.scale.height;
    this._scrollX  = 0;
    this._scrollY  = 0;
    this._mapW     = 1;
    this._mapH     = 1;
    this._time     = 0;
    this._cam      = null;
  }

  onBoot(): void {
    if (this._maskKey)  this._bind('_maskTex',  this._maskKey);
    if (this._trailKey) this._bind('_trailTex', this._trailKey);
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) {
    this._cam = cam;
  }

  setMaskTexture(key: string)  { this._maskKey  = key; this._bind('_maskTex',  key); }
  setTrailTexture(key: string) { this._trailKey = key; this._bind('_trailTex', key); }

  setMapSize(w: number, h: number) { this._mapW = Math.max(1, w); this._mapH = Math.max(1, h); }
  setTime(seconds: number) { this._time = seconds; }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number) { this._scrollX = x; this._scrollY = y; }

  private _bind(field: '_maskTex' | '_trailTex', key: string) {
    if (!this.game.textures.exists(key)) {
      this[field] = null;
      return;
    }
    const frame = this.game.textures.getFrame(key);
    this[field] = frame?.glTexture ?? null;
  }

  onPreRender(): void {
    const cam = this._cam;
    const sx  = cam ? cam.scrollX : this._scrollX;
    const sy  = cam ? cam.scrollY : this._scrollY;

    // World-pixel uResolution — see the darkness pipeline for the rationale.
    const rw = this._resW || this.renderTargets?.[0]?.width  || this.renderer.width;
    const rh = this._resH || this.renderTargets?.[0]?.height || this.renderer.height;

    this.set2f('uResolution', rw, rh);
    this.set2f('uScroll',     sx, sy);
    this.set2f('uMapSize',    this._mapW, this._mapH);
    this.set1f('uTime',       this._time);
    this.set1i('uWaterMask',  1);
    this.set1i('uTrailMask',  2);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._maskTex)  this.bindTexture(this._maskTex,  1);
    if (this._trailTex) this.bindTexture(this._trailTex, 2);
    this.bindAndDraw(renderTarget);
  }
}
