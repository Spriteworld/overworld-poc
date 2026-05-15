/**
 * Puddle post-FX pipeline — applied to the subground tilemap layer so puddles
 * render UNDER characters. Handles reflective patches + rain-drop ring
 * ripples on puddle tiles.
 */

const frag = `
#define SHADER_NAME PUDDLE_POST_FX

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uPuddleMask;      // unit 1 — ground tiles (white = valid puddle surface)
uniform sampler2D uZoneMask;        // unit 2 — effect zone mask
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec2  uMapSize;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform float uWind;
uniform float uHasPuddleMask;
uniform float uHasZoneMask;

varying vec2 outTexCoord;

const vec2 CELL = vec2(20.0, 96.0);
const vec2 TILE = vec2(32.0, 32.0);
const float SPLASH_DUR_WATER = 0.95;
const float WATER_RING_R0    = 2.0;
const float WATER_RING_R1    = 11.0;
const float WATER_RING_W0    = 1.4;
const float WATER_RING_W1    = 0.5;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
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

  float onGround = 1.0;
  if (uHasPuddleMask > 0.5) {
    vec2 pmUv = worldPx / uMapSize;
    onGround = 0.0;
    if (pmUv.x >= 0.0 && pmUv.x <= 1.0 && pmUv.y >= 0.0 && pmUv.y <= 1.0) {
      onGround = texture2D(uPuddleMask, pmUv).r;
    }
  }

  vec2 tileCoord = floor(worldPx / TILE);
  vec2 tileLocal = (worldPx - tileCoord * TILE) / TILE;

  float tileHash = hash(tileCoord + vec2(77.0, 131.0));
  float threshold = 1.3 * (1.0 - uIntensity);
  bool isPuddle = tileHash > threshold && onGround > 0.5;

  if (!isPuddle) { gl_FragColor = src; return; }

  // Neighbor joining
  float nR = hash(tileCoord + vec2(1.0, 0.0) + vec2(77.0, 131.0));
  float nL = hash(tileCoord + vec2(-1.0, 0.0) + vec2(77.0, 131.0));
  float nD = hash(tileCoord + vec2(0.0, 1.0) + vec2(77.0, 131.0));
  float nU = hash(tileCoord + vec2(0.0, -1.0) + vec2(77.0, 131.0));
  bool joinR = nR > threshold;
  bool joinL = nL > threshold;
  bool joinD = nD > threshold;
  bool joinU = nU > threshold;
  if (uHasPuddleMask > 0.5) {
    vec2 tCenter = (tileCoord + 0.5) * TILE;
    joinR = joinR && texture2D(uPuddleMask, (tCenter + vec2(TILE.x, 0.0)) / uMapSize).r > 0.5;
    joinL = joinL && texture2D(uPuddleMask, (tCenter - vec2(TILE.x, 0.0)) / uMapSize).r > 0.5;
    joinD = joinD && texture2D(uPuddleMask, (tCenter + vec2(0.0, TILE.y)) / uMapSize).r > 0.5;
    joinU = joinU && texture2D(uPuddleMask, (tCenter - vec2(0.0, TILE.y)) / uMapSize).r > 0.5;
  }

  // Tile-shaped puddle with wavy edges
  float h2 = hash(tileCoord + vec2(3.0, 59.0));
  float h3 = hash(tileCoord + vec2(23.0, 7.0));
  float inset = mix(0.08, 0.14, h2);

  // Wavy inset per edge — sin along the perpendicular axis
  float waveR = inset + 0.04 * sin(tileLocal.y * 12.56 + h2 * 6.28);
  float waveL = inset + 0.04 * sin(tileLocal.y * 10.99 + h3 * 6.28);
  float waveD = inset + 0.04 * sin(tileLocal.x * 11.78 + h2 * 4.71);
  float waveU = inset + 0.04 * sin(tileLocal.x * 13.35 + h3 * 4.71);

  float fadeR = joinR ? 1.0 : smoothstep(0.0, 0.06, 1.0 - tileLocal.x - waveR);
  float fadeL = joinL ? 1.0 : smoothstep(0.0, 0.06, tileLocal.x - waveL);
  float fadeD = joinD ? 1.0 : smoothstep(0.0, 0.06, 1.0 - tileLocal.y - waveD);
  float fadeU = joinU ? 1.0 : smoothstep(0.0, 0.06, tileLocal.y - waveU);
  float puddle = fadeR * fadeL * fadeD * fadeU * uIntensity;

  if (puddle < 0.01) { gl_FragColor = src; return; }

  // Water-like reflection displacement on puddle pixels
  float t = uTime;
  vec2 wave;
  wave.x = sin(worldPx.y * 0.12 + t * 1.4) * 0.4 + sin(worldPx.y * 0.23 + t * 0.9) * 0.25;
  wave.y = cos(worldPx.x * 0.10 + t * 1.1) * 0.3 + cos(worldPx.x * 0.19 - t * 0.7) * 0.2;
  vec2 displaced = outTexCoord + (wave / uResolution) * puddle;
  vec3 col = texture2D(uMainSampler, displaced).rgb;

  // Wet reflective tint — darken + shift toward cool blue-gray
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 wet = mix(col * 0.7, vec3(0.45, 0.52, 0.65), 0.4);
  col = mix(col, wet, puddle * 0.22);

  // Rain-drop ring ripples on the puddle (3x3 neighborhood)
  vec2 cellCoord = floor(worldPx / CELL);
  vec2 cellLocal = worldPx - cellCoord * CELL;
  float ringA = 0.0;

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 ncCoord = cellCoord + vec2(float(dx), float(dy));

      float ns1   = hash(ncCoord);
      float ns3   = hash(ncCoord + vec2(31.0, 17.0));
      float nFall = mix(0.55, 0.95, ns3) * 0.85 / max(uSpeed, 0.01);
      float nRef  = nFall + SPLASH_DUR_WATER;
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

      // Only ripple if impact is on a puddle tile
      vec2 nImpWorld = ncCoord * CELL + vec2(nImpX, nImpY);
      vec2 nImpTile = floor(nImpWorld / TILE);
      float nImpHash = hash(nImpTile + vec2(77.0, 131.0));
      if (nImpHash <= threshold) continue;
      if (uHasPuddleMask > 0.5) {
        vec2 pmUv = nImpWorld / uMapSize;
        if (pmUv.x < 0.0 || pmUv.x > 1.0 || pmUv.y < 0.0 || pmUv.y > 1.0) continue;
        if (texture2D(uPuddleMask, pmUv).r < 0.5) continue;
      }

      float fallDur = mix(0.55, 0.95, nr3c) * 0.85 / max(uSpeed, 0.01);
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

      ringA = max(ringA, a);
    }
  }
  if (ringA > 0.0) {
    col = mix(col, vec3(0.95, 0.97, 1.0), ringA * puddle);
  }

  if (uHasZoneMask > 0.5) {
    col = mix(src.rgb, col, zone);
  }

  gl_FragColor = vec4(col, src.a);
}
`;

export class PuddlePostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _time: number;
  private _intensity: number;
  private _speed: number;
  private _wind: number;
  private _puddleMaskTex: any;
  private _zoneMaskTex: any;
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
    this._speed      = 1.0;
    this._wind       = 0;
    this._puddleMaskTex = null;
    this._zoneMaskTex = null;
    this._mapW       = 1;
    this._mapH       = 1;
    this._cam        = null;
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) { this._cam = cam; }
  setTime(seconds: number)            { this._time = seconds; }
  setIntensity(v: number)             { this._intensity = Math.max(0, Math.min(1, v)); }
  setSpeed(mult: number)              { this._speed = Math.max(0.01, mult); }
  setWind(px: number)                 { this._wind = px; }
  setResolution(w: number, h: number) { this._resW = w; this._resH = h; }
  setScroll(x: number, y: number)     { this._scrollX = x; this._scrollY = y; }

  setPuddleMask(key: string, mapW: number, mapH: number) {
    this._mapW = Math.max(1, mapW);
    this._mapH = Math.max(1, mapH);
    if (!this.game.textures.exists(key)) { this._puddleMaskTex = null; return; }
    const frame = this.game.textures.getFrame(key);
    this._puddleMaskTex = frame?.glTexture ?? null;
  }

  clearPuddleMask() { this._puddleMaskTex = null; }

  setZoneMask(key: string, mapW: number, mapH: number) {
    this._mapW = Math.max(1, mapW);
    this._mapH = Math.max(1, mapH);
    if (!this.game.textures.exists(key)) { this._zoneMaskTex = null; return; }
    const frame = this.game.textures.getFrame(key);
    this._zoneMaskTex = frame?.glTexture ?? null;
  }

  clearZoneMask() { this._zoneMaskTex = null; }


  private _setUniforms(): void {
    const cam = this._cam;
    const sx  = cam ? cam.worldView.x : this._scrollX;
    const sy  = cam ? cam.worldView.y : this._scrollY;
    const rw = this._resW || this.renderer.width;
    const rh = this._resH || this.renderer.height;

    this.set2f('uResolution', rw, rh);
    this.set2f('uScroll',     sx, sy);
    this.set1f('uTime',       this._time);
    this.set1f('uIntensity',  this._intensity);
    this.set1f('uSpeed',      this._speed);
    this.set1f('uWind',       this._wind);
    this.set2f('uMapSize',    this._mapW, this._mapH);
    this.set1f('uHasPuddleMask', this._puddleMaskTex ? 1.0 : 0.0);
    this.set1f('uHasZoneMask',   this._zoneMaskTex ? 1.0 : 0.0);
    this.set1i('uPuddleMask', 1);
    this.set1i('uZoneMask',   2);
  }

  onPreRender(): void {
    this._setUniforms();
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    this.bind();
    this._setUniforms();
    if (this._puddleMaskTex) this.bindTexture(this._puddleMaskTex, 1);
    if (this._zoneMaskTex) this.bindTexture(this._zoneMaskTex, 2);
    this.bindAndDraw(renderTarget);
  }
}
