/**
 * Darkness post-FX pipeline.
 *
 * Per-pixel metaball field: each light contributes (r² / d²) to a summed
 * "field" value; pixels where the field exceeds a threshold are rendered as
 * the source scene, pixels below are pulled to black, and a `smoothstep`
 * around the threshold gives the liquid edge. When two lights' radii overlap,
 * their fields add and produce a connected, bulbous blob — the gooey
 * Pokémon-cave look without compositing tricks.
 *
 * Light data is packed as `vec3(x_world_px, y_world_px, radius_px)` in WORLD
 * pixel coordinates. The shader subtracts `uScroll` (camera scroll) per-pixel
 * so registered lights stay anchored in world space without the controller
 * having to recompute screen-local positions every frame.
 */

const MAX_LIGHTS = 16;

const frag = `
#define SHADER_NAME DARKNESS_LIQUID_POST_FX
#define MAX_LIGHTS ${MAX_LIGHTS}

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2  uResolution;
uniform vec2  uScroll;
uniform vec3  uLights[MAX_LIGHTS];
uniform int   uLightCount;
uniform float uThreshold;
uniform float uSoftness;

varying vec2 outTexCoord;

void main() {
  // Phaser's post-FX outTexCoord is Y-flipped (OpenGL framebuffer: Y=0 at
  // bottom, Y=1 at top). World Y in the game goes top-to-bottom, so without
  // flipping outTexCoord.y the metaball field drifts vertically as the camera
  // scrolls — making world-anchored lights appear to track the player on Y.
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 worldPx = uv * uResolution + uScroll;

  float field = 0.0;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec3 l = uLights[i];
    vec2 d = worldPx - l.xy;
    float distSq = dot(d, d) + 1.0;
    float r = l.z;
    field += (r * r) / distSq;
  }

  float lo  = uThreshold * (1.0 - uSoftness);
  float hi  = uThreshold * (1.0 + uSoftness);
  float lit = smoothstep(lo, hi, field);

  vec4 src = texture2D(uMainSampler, outTexCoord);
  gl_FragColor = vec4(src.rgb * lit, 1.0);
}
`;

export class DarknessPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly MAX_LIGHTS = MAX_LIGHTS;

  private _lightData: Float32Array;
  private _lightCount: number;
  private _threshold: number;
  private _softness: number;
  private _resW: number;
  private _resH: number;
  private _scrollX: number;
  private _scrollY: number;
  private _cam: Phaser.Cameras.Scene2D.Camera | null;

  constructor(game: Phaser.Game) {
    super({ game, fragShader: frag });
    this._lightData  = new Float32Array(MAX_LIGHTS * 3);
    this._lightCount = 0;
    this._threshold  = 1.0;
    this._softness   = 0.35;
    this._resW       = game.scale.width;
    this._resH       = game.scale.height;
    this._scrollX    = 0;
    this._scrollY    = 0;
    this._cam        = null;
  }

  setCamera(cam: Phaser.Cameras.Scene2D.Camera | null) {
    this._cam = cam;
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

  setThreshold(t: number) {
    this._threshold = t;
  }

  setSoftness(s: number) {
    this._softness = s;
  }

  setResolution(w: number, h: number) {
    this._resW = w;
    this._resH = h;
  }

  setScroll(x: number, y: number) {
    this._scrollX = x;
    this._scrollY = y;
  }

  onPreRender(): void {
    // Read scroll directly from the bound camera at render time rather than
    // from values cached during scene UPDATE — Phaser updates camera scroll
    // during its render phase, so any cached value set in UPDATE lags the
    // camera by one frame (worse under smooth follow). A one-pixel lag
    // manifests as the metaball field drifting out of sync with the rendered
    // tiles, making world-anchored lights appear to swim toward the player.
    const cam = this._cam;
    const sx = cam ? cam.scrollX : this._scrollX;
    const sy = cam ? cam.scrollY : this._scrollY;

    // uResolution must match the post-FX render target, not the camera viewport.
    // When the camera is sized larger than the canvas (e.g. setSize(800, 608)
    // inside an 800x600 canvas), Phaser still allocates a canvas-sized render
    // target for the post-FX pass, and outTexCoord runs 0..1 over THAT. Using
    // the camera's own size here would over-scale outTexCoord on the mismatched
    // axis and the metaball field would drift relative to scroll on that axis.
    const rt = this.renderTargets?.[0];
    const rw = rt?.width  ?? this.renderer.width  ?? this._resW;
    const rh = rt?.height ?? this.renderer.height ?? this._resH;

    this.set3fv('uLights', this._lightData);
    this.set1i('uLightCount', this._lightCount);
    this.set1f('uThreshold', this._threshold);
    this.set1f('uSoftness',  this._softness);
    this.set2f('uResolution', rw, rh);
    this.set2f('uScroll',     sx, sy);
  }
}
