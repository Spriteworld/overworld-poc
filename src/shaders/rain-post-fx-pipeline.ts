/**
 * Rain post-FX pipeline.
 *
 * Procedural — no particle systems, no extra textures. The screen is tiled
 * into world-anchored cells; each cell deterministically spawns a single
 * raindrop that streaks down then ring-splashes at the cell floor before
 * looping. Cell randomness comes from a cheap hash of the integer cell
 * coordinate, so the same cell always produces the same drop pattern even
 * as the camera scrolls — no popping at viewport edges.
 *
 * The shader runs over the whole camera output. It only ADDS to the source
 * (it never displaces it), so characters/water/etc. underneath stay intact.
 */

const frag = `
#define SHADER_NAME RAIN_POST_FX

// Mobile GPUs default to mediump (fp16, ~10-bit mantissa). Hash inputs in
// this shader grow large fast (cycleIdx * 67 over a long session) and lose
// precision under mediump — all cells then collapse to the same value and
// drops fall in lockstep. Use highp where the device exposes it.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uWaterMask;   // unit 1 — binary, red=water (or all-black 1×1 if absent)
uniform sampler2D uZoneMask;    // unit 2 — effect zone mask (white = rain here)
uniform sampler2D uPuddleMask;  // unit 3 — ground tiles (white = valid puddle surface)
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec2  uMapSize;        // world-px size; used to convert worldPx -> mask UV
uniform float uTime;
uniform float uIntensity;   // 0..1 — fraction of cells that actually spawn a drop
uniform vec3  uTint;        // rain colour (RGB, 0..1)
uniform float uWind;        // horizontal drift in px from cell-top to cell-bottom
uniform float uSpeed;       // fall-speed multiplier (1.0 = baseline)
uniform float uHasWater;    // 0 or 1 — whether to consult uWaterMask at all
uniform float uHasZoneMask; // 0 or 1 — whether to restrict rain to zone mask
uniform float uHasPuddleMask; // 0 or 1 — whether to consult uPuddleMask
uniform float uDesat;       // 0 = no change, 1 = full grayscale on the scene

varying vec2 outTexCoord;

const vec2 CELL = vec2(20.0, 96.0);   // world-pixel cell size
const float STREAK_LEN = 28.0;        // streak length in px
// Splash dwell time. Both rain types share the SAME duration — only fall
// speed differs. Land and water diverge: water splashes are surf-trail-style
// expanding ripples that take noticeably longer to dissipate.
const float SPLASH_DUR_LAND  = 0.13;
const float SPLASH_DUR_WATER = 0.95;
const float SPLASH_R0  = 0.5;         // land splash inner radius
const float SPLASH_R1  = 5.0;         // land splash final radius
// Water ripple — matches the surf-trail ring style: starts tight, balloons
// out, line tapers thinner as it grows.
const float WATER_RING_R0     = 2.0;
const float WATER_RING_R1     = 11.0;
const float WATER_RING_W0     = 1.4;
const float WATER_RING_W1     = 0.5;

// Higher-quality 2D hash. Cheap multiply-and-add chain that avoids the visible
// directional banding of the classic sin-based hash — important here because
// we sample it on a tight regular grid; any bias in the distribution shows up
// as visible structure in the rain.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // Y-flip outTexCoord so we can match world coordinates the same way the
  // water and darkness pipelines do (Phaser post-FX outTexCoord is GL-flipped).
  vec2 uv      = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 worldPx = uv * uResolution + uScroll;

  vec4 src = texture2D(uMainSampler, outTexCoord);

  float zone = 1.0;
  if (uHasZoneMask > 0.5) {
    vec2 maskUv = worldPx / uMapSize;
    zone = 0.0;
    if (maskUv.x >= 0.0 && maskUv.x <= 1.0 && maskUv.y >= 0.0 && maskUv.y <= 1.0) {
      zone = texture2D(uZoneMask, maskUv).r;
    }
    if (zone < 0.01) { gl_FragColor = src; return; }
  }

  // Desaturate the source first so the rain overlays painted later (streaks,
  // splashes, water rings) keep their full chroma against a muted backdrop.
  // Rec. 709 luma weights — perceptually balanced grey.
  vec3 col = src.rgb;
  if (uDesat > 0.0) {
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(lum), uDesat);
  }

  vec2 cellCoord = floor(worldPx / CELL);
  vec2 cellLocal = worldPx - cellCoord * CELL;

  // ───── Own cell: streak (fall) + land splash ──────────────────────────────
  // These two effects stay tight enough that they never extend beyond their
  // own cell boundary, so we only need own-cell data. The water ripple is
  // handled separately below in the 3×3 neighborhood loop.
  //
  // Each cell's drop is RE-RANDOMIZED every cycle (gate, dropX, fall length)
  // so we don't get a permanent fixed-position dripping pattern. Reference
  // cycle uses a stable per-cell rate so cycleIndex advances monotonically.
  float r1S = hash(cellCoord);
  float r3S = hash(cellCoord + vec2(31.0, 17.0));
  float refFallDur = mix(0.55, 0.95, r3S) * 0.85 / max(uSpeed, 0.01);
  float refCycle   = refFallDur + (SPLASH_DUR_LAND + SPLASH_DUR_WATER) * 0.5;
  // Wide phase spread (~80s) so cells in the same row are deeply
  // desynchronized — no visible "wave" of drops marching across the screen.
  float cellPhase  = r1S * 80.0;
  float cycleIdx   = floor((uTime + cellPhase) / refCycle);
  float cycleStart = cycleIdx * refCycle - cellPhase;
  float ownT       = uTime - cycleStart;

  // Per-cycle hashes — fresh each cycle, so position/density/Y wander.
  // mod-1024 keeps the hash input small enough to survive mediump precision
  // on phones (cycleIdx grows unbounded with uTime; cycleIdx * 67 quickly
  // overflows fp16 range, collapsing all cells to the same hash output and
  // marching every drop in lockstep).
  float ci = mod(cycleIdx, 1024.0);
  float gate    = hash(cellCoord + ci * 41.0);
  float r2c     = hash(cellCoord + vec2(7.0, 13.0)  + ci * 53.0);
  float r3c     = hash(cellCoord + vec2(31.0, 17.0) + ci * 67.0);
  float r4c     = hash(cellCoord + vec2(11.0, 19.0) + ci * 23.0);
  float r5c     = hash(cellCoord + vec2(43.0, 29.0) + ci * 37.0);
  vec3 offWhite  = vec3(0.88, 0.90, 0.93);
  vec3 faintBlue = vec3(0.62, 0.72, 0.88);
  vec3 dropColor = r5c < 0.33 ? uTint : (r5c < 0.66 ? offWhite : faintBlue);
  float ownDropX = mix(2.0, CELL.x - 2.0, r2c);
  float ownImpX  = ownDropX + uWind;
  // Randomize the impact-Y per cycle so splashes don't all line up on the
  // cell-bottom row. Range spans ~40% of cell height — short drops impact
  // higher in their cell, long ones reach the floor.
  float ownImpY  = mix(CELL.y * 0.55, CELL.y - 1.5, r4c);

  vec2 ownImpWorld = cellCoord * CELL + vec2(ownImpX, ownImpY);
  float ownOnWater = 0.0;
  if (uHasWater > 0.5) {
    vec2 mUv = ownImpWorld / uMapSize;
    if (mUv.x >= 0.0 && mUv.x <= 1.0 && mUv.y >= 0.0 && mUv.y <= 1.0) {
      ownOnWater = step(0.5, texture2D(uWaterMask, mUv).r);
    }
  }
  float ownOnPuddle = 0.0;
  if (uHasPuddleMask > 0.5 && ownOnWater < 0.5) {
    vec2 pmUv = ownImpWorld / uMapSize;
    if (pmUv.x >= 0.0 && pmUv.x <= 1.0 && pmUv.y >= 0.0 && pmUv.y <= 1.0) {
      float groundHit = texture2D(uPuddleMask, pmUv).r;
      vec2 impTile = floor(ownImpWorld / vec2(32.0, 32.0));
      float impHash = hash(impTile + vec2(77.0, 131.0));
      float thresh = 0.88 - uIntensity * 0.25;
      ownOnPuddle = step(0.5, groundHit) * step(thresh, impHash);
    }
  }
  float ownOnRippleSurface = max(ownOnWater, ownOnPuddle);
  float ownSplashDur = mix(SPLASH_DUR_LAND, SPLASH_DUR_WATER, ownOnRippleSurface);
  float ownFallDur   = mix(0.55, 0.95, r3c) * 0.85 / max(uSpeed, 0.01);

  bool ownActive = (gate < uIntensity) && (ownT < ownFallDur + ownSplashDur);

  if (ownActive && ownT < ownFallDur) {
    // Falling streak. Drop terminates at ownImpY (varies per-cycle), so the
    // streak's leading edge is fp * ownImpY rather than fp * CELL.y.
    float fp     = ownT / ownFallDur;
    float dropY  = fp * ownImpY;
    float dyHead = dropY - cellLocal.y;
    float xAtY   = ownDropX + uWind * (cellLocal.y / ownImpY);
    float xDist  = abs(cellLocal.x - xAtY);
    if (dyHead >= 0.0 && dyHead <= STREAK_LEN && xDist < 1.4) {
      float head  = 1.0 - (dyHead / STREAK_LEN);
      float xFade = 1.0 - smoothstep(0.0, 1.4, xDist);
      float a     = head * xFade * 0.55;
      col = mix(col, dropColor, a);
    }
  } else if (ownActive && ownOnRippleSurface < 0.5) {
    // Land splash — tight quick ring (own cell only; small enough to fit).
    float sp   = (ownT - ownFallDur) / ownSplashDur;
    vec2  d    = vec2(cellLocal.x - ownImpX, (cellLocal.y - ownImpY) * 1.8);
    float dist = length(d);
    float r    = mix(SPLASH_R0, SPLASH_R1, sp);
    float ring = 1.0 - smoothstep(0.6, 1.4, abs(dist - r));
    float a    = ring * (1.0 - sp) * 0.7;
    col = mix(col, dropColor, a);
  }

  // ───── 3×3 neighborhood: water ring aggregation ───────────────────────────
  // Water ripples grow up to ~11 px and the cell is 20×96 px, so a ring at
  // a cell edge can extend into adjacent cells. Each pixel checks its own
  // cell + the 8 neighbors and takes the brightest contribution. Per-cycle
  // re-randomization (same scheme as the own-cell branch) keeps the rings
  // from forming a regular grid.
  float waterRingA = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 ncCoord = cellCoord + vec2(float(dx), float(dy));

      float ns1   = hash(ncCoord);
      float ns3   = hash(ncCoord + vec2(31.0, 17.0));
      float nFall = mix(0.55, 0.95, ns3) * 0.85 / max(uSpeed, 0.01);
      float nRef  = nFall + (SPLASH_DUR_LAND + SPLASH_DUR_WATER) * 0.5;
      float nPh   = ns1 * 80.0;
      float nCi   = floor((uTime + nPh) / nRef);
      float nT    = uTime - (nCi * nRef - nPh);

      float nci = mod(nCi, 1024.0);
      float nGate = hash(ncCoord + nci * 41.0);
      if (nGate >= uIntensity) continue;

      float nr2c = hash(ncCoord + vec2(7.0, 13.0)  + nci * 53.0);
      float nr3c = hash(ncCoord + vec2(31.0, 17.0) + nci * 67.0);
      float nr4c = hash(ncCoord + vec2(11.0, 19.0) + nci * 23.0);
      float nDropX = mix(2.0, CELL.x - 2.0, nr2c);
      float nImpX  = nDropX + uWind;
      float nImpY  = mix(CELL.y * 0.55, CELL.y - 1.5, nr4c);

      vec2 nImpWorld = ncCoord * CELL + vec2(nImpX, nImpY);
      float nOnWater = 0.0;
      if (uHasWater > 0.5) {
        vec2 mUv = nImpWorld / uMapSize;
        if (mUv.x >= 0.0 && mUv.x <= 1.0 && mUv.y >= 0.0 && mUv.y <= 1.0) {
          nOnWater = step(0.5, texture2D(uWaterMask, mUv).r);
        }
      }
      float nOnPuddle = 0.0;
      if (uHasPuddleMask > 0.5 && nOnWater < 0.5) {
        vec2 pmUv = nImpWorld / uMapSize;
        if (pmUv.x >= 0.0 && pmUv.x <= 1.0 && pmUv.y >= 0.0 && pmUv.y <= 1.0) {
          float gHit = texture2D(uPuddleMask, pmUv).r;
          vec2 nImpTile = floor(nImpWorld / vec2(32.0, 32.0));
          float nImpHash = hash(nImpTile + vec2(77.0, 131.0));
          float thresh = 0.88 - uIntensity * 0.25;
          nOnPuddle = step(0.5, gHit) * step(thresh, nImpHash);
        }
      }
      if (nOnWater < 0.5 && nOnPuddle < 0.5) continue;

      float fallDur  = mix(0.55, 0.95, nr3c) * 0.85 / max(uSpeed, 0.01);
      if (nT < fallDur) continue;
      if (nT > fallDur + SPLASH_DUR_WATER) continue;

      float sp        = (nT - fallDur) / SPLASH_DUR_WATER;
      float rad       = mix(WATER_RING_R0, WATER_RING_R1, sp);
      float thickness = mix(WATER_RING_W0, WATER_RING_W1, sp);

      vec2  dvec = vec2(
        cellLocal.x - float(dx) * CELL.x - nImpX,
        (cellLocal.y - float(dy) * CELL.y - nImpY) * 1.1
      );
      float dist = length(dvec);
      float ring = 1.0 - smoothstep(thickness * 0.4, thickness, abs(dist - rad));
      float a    = ring * (1.0 - sp) * 0.85;

      waterRingA = max(waterRingA, a);
    }
  }
  if (waterRingA > 0.0) {
    col = mix(col, vec3(0.95, 0.97, 1.0), waterRingA);
  }


  if (uHasZoneMask > 0.5) {
    col = mix(src.rgb, col, zone);
  }

  gl_FragColor = vec4(col, src.a);
}
`;

export class RainPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _time: number;
  private _intensity: number;
  private _tint: [number, number, number];
  private _wind: number;
  private _speed: number;
  private _desat: number;
  private _waterTex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null;
  private _waterKey: string | null;
  private _zoneMaskTex: any;
  private _puddleMaskTex: any;
  private _mapW: number;
  private _mapH: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._resW       = game.scale.width;
    this._resH       = game.scale.height;
    this._scrollX    = 0;
    this._scrollY    = 0;
    this._time       = 0;
    this._intensity  = 0.45;
    this._tint       = [0.42, 0.52, 0.66];   // darker, slate-blue rain
    this._wind       = 0;
    this._speed      = 1.0;
    this._desat      = 0;
    this._waterTex   = null;
    this._waterKey   = null;
    this._zoneMaskTex = null;
    this._puddleMaskTex = null;
    this._mapW       = 1;
    this._mapH       = 1;
    this._cam        = null;
  }

  onBoot(): void {
    if (this._waterKey) this._bindWater(this._waterKey);
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setTime(seconds: number)              { this._time = seconds; }
  setIntensity(v: number)               { this._intensity = Math.max(0, Math.min(1, v)); }
  setTint(r: number, g: number, b: number) { this._tint = [r, g, b]; }
  setWind(px: number)                   { this._wind = px; }
  setSpeed(mult: number)                { this._speed = Math.max(0.01, mult); }
  setDesaturation(amount: number)       { this._desat = Math.max(0, Math.min(1, amount)); }
  setResolution(w: number, h: number)   { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)       { this._scrollX = x; this._scrollY = y; }

  /** Bind the (already-saved) water-mask texture for splash branching. */
  setWaterMask(key: string, mapW: number, mapH: number) {
    this._waterKey = key;
    this._mapW     = Math.max(1, mapW);
    this._mapH     = Math.max(1, mapH);
    this._bindWater(key);
  }

  /** Tear down the water reference (e.g. when the source RT goes away). */
  clearWaterMask() {
    this._waterKey = null;
    this._waterTex = null;
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

  setPuddleMask(key: string, mapW: number, mapH: number) {
    this._mapW = Math.max(1, mapW);
    this._mapH = Math.max(1, mapH);
    if (!this.game.textures.exists(key)) { this._puddleMaskTex = null; return; }
    const frame = this.game.textures.getFrame(key);
    this._puddleMaskTex = frame?.glTexture ?? null;
  }

  clearPuddleMask() {
    this._puddleMaskTex = null;
  }

  private _bindWater(key: string) {
    if (!this.game.textures.exists(key)) { this._waterTex = null; return; }
    const frame = this.game.textures.getFrame(key);
    this._waterTex = frame?.glTexture ?? null;
  }

  onPreRender(): void {
    // World-pixel uResolution + worldView for scroll — see the darkness
    // pipeline for the rationale. scrollX/Y is not zoom-aware.
    const cam = this._cam;
    const sx  = cam ? cam.worldView.x : this._scrollX;
    const sy  = cam ? cam.worldView.y : this._scrollY;
    const rw = this._resW || this.renderTargets?.[0]?.width  || this.renderer.width;
    const rh = this._resH || this.renderTargets?.[0]?.height || this.renderer.height;

    this.set2f('uResolution', rw, rh);
    this.set2f('uScroll',     sx, sy);
    this.set1f('uTime',       this._time);
    this.set1f('uIntensity',  this._intensity);
    this.set3f('uTint',       this._tint[0], this._tint[1], this._tint[2]);
    this.set1f('uWind',       this._wind);
    this.set1f('uSpeed',      this._speed);
    this.set1f('uDesat',      this._desat);
    this.set2f('uMapSize',    this._mapW, this._mapH);
    this.set1f('uHasWater',      this._waterTex ? 1.0 : 0.0);
    this.set1f('uHasZoneMask',  this._zoneMaskTex ? 1.0 : 0.0);
    this.set1f('uHasPuddleMask', this._puddleMaskTex ? 1.0 : 0.0);
    this.set1i('uWaterMask',   1);
    this.set1i('uZoneMask',    2);
    this.set1i('uPuddleMask',  3);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._waterTex) this.bindTexture(this._waterTex, 1);
    if (this._zoneMaskTex) this.bindTexture(this._zoneMaskTex, 2);
    if (this._puddleMaskTex) this.bindTexture(this._puddleMaskTex, 3);
    this.bindAndDraw(renderTarget);
  }
}
