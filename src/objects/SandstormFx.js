import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';
import { SHADER_ASSET_KEYS } from '@/asset-key.js';

/**
 * Sandstorm weather. Texture-driven particle layer over a muddy-orange
 * scene tint. Mirrors the FogFx lifecycle (camera-attached pipeline,
 * world-anchored tiling, time-driven drift).
 */
export const SANDSTORM_VARIANTS = {
  sandstorm: {
    tint:             [0.55, 0.36, 0.18],
    tintAlpha:        0.45,
    desat:            0.20,
    particleColor:    [1.0, 0.78, 0.46],
    particleStrength: 0.85,
    drift:            80,
  },
};

export default class SandstormFx {
  constructor(scene, opts = {}) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(SHADER_KEYS.SANDSTORM);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.SANDSTORM);
    if (!this.pipeline) { this._dead = true; return; }

    this.pipeline.setCamera?.(this.camera);
    if (opts.tint)             this.pipeline.setTint?.(opts.tint[0], opts.tint[1], opts.tint[2]);
    if (opts.tintAlpha != null)        this.pipeline.setTintAlpha?.(opts.tintAlpha);
    if (opts.desat != null)            this.pipeline.setDesaturation?.(opts.desat);
    if (opts.particleColor)            this.pipeline.setParticleColor?.(opts.particleColor[0], opts.particleColor[1], opts.particleColor[2]);
    if (opts.particleStrength != null) this.pipeline.setParticleStrength?.(opts.particleStrength);
    if (opts.drift != null)            this.pipeline.setDrift?.(opts.drift);
    this.pipeline.setTexture?.(opts.texture ?? SHADER_ASSET_KEYS.SANDSTORM);

    this._timeSec = 0;
  }

  update(time /*, delta */) {
    if (this._destroyed || this._dead || !this.pipeline) return;
    this._timeSec = (time / 1000) % 1024;
    this.pipeline.setTime?.(this._timeSec);
    // World-pixel uResolution — see Darkness.js for the rationale.
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution?.(this.camera.width / zoom, this.camera.height / zoom);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      try { this.camera?.removePostPipeline(SHADER_KEYS.SANDSTORM); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
  }
}
