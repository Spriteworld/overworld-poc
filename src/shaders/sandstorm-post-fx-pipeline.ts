/**
 * Sandstorm weather effect — modelled on the FireRed overworld sandstorm
 * described in `docs/from_fr_decomp/sandstorm.md`.
 *
 * Three composited elements:
 *   1. Scene-wide muddy-orange tint with a touch of desaturation — the air
 *      is full of kicked-up dust, so everything reads warm and washed out.
 *   2. **Cloud sheet** — a tileable sand-cloud texture drifting diagonally
 *      across the screen (horizontal with a slight downward bias). The
 *      drift speed pulses gently between a steady minimum and a stronger
 *      gust on a slow sin rhythm; it never reverses or stops. Anchored to
 *      the *camera* (uv-based, no world scroll term) so the sheet always
 *      covers the visible area regardless of where the player is in the
 *      world — same as how the FR engine layers it.
 *   3. **Whorls** — six small swirls of sand that rise from the bottom of
 *      the screen to the top, each spinning around its own slowly
 *      expanding circular path. Their start times are staggered via a
 *      hash so they don't appear in unison; they wrap when they reach the
 *      top and start over from the bottom.
 *
 * All three pieces share the same warm palette so the result reads as one
 * dusty atmosphere rather than separate layers.
 */

const NUM_WHORLS = 6;

const frag = `
#define SHADER_NAME SANDSTORM_POST_FX
#define NUM_WHORLS ${NUM_WHORLS}

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uSandTex;       // unit 1 — cloud-sheet / whorl source texture
uniform vec2  uResolution;
uniform vec2  uTexSize;
uniform float uTime;
uniform vec3  uTint;              // muddy orange — base scene tint
uniform float uTintAlpha;         // 0..1 mix amount toward uTint
uniform float uDesat;             // 0..1 — desaturation under the tint
uniform vec3  uParticleColor;     // warm sand colour for cloud sheet + whorls
uniform float uParticleStrength;  // base alpha of cloud-sheet sample
uniform float uDriftX;            // px/sec — base horizontal drift speed
uniform float uIntensity;         // 0..1 — overall effect, lets controller fade in/out

varying vec2 outTexCoord;

float hash(float n) {
  return fract(sin(n * 91.3458) * 47453.5453);
}

void main() {
  vec2 uv       = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 screenPx = uv * uResolution;
  vec2 ts       = max(uTexSize, vec2(1.0));
  float t       = uTime;

  // ── 1. Cloud sheet ─────────────────────────────────────────────────────
  // Diagonal drift (horizontal with a slight downward bias). Pulsing speed
  // — varies between ~0.6× and ~1.4× the base, never reverses.
  //
  // Three offset texture samples averaged, each at a different scale and
  // drift rate. With a single sample the source PNG's tile seams would be
  // obvious; superimposing three at coprime scales/phases breaks the
  // repeat — the eye can't lock onto any one tile boundary because the
  // other two layers always disagree at that boundary.
  //
  // CLOUD_SCALE < 1 stretches the texture across more screen pixels, so
  // each "patch" of sand reads bigger. Drop toward 0.25 for huge banks,
  // raise toward 1.0 for fine grain.
  //
  // Drift uses the *integral* of the pulse (integral of (1 + 0.4*sin(0.5*tau))
  // from 0 to t = t + 0.8*(1 - cos(0.5*t))) so the displacement is strictly
  // monotonic. Naive 't * pulse(t)' reverses sign once t*d/dt[pulse] dominates
  // pulse — visible as a "zig-zag" after ~15s of run time. The integral form
  // gives pulse-modulated SPEED that never goes negative.
  //
  // All three layers drift in the *same* direction, just at different
  // magnitudes — gives parallax depth without making any layer appear to
  // move opposite the wind.
  float driftAmount = t + 0.8 * (1.0 - cos(t * 0.5));
  vec2 baseDrift = vec2(uDriftX, uDriftX * 0.25) * driftAmount;
  const float CLOUD_SCALE = 0.4;
  vec2 uvA = fract((screenPx * CLOUD_SCALE                + baseDrift                          ) / ts);
  vec2 uvB = fract((screenPx * (CLOUD_SCALE * 0.71)        + baseDrift * 0.65 + vec2(83.0, 167.0)) / ts);
  vec2 uvC = fract((screenPx * (CLOUD_SCALE * 1.27) + 200.0 + baseDrift * 0.40 + vec2(311.0,  91.0)) / ts);
  float clouds = (texture2D(uSandTex, uvA).r
                + texture2D(uSandTex, uvB).r
                + texture2D(uSandTex, uvC).r) / 3.0;

  // ── 2. Whorls ──────────────────────────────────────────────────────────
  // Six rising sand swirls. Each whorl uses a procedural soft-circle as its
  // base alpha (so it's always visible regardless of where on the sandstorm
  // texture it lands), and the texture is sampled in rotated local coords
  // *only as a multiplier on top of that alpha* — gives internal "swirling"
  // detail without making the whole whorl invisible if it lands on a dark
  // patch of the source texture.
  float whorls = 0.0;
  for (int i = 0; i < NUM_WHORLS; i++) {
    float fi          = float(i);
    float startOffset = hash(fi * 1.7 + 3.0)  * 6.0;
    float xBase       = mix(0.08, 0.92, hash(fi * 2.3 + 7.0)) * uResolution.x;
    float riseSpeed   = mix(50.0, 95.0,  hash(fi * 3.1 + 11.0));
    float baseRadius  = mix(16.0, 26.0,  hash(fi * 4.7 + 17.0));

    float lifetime = (uResolution.y + 120.0) / riseSpeed;
    float age      = mod(t + 100.0 - startOffset, lifetime);
    float lifeT    = age / lifetime;

    float angle      = age * 4.5;
    float spinRadius = baseRadius * (1.0 + lifeT * 1.6);
    float cx         = xBase + cos(angle) * spinRadius;
    float cy         = uResolution.y - age * riseSpeed + sin(angle) * spinRadius * 0.5;

    vec2 d    = screenPx - vec2(cx, cy);
    float dist = length(d);

    // Soft procedural circle — bright at centre, fades to zero at ~1.0×r.
    // This is the whorl's *base* shape; the texture sample below only adds
    // detail to it, never erases it.
    float circle = 1.0 - smoothstep(spinRadius * 0.25, spinRadius * 1.0, dist);
    if (circle <= 0.0) continue;

    // Rotated local UV so the texture appears to spin with the whorl.
    float c2 = cos(angle);
    float s2 = sin(angle);
    vec2 rd  = vec2(d.x * c2 - d.y * s2, d.x * s2 + d.y * c2);
    vec2 wuv = fract((rd / (spinRadius * 1.5)) + 0.5);
    // Remap the texture sample to 0.5..1.0 so even dark texture pixels still
    // let the procedural circle through at half strength.
    float detail = texture2D(uSandTex, wuv).r * 0.5 + 0.5;

    float lifeFade = 1.0 - lifeT * 0.3;
    whorls = max(whorls, circle * detail * lifeFade);
  }

  // ── 3. Composite ───────────────────────────────────────────────────────
  vec4 src = texture2D(uMainSampler, outTexCoord);
  vec3 col = src.rgb;

  if (uDesat > 0.0) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(lum), uDesat * uIntensity);
  }

  col = mix(col, uTint, uTintAlpha * uIntensity);

  // Cloud sheet underneath, whorls layered on top with a stronger blend so
  // they actually read as foreground motion against the diffuse cloud wash.
  // Whorls use a darker shade of the same palette — dense concentrations of
  // dust block more light, so they read denser/heavier than the cloud sheet.
  col = mix(col, uParticleColor,        clouds * uParticleStrength * uIntensity);
  col = mix(col, uParticleColor * 0.55, whorls * 0.85 * uIntensity);

  gl_FragColor = vec4(col, src.a);
}
`;

export class SandstormPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly NUM_WHORLS = NUM_WHORLS;

  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _time: number;
  private _tint: [number, number, number];
  private _tintAlpha: number;
  private _desat: number;
  private _particleColor: [number, number, number];
  private _particleStrength: number;
  private _drift: number;
  private _intensity: number;
  private _sandTex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _sandKey: string | null;
  private _texW: number;
  private _texH: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._resW             = game.scale.width;
    this._resH             = game.scale.height;
    this._scrollX          = 0;
    this._scrollY          = 0;
    this._time             = 0;
    this._tint             = [0.55, 0.36, 0.18];   // muddy orange
    this._tintAlpha        = 0.45;
    this._desat            = 0.20;
    this._particleColor    = [1.0, 0.78, 0.46];    // warm sand highlight
    this._particleStrength = 0.85;
    this._drift            = 80;                   // base horizontal speed
    this._intensity        = 1.0;
    this._sandTex          = null;
    this._sandKey          = null;
    this._texW             = 1;
    this._texH             = 1;
    this._cam              = null;
  }

  onBoot(): void {
    if (this._sandKey) this._bind(this._sandKey);
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setTime(seconds: number)         { this._time = seconds; }
  setTint(r: number, g: number, b: number) { this._tint = [r, g, b]; }
  setTintAlpha(v: number)          { this._tintAlpha = Math.max(0, Math.min(1, v)); }
  setDesaturation(v: number)       { this._desat = Math.max(0, Math.min(1, v)); }
  setParticleColor(r: number, g: number, b: number) { this._particleColor = [r, g, b]; }
  setParticleStrength(v: number)   { this._particleStrength = Math.max(0, v); }
  setDrift(px: number)             { this._drift = px; }
  setIntensity(v: number)          { this._intensity = Math.max(0, Math.min(1, v)); }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)  { this._scrollX = x; this._scrollY = y; }

  setTexture(key: string) {
    this._sandKey = key;
    this._bind(key);
  }

  private _bind(key: string) {
    if (!this.game.textures.exists(key)) {
      this._sandTex = null;
      this._texW = 1;
      this._texH = 1;
      return;
    }
    const frame = this.game.textures.getFrame(key);
    this._sandTex = frame?.glTexture ?? null;
    this._texW = frame?.width  || 1;
    this._texH = frame?.height || 1;
  }

  onPreRender(): void {
    const rt  = this.renderTargets?.[0];
    const rw  = rt?.width  ?? this.renderer.width  ?? this._resW;
    const rh  = rt?.height ?? this.renderer.height ?? this._resH;

    this.set2f('uResolution',       rw, rh);
    this.set2f('uTexSize',          this._texW, this._texH);
    this.set1f('uTime',             this._time);
    this.set3f('uTint',             this._tint[0], this._tint[1], this._tint[2]);
    this.set1f('uTintAlpha',        this._tintAlpha);
    this.set1f('uDesat',            this._desat);
    this.set3f('uParticleColor',    this._particleColor[0], this._particleColor[1], this._particleColor[2]);
    this.set1f('uParticleStrength', this._particleStrength);
    this.set1f('uDriftX',           this._drift);
    this.set1f('uIntensity',        this._intensity);
    this.set1i('uSandTex',          1);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._sandTex) this.bindTexture(this._sandTex, 1);
    this.bindAndDraw(renderTarget);
  }
}
