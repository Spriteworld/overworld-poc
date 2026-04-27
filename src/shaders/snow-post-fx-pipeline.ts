/**
 * Snow weather effect.
 *
 * Three independent flake pools, layered for depth:
 *   - **Bulk (snow1)**       — small, fast, distant. NUM_BULK flakes.
 *   - **Mid  (snow0)**       — bigger, slightly slower. NUM_MID = NUM_BULK / 3.
 *   - **Hero (snow0, big)**  — biggest, slowest, closest. NUM_HERO = NUM_MID / 4.
 *
 * Each layer iterates its own pool — every flake is independent, no cell
 * grid. Per-flake: stable start-time stagger; per-cycle re-randomized
 * start X, fall speed, and horizontal drift (gives each flake its own
 * downward angle). Cycle period uses the slowest possible per-flake speed
 * so even the most jittered slow flakes complete a full top-to-bottom
 * fall before respawning.
 *
 * Pixels outside a flake's stamp short-circuit before the texture sample,
 * so the per-flake cost is dominated by hash math, not texture bandwidth.
 */

// Pool sizes are compile-time constants. We size them generously so the
// `heavy_snow` variant (uDensity = 1.0) can reach a dramatically denser
// look than the standard `snow` variant (uDensity ≈ 0.55) without needing
// to recompile the shader per variant.
const NUM_BULK = 288;
const NUM_MID  = 96;          // ~ 1/3 of bulk
const NUM_HERO = 24;          // 1/4 of mid

const frag = `
#define SHADER_NAME SNOW_POST_FX
#define NUM_BULK ${NUM_BULK}
#define NUM_MID  ${NUM_MID}
#define NUM_HERO ${NUM_HERO}

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uSnow0;        // bigger flake stamp (mid + hero layers)
uniform sampler2D uSnow1;        // smaller flake stamp (bulk layer)
uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uDensity;
uniform vec3  uTint;
uniform float uTintAlpha;
uniform float uDesat;
uniform vec3  uFlakeColor;
uniform float uFallSpeed;        // px/sec — base vertical speed
uniform float uSpeedJitter;      // 0..1 — fraction of base speed each flake can vary by
uniform float uMaxDrift;         // px/sec — max horizontal velocity each flake can have, ±
uniform float uContrast;         // 1.0 = no change; > 1 boosts contrast on the underlying scene

varying vec2 outTexCoord;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv      = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 screenPx = uv * uResolution;

  vec4 src = texture2D(uMainSampler, outTexCoord);
  vec3 col = src.rgb;

  // Optional contrast boost on the underlying scene — pivot at midtone so
  // shadows crunch and highlights push when uContrast > 1.
  if (abs(uContrast - 1.0) > 0.001) {
    col = (col - 0.5) * mix(1.0, uContrast, uIntensity) + 0.5;
  }

  if (uDesat > 0.0) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(lum), uDesat * uIntensity);
  }
  col = mix(col, uTint, uTintAlpha * uIntensity);

  float flakeAlpha = 0.0;

  // ── Bulk layer (snow1, small + fast) ─────────────────────────────────
  {
    const float SPEED_MULT = 1.0;
    const float RADIUS     = 3.5;
    float minSpeed = uFallSpeed * SPEED_MULT * max(1.0 - uSpeedJitter, 0.05);
    float cycleDur = uResolution.y / minSpeed;

    for (int i = 0; i < NUM_BULK; i++) {
      float fi = float(i);
      float r1S       = hash(vec2(fi, 1.0));
      float startTime = r1S * cycleDur * 4.0;
      float cycleIdx  = floor((uTime + startTime) / cycleDur);
      float t         = uTime + startTime - cycleIdx * cycleDur;
      float ci        = mod(cycleIdx, 1024.0);

      float r2c = hash(vec2(fi, 2.0) + ci *  3.71);
      if (r2c >= uDensity) continue;

      float r3c = hash(vec2(fi, 3.0) + ci *  5.41);
      float r4c = hash(vec2(fi, 4.0) + ci *  7.13);
      float r5c = hash(vec2(fi, 5.0) + ci * 11.07);

      float fallSpeed = uFallSpeed * SPEED_MULT * mix(1.0 - uSpeedJitter, 1.0 + uSpeedJitter, r4c);
      float drift     = mix(-uMaxDrift, uMaxDrift, r5c);
      float startX    = r3c * uResolution.x;

      float swayPhase = uTime * (1.0 + r5c * 0.5) + r1S * 6.28;
      float flakeX    = startX + drift * t + sin(swayPhase) * 2.5;
      float flakeY    = t * fallSpeed;

      vec2 d = screenPx - vec2(flakeX, flakeY);
      vec2 flakeUv = (d / (RADIUS * 2.0)) + 0.5;
      if (flakeUv.x < 0.0 || flakeUv.x > 1.0 ||
          flakeUv.y < 0.0 || flakeUv.y > 1.0) continue;
      float flake = texture2D(uSnow1, flakeUv).r;
      flakeAlpha = max(flakeAlpha, flake);
    }
  }

  // ── Mid layer (snow0, bigger + slightly slower) ───────────────────────
  {
    const float SPEED_MULT = 0.85;
    const float RADIUS     = 6.0;
    float minSpeed = uFallSpeed * SPEED_MULT * max(1.0 - uSpeedJitter, 0.05);
    float cycleDur = uResolution.y / minSpeed;

    for (int i = 0; i < NUM_MID; i++) {
      float fi = float(i) + 100.0;        // disjoint seed range from bulk
      float r1S       = hash(vec2(fi, 1.0));
      float startTime = r1S * cycleDur * 4.0;
      float cycleIdx  = floor((uTime + startTime) / cycleDur);
      float t         = uTime + startTime - cycleIdx * cycleDur;
      float ci        = mod(cycleIdx, 1024.0);

      float r2c = hash(vec2(fi, 2.0) + ci *  3.71);
      if (r2c >= uDensity) continue;

      float r3c = hash(vec2(fi, 3.0) + ci *  5.41);
      float r4c = hash(vec2(fi, 4.0) + ci *  7.13);
      float r5c = hash(vec2(fi, 5.0) + ci * 11.07);

      float fallSpeed = uFallSpeed * SPEED_MULT * mix(1.0 - uSpeedJitter, 1.0 + uSpeedJitter, r4c);
      float drift     = mix(-uMaxDrift, uMaxDrift, r5c);
      float startX    = r3c * uResolution.x;

      float swayPhase = uTime * (1.0 + r5c * 0.5) + r1S * 6.28;
      float flakeX    = startX + drift * t + sin(swayPhase) * 3.0;
      float flakeY    = t * fallSpeed;

      vec2 d = screenPx - vec2(flakeX, flakeY);
      vec2 flakeUv = (d / (RADIUS * 2.0)) + 0.5;
      if (flakeUv.x < 0.0 || flakeUv.x > 1.0 ||
          flakeUv.y < 0.0 || flakeUv.y > 1.0) continue;
      float flake = texture2D(uSnow0, flakeUv).r;
      flakeAlpha = max(flakeAlpha, flake);
    }
  }

  // ── Hero layer (snow0, biggest + slowest, foreground accent) ──────────
  {
    const float SPEED_MULT = 0.65;
    const float RADIUS     = 10.0;
    float minSpeed = uFallSpeed * SPEED_MULT * max(1.0 - uSpeedJitter, 0.05);
    float cycleDur = uResolution.y / minSpeed;

    for (int i = 0; i < NUM_HERO; i++) {
      float fi = float(i) + 200.0;        // disjoint seed range from mid
      float r1S       = hash(vec2(fi, 1.0));
      float startTime = r1S * cycleDur * 4.0;
      float cycleIdx  = floor((uTime + startTime) / cycleDur);
      float t         = uTime + startTime - cycleIdx * cycleDur;
      float ci        = mod(cycleIdx, 1024.0);

      float r2c = hash(vec2(fi, 2.0) + ci *  3.71);
      if (r2c >= uDensity) continue;

      float r3c = hash(vec2(fi, 3.0) + ci *  5.41);
      float r4c = hash(vec2(fi, 4.0) + ci *  7.13);
      float r5c = hash(vec2(fi, 5.0) + ci * 11.07);

      float fallSpeed = uFallSpeed * SPEED_MULT * mix(1.0 - uSpeedJitter, 1.0 + uSpeedJitter, r4c);
      float drift     = mix(-uMaxDrift, uMaxDrift, r5c) * 0.6;   // slower flakes drift less
      float startX    = r3c * uResolution.x;

      float swayPhase = uTime * (0.7 + r5c * 0.4) + r1S * 6.28;
      float flakeX    = startX + drift * t + sin(swayPhase) * 4.0;
      float flakeY    = t * fallSpeed;

      vec2 d = screenPx - vec2(flakeX, flakeY);
      vec2 flakeUv = (d / (RADIUS * 2.0)) + 0.5;
      if (flakeUv.x < 0.0 || flakeUv.x > 1.0 ||
          flakeUv.y < 0.0 || flakeUv.y > 1.0) continue;
      float flake = texture2D(uSnow0, flakeUv).r;
      flakeAlpha = max(flakeAlpha, flake);
    }
  }

  col = mix(col, uFlakeColor, flakeAlpha * uIntensity);
  gl_FragColor = vec4(col, src.a);
}
`;

export class SnowPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly NUM_BULK = NUM_BULK;
  static readonly NUM_MID  = NUM_MID;
  static readonly NUM_HERO = NUM_HERO;

  private _resW: number;
  private _resH: number;
  private _time: number;
  private _intensity: number;
  private _density: number;
  private _tint: [number, number, number];
  private _tintAlpha: number;
  private _desat: number;
  private _flakeColor: [number, number, number];
  private _fallSpeed: number;
  private _speedJitter: number;
  private _maxDrift: number;
  private _contrast: number;
  private _snow0: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _snow1: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _key0: string | null;
  private _key1: string | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._resW        = game.scale.width;
    this._resH        = game.scale.height;
    this._time        = 0;
    this._intensity   = 1.0;
    this._density     = 0.65;
    this._tint        = [0.82, 0.88, 0.96];
    this._tintAlpha   = 0.12;
    this._desat       = 0.10;
    this._flakeColor  = [1.0, 1.0, 1.0];
    this._fallSpeed   = 60;
    this._speedJitter = 0.35;
    this._maxDrift    = 14;
    this._contrast    = 1.0;
    this._snow0       = null;
    this._snow1       = null;
    this._key0        = null;
    this._key1        = null;
  }

  onBoot(): void {
    if (this._key0) this._bind(0, this._key0);
    if (this._key1) this._bind(1, this._key1);
  }

  setTime(seconds: number)         { this._time = seconds; }
  setIntensity(v: number)          { this._intensity = Math.max(0, Math.min(1, v)); }
  setDensity(v: number)            { this._density = Math.max(0, Math.min(1, v)); }
  setTint(r: number, g: number, b: number) { this._tint = [r, g, b]; }
  setTintAlpha(v: number)          { this._tintAlpha = Math.max(0, Math.min(1, v)); }
  setDesaturation(v: number)       { this._desat = Math.max(0, Math.min(1, v)); }
  setFlakeColor(r: number, g: number, b: number) { this._flakeColor = [r, g, b]; }
  setFallSpeed(px: number)         { this._fallSpeed = px; }
  setSpeedJitter(v: number)        { this._speedJitter = Math.max(0, Math.min(1, v)); }
  setMaxDrift(px: number)          { this._maxDrift = Math.max(0, px); }
  setContrast(v: number)           { this._contrast = Math.max(0, v); }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }

  setSnow0Texture(key: string) { this._key0 = key; this._bind(0, key); }
  setSnow1Texture(key: string) { this._key1 = key; this._bind(1, key); }

  private _bind(slot: 0 | 1, key: string) {
    if (!this.game.textures.exists(key)) {
      if (slot === 0) this._snow0 = null;
      else            this._snow1 = null;
      return;
    }
    const frame = this.game.textures.getFrame(key);
    const tex = frame?.glTexture ?? null;
    if (slot === 0) this._snow0 = tex;
    else            this._snow1 = tex;
  }

  onPreRender(): void {
    const rt = this.renderTargets?.[0];
    const rw = rt?.width  ?? this.renderer.width  ?? this._resW;
    const rh = rt?.height ?? this.renderer.height ?? this._resH;

    this.set2f('uResolution',  rw, rh);
    this.set1f('uTime',        this._time);
    this.set1f('uIntensity',   this._intensity);
    this.set1f('uDensity',     this._density);
    this.set3f('uTint',        this._tint[0], this._tint[1], this._tint[2]);
    this.set1f('uTintAlpha',   this._tintAlpha);
    this.set1f('uDesat',       this._desat);
    this.set3f('uFlakeColor',  this._flakeColor[0], this._flakeColor[1], this._flakeColor[2]);
    this.set1f('uFallSpeed',   this._fallSpeed);
    this.set1f('uSpeedJitter', this._speedJitter);
    this.set1f('uMaxDrift',    this._maxDrift);
    this.set1f('uContrast',    this._contrast);
    this.set1i('uSnow0',       1);
    this.set1i('uSnow1',       2);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._snow0) this.bindTexture(this._snow0, 1);
    if (this._snow1) this.bindTexture(this._snow1, 2);
    this.bindAndDraw(renderTarget);
  }
}
