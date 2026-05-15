import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';
import { SHADER_ASSET_KEYS } from '@/asset-key.js';

/**
 * Snow weather. Three independent flake pools layered for depth:
 *   - bulk (snow1, 288 flakes, fast small)
 *   - mid  (snow0,  96 flakes, medium speed + size)
 *   - hero (snow0,  24 flakes, slow + big foreground accents)
 * No cell grid — each flake roams the full screen with its own random
 * speed and downward angle. Mirrors the FogFx lifecycle.
 *
 * `density` gates each per-flake spawn. The `snow` variant runs at ~0.55
 * (about 225 active flakes), `heavy_snow` runs at 1.0 (all 408 active)
 * with faster fall, stronger drift, and a contrast boost on the map.
 */
export const SNOW_VARIANTS = {
  snow: {
    density:     0.55,   // fraction of each pool that actually spawns per cycle
    tint:        [0.82, 0.88, 0.96],
    tintAlpha:   0.12,
    desat:       0.10,
    flakeColor:  [1.0, 1.0, 1.0],
    fallSpeed:   60,     // base px/sec — bulk layer; mid/hero use 0.85×, 0.65× of this
    speedJitter: 0.35,
    maxDrift:    14,
    contrast:    1.0,
  },
  heavy_snow: {
    density:     1.0,    // every flake in every pool, every cycle (now 408 active)
    tint:        [0.78, 0.84, 0.92],
    tintAlpha:   0.22,
    desat:       0.20,
    flakeColor:  [1.0, 1.0, 1.0],
    fallSpeed:   170,    // 2.8× the standard snow speed — flakes whip past
    speedJitter: 0.30,
    maxDrift:    44,     // stormier wind — flakes slant hard
    contrast:    1.18,
  },
};

export default class SnowFx {
  constructor(scene, opts = {}) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;
    this._shaderKey = opts.shaderKey ?? SHADER_KEYS.SNOW;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(this._shaderKey);
    this.pipeline = this.camera.getPostPipeline(this._shaderKey);
    if (!this.pipeline) { this._dead = true; return; }
    this.pipeline.setCamera?.(this.camera);

    if (opts.density != null)   this.pipeline.setDensity?.(opts.density);
    if (opts.tint)              this.pipeline.setTint?.(opts.tint[0], opts.tint[1], opts.tint[2]);
    if (opts.tintAlpha != null) this.pipeline.setTintAlpha?.(opts.tintAlpha);
    if (opts.desat != null)     this.pipeline.setDesaturation?.(opts.desat);
    if (opts.flakeColor)        this.pipeline.setFlakeColor?.(opts.flakeColor[0], opts.flakeColor[1], opts.flakeColor[2]);
    if (opts.fallSpeed != null)   this.pipeline.setFallSpeed?.(opts.fallSpeed);
    if (opts.speedJitter != null) this.pipeline.setSpeedJitter?.(opts.speedJitter);
    if (opts.maxDrift != null)    this.pipeline.setMaxDrift?.(opts.maxDrift);
    if (opts.contrast != null)    this.pipeline.setContrast?.(opts.contrast);

    this.pipeline.setSnow0Texture?.(opts.snow0Texture ?? SHADER_ASSET_KEYS.SNOW_0);
    this.pipeline.setSnow1Texture?.(opts.snow1Texture ?? SHADER_ASSET_KEYS.SNOW_1);

    this._timeSec = 0;
  }

  update(time /*, delta */) {
    if (this._destroyed || this._dead || !this.pipeline) return;
    // Wrap time to keep mediump GPUs from drifting after long sessions.
    this._timeSec = (time / 1000) % 1024;
    this.pipeline.setTime?.(this._timeSec);
    // World-pixel uResolution — see Darkness.js for the rationale.
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution?.(this.camera.width / zoom, this.camera.height / zoom);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      try { this.camera?.removePostPipeline(this._shaderKey); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
  }
}
