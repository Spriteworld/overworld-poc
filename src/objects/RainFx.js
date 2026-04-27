import Phaser from 'phaser';
import { SHADER_KEYS } from '@/shaders/keys.js';

/**
 * Preset RainFx configs keyed by Tiled `weather_type` enum value. Drop a
 * variant in here to wire it up — both GameMap.loadMap (top-level
 * weather_type) and KantoWorld._checkForWeather (per-zone weather_type)
 * resolve through this table.
 */
export const RAIN_VARIANTS = {
  light_rain: { intensity: 0.22, tint: [0.55, 0.62, 0.74], windScale: 0.6, speed: 1.0, desaturation: 0.0  },
  heavy_rain: { intensity: 0.70, tint: [0.32, 0.40, 0.52], windScale: 1.6, speed: 1.8, desaturation: 0.30 },
};

/**
 * Atmospheric rain effect. The shader is procedural — no textures, no
 * particles, just a hash-driven cell grid in world space — so this controller
 * only needs to keep the time/scroll/intensity uniforms current.
 *
 * Applied to the main camera (rain covers the whole viewport, including
 * characters). Mirrors the Darkness teardown pattern to avoid mid-shutdown
 * pipeline list mutations.
 */
export default class RainFx {
  constructor(scene, opts = {}) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(SHADER_KEYS.RAIN);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.RAIN);
    if (!this.pipeline) { this._dead = true; return; }

    this.pipeline.setCamera?.(this.camera);
    this.setIntensity(opts.intensity ?? 0.45);
    if (opts.tint) this.pipeline.setTint?.(opts.tint[0], opts.tint[1], opts.tint[2]);
    this.pipeline.setSpeed?.(opts.speed ?? 1.0);
    this.pipeline.setDesaturation?.(opts.desaturation ?? 0);
    // windScale: 1.0 = baseline gust amplitude (~±15 px). Heavier weather
    // can push this up; light drizzle drops it.
    this._windScale = opts.windScale ?? 1.0;

    // Hand off the water mask (if WaterFx built one for this scene) so the
    // shader can paint a bigger, longer-lived splash on water tiles. WaterFx
    // is constructed before RainFx in GameMap.loadMap, so by now the texture
    // is registered if it's going to exist at all.
    const wfx = scene.waterFx;
    const maskKey = wfx?.getMaskKey?.();
    if (maskKey) {
      const [mw, mh] = wfx.getMapSize();
      this.pipeline.setWaterMask?.(maskKey, mw, mh);
    }

    this._timeSec = 0;
  }

  setIntensity(v) { this.pipeline?.setIntensity?.(v); }

  /**
   * Per-frame uniform refresh. Time drives the drop fall + splash cycle;
   * scroll keeps the cell grid world-anchored as the camera pans; wind is
   * three layered slow sines summed together — gives a "random" gust feel
   * without an actual RNG (smooth between frames, never the same twice in
   * a row, no abrupt direction changes).
   */
  update(time /*, delta */) {
    if (this._destroyed || this._dead || !this.pipeline) return;
    // Wrap uTime to keep mediump-precision GPUs (mobile) from drifting into
    // the territory where (uTime + cellPhase) loses sub-second resolution.
    // 1024 was picked to harmonise with the in-shader cycleIdx mod so per-cell
    // wraps line up with cycle boundaries — minimises the visible jump.
    this._timeSec = (time / 1000) % 1024;

    const t = this._timeSec;
    const wind = (
        Math.sin(t * 0.13)             * 9.0 +   // slow base sway, ~48s period
        Math.sin(t * 0.31 + 1.7)       * 4.0 +   // mid gust
        Math.sin(t * 0.79 + 0.4)       * 2.0     // quick flutter
    ) * this._windScale;
    // Total baseline amplitude is ~±15 px; windScale scales it (light <1, heavy >1).

    this.pipeline.setTime?.(this._timeSec);
    // World-pixel uResolution — see Darkness.js for the rationale.
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution?.(this.camera.width / zoom, this.camera.height / zoom);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
    this.pipeline.setWind?.(wind);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Same shutdown caveat as Darkness/WaterFx — don't mutate the camera's
    // pipeline list once Phaser starts its scene-shutdown sweep.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      try { this.camera?.removePostPipeline(SHADER_KEYS.RAIN); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
  }
}
