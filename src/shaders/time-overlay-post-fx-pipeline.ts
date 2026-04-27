/**
 * Time-of-day overlay. Single-pass tint + desaturation blend — replaces the
 * old TimeOverlay scene's full-screen tinted image. The controller
 * (TimeOverlayFx) figures out which preset to use from real-world clock time
 * and pushes the uniforms; this shader does the per-pixel mix.
 *
 * Light awareness: when uLightCount > 0, each pixel computes a metaball
 * field from registered lights (same maths as the Darkness shader). The
 * field 0..1+ scales DOWN the desaturation and tint where lit, so torches
 * carve full-colour pockets out of nighttime grey.
 *
 * Setting uAlpha = 0 AND uDesat = 0 short-circuits — daytime pays nothing.
 */

const MAX_LIGHTS = 16;

const frag = `
#define SHADER_NAME TIME_OVERLAY_POST_FX
#define MAX_LIGHTS ${MAX_LIGHTS}

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec3  uTint;
uniform float uAlpha;
uniform float uDesat;          // 0 = no change, 1 = full grayscale
uniform vec3  uLights[MAX_LIGHTS];   // (worldX_px, worldY_px, radius_px)
uniform int   uLightCount;
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform float uLightSatRecover; // 0..1: how much of uDesat the lights undo
uniform float uLightTintRecover;// 0..1: how much of uAlpha the lights undo

varying vec2 outTexCoord;

void main() {
  vec4 src = texture2D(uMainSampler, outTexCoord);
  if (uAlpha <= 0.0 && uDesat <= 0.0) {
    gl_FragColor = src;
    return;
  }

  // Compute per-pixel light field — same formula as DARKNESS_LIQUID_POST_FX.
  // uv flip matches the convention used by the water/darkness/rain shaders.
  float lit = 0.0;
  if (uLightCount > 0) {
    vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
    vec2 worldPx = uv * uResolution + uScroll;
    float field = 0.0;
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec3 l = uLights[i];
      vec2 d = worldPx - l.xy;
      float distSq = dot(d, d) + 1.0;
      field += (l.z * l.z) / distSq;
    }
    // smoothstep so the edge of "lit" feathers naturally with the glow.
    lit = smoothstep(0.5, 1.5, field);
  }

  // Effective desat / alpha drop where lit. uLightSatRecover = 1 fully restores
  // colour under bright lights; 0 leaves the desat untouched.
  float effDesat = uDesat * (1.0 - lit * uLightSatRecover);
  float effAlpha = uAlpha * (1.0 - lit * uLightTintRecover);

  vec3 col = src.rgb;
  if (effDesat > 0.0) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(lum), effDesat);
  }
  if (effAlpha > 0.0) {
    col = mix(col, uTint, effAlpha);
  }
  gl_FragColor = vec4(col, src.a);
}
`;

export class TimeOverlayPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly MAX_LIGHTS = MAX_LIGHTS;

  private _tint: [number, number, number];
  private _alpha: number;
  private _desat: number;
  private _lightData: Float32Array;
  private _lightCount: number;
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _satRecover: number;
  private _tintRecover: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._tint        = [0, 0, 0];
    this._alpha       = 0;
    this._desat       = 0;
    this._lightData   = new Float32Array(MAX_LIGHTS * 3);
    this._lightCount  = 0;
    this._resW        = game.scale.width;
    this._resH        = game.scale.height;
    this._scrollX     = 0;
    this._scrollY     = 0;
    this._satRecover  = 0.85;  // lights remove most of the desat by default
    this._tintRecover = 0.55;  // and a little over half the tint
    this._cam         = null;
  }

  setTint(r: number, g: number, b: number) { this._tint = [r, g, b]; }
  setAlpha(a: number)                      { this._alpha = Math.max(0, Math.min(1, a)); }
  setDesaturation(d: number)               { this._desat = Math.max(0, Math.min(1, d)); }
  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setResolution(w: number, h: number)      { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)          { this._scrollX = x; this._scrollY = y; }
  setLightRecover(satAmt: number, tintAmt: number) {
    this._satRecover  = Math.max(0, Math.min(1, satAmt));
    this._tintRecover = Math.max(0, Math.min(1, tintAmt));
  }
  setLights(lights: ReadonlyArray<{ x: number; y: number; radius: number }>) {
    const count = Math.min(lights.length, MAX_LIGHTS);
    for (let i = 0; i < count; i++) {
      this._lightData[i * 3 + 0] = lights[i].x;
      this._lightData[i * 3 + 1] = lights[i].y;
      this._lightData[i * 3 + 2] = lights[i].radius;
    }
    this._lightCount = count;
  }

  onPreRender(): void {
    // Read scroll directly off the bound camera at render time (same caveat
    // as DARKNESS_LIQUID_POST_FX — a value cached in scene UPDATE lags the
    // camera's render-time scroll by one frame and the field swims).
    const cam = this._cam;
    const sx  = cam ? cam.scrollX : this._scrollX;
    const sy  = cam ? cam.scrollY : this._scrollY;
    // World-pixel uResolution — see the darkness pipeline for the rationale.
    const rw = this._resW || this.renderTargets?.[0]?.width  || this.renderer.width;
    const rh = this._resH || this.renderTargets?.[0]?.height || this.renderer.height;

    this.set3f('uTint',             this._tint[0], this._tint[1], this._tint[2]);
    this.set1f('uAlpha',            this._alpha);
    this.set1f('uDesat',            this._desat);
    this.set3fv('uLights',          this._lightData);
    this.set1i('uLightCount',       this._lightCount);
    this.set2f('uResolution',       rw, rh);
    this.set2f('uScroll',           sx, sy);
    this.set1f('uLightSatRecover',  this._satRecover);
    this.set1f('uLightTintRecover', this._tintRecover);
  }
}
