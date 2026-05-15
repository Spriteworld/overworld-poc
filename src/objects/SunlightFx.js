import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';

/**
 * Harsh-sunlight weather. Static colour grade — contrast boost, brightness
 * lift, warm highlight tint. No per-frame animation; uniforms set once at
 * construction.
 *
 * Mirrors the RainFx / FogFx lifecycle (camera-attached pipeline, swapped
 * in/out by the weather dispatcher when the player crosses a zone).
 */
export const SUNLIGHT_VARIANTS = {
  harsh_sunlight: {
    intensity:       0.85,
    tint:            [1.0, 0.92, 0.78],
    contrast:        2.5,
    brightness:      0.25,
    highlightWarmth: 0.6,
  },
};

export default class SunlightFx {
  constructor(scene, opts = {}) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(SHADER_KEYS.SUNLIGHT);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.SUNLIGHT);
    if (!this.pipeline) { this._dead = true; return; }

    this.pipeline.setCamera?.(this.camera);
    if (opts.intensity       != null) this.pipeline.setIntensity?.(opts.intensity);
    if (opts.tint)                    this.pipeline.setTint?.(opts.tint[0], opts.tint[1], opts.tint[2]);
    if (opts.contrast        != null) this.pipeline.setContrast?.(opts.contrast);
    if (opts.brightness      != null) this.pipeline.setBrightness?.(opts.brightness);
    if (opts.highlightWarmth != null) this.pipeline.setHighlightWarmth?.(opts.highlightWarmth);
  }

  update() {
    if (this._destroyed || !this.pipeline || !this.camera) return;
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution(this.camera.width / zoom, this.camera.height / zoom);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      try { this.camera?.removePostPipeline(SHADER_KEYS.SUNLIGHT); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
  }
}
