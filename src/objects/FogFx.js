import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';
import { SHADER_ASSET_KEYS } from '@/asset-key.js';

/** Cloud-noise textures FogFx randomly picks from when no explicit
 *  `texture` is given in opts. Add new entries here as new fog PNGs land. */
const FOG_TEXTURES = [
  SHADER_ASSET_KEYS.FOG_DIAGONAL,
  SHADER_ASSET_KEYS.FOG_HORIZONTAL,
];

/**
 * Atmospheric fog. The shader is procedural — two scrolling value-noise
 * layers in world space — so this controller just keeps time/scroll/
 * intensity uniforms current.
 *
 * Applied to the main camera (covers the whole viewport, including
 * characters). Mirrors the Darkness/RainFx teardown pattern.
 *
 * Variants table — extend as needed; per-zone weather pulls from this map.
 */
export const FOG_VARIANTS = {
  // drift = px/sec the texture sample advances horizontally; positive drives
  // the field right-to-left across the screen. Kept low for a calm-breeze feel.
  // Texture is randomized between the available fog PNGs at instantiation
  // (see FOG_TEXTURES below) — both variants share the same pool.
  // lightRadiusBoost = multiplier applied to every pointlight's radius while
  // fog is active (real fog scatters the glow over a larger area).
  fog:       { intensity: 0.55, color: [0.85, 0.88, 0.92], drift: 3, lightRadiusBoost: 1.5 },
  light_fog: { intensity: 0.30, color: [0.90, 0.93, 0.96], drift: 2, lightRadiusBoost: 1.5 },
};

export default class FogFx {
  constructor(scene, opts = {}) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(SHADER_KEYS.FOG);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.FOG);
    if (!this.pipeline) { this._dead = true; return; }

    this.pipeline.setCamera?.(this.camera);
    this.pipeline.setIntensity?.(opts.intensity ?? 0.55);
    if (opts.color) this.pipeline.setColor?.(opts.color[0], opts.color[1], opts.color[2]);
    this.pipeline.setDrift?.(opts.drift ?? 6);
    // Cloud-noise texture: caller can pin one via opts.texture, otherwise
    // randomise from FOG_TEXTURES so back-to-back zones don't always look
    // the same. Locked once per instance — switching mid-fog would visibly
    // pop. The variant is exposed via getTextureKey() for debug screens.
    this._textureKey = opts.texture ?? FOG_TEXTURES[Math.floor(Math.random() * FOG_TEXTURES.length)];
    this.pipeline.setTexture?.(this._textureKey);

    // Pointlight radius scaling — applied on first update() because lights
    // are created during plugin.init() AFTER FogFx itself is constructed.
    this._lightRadiusBoost = opts.lightRadiusBoost ?? 1.0;
    this._lightsBoosted    = false;
    this._timeSec = 0;
  }

  /** The cloud-noise texture key currently active on this fog instance. */
  getTextureKey() { return this._textureKey; }

  /**
   * Per-frame uniform refresh. Time drives the noise drift; scroll keeps
   * the pattern world-anchored as the camera pans (so banks of fog stay
   * parked over specific tiles instead of crawling with the viewport).
   */
  update(time /*, delta */) {
    if (this._destroyed || this._dead || !this.pipeline) return;
    // Wrap time to keep mediump-precision GPUs from drifting after long
    // sessions — same trick RainFx uses.
    this._timeSec = (time / 1000) % 1024;
    this.pipeline.setTime?.(this._timeSec);
    // World-pixel uResolution — see Darkness.js for the rationale.
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution?.(this.camera.width / zoom, this.camera.height / zoom);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);

    // Apply the radius boost on the first tick — by now plugin.init() has
    // run and the pointlights exist. We also tag the light so the boost
    // isn't double-applied (defensive against future re-entry).
    if (!this._lightsBoosted && this._lightRadiusBoost !== 1.0) {
      const lights = this.scene?.mapPlugins?.light?.getLights?.() ?? [];
      const m = this._lightRadiusBoost;
      for (const l of lights) {
        if (!l || l._fogBoosted) continue;
        l.radius *= m;
        if (l._darknessBase) l._darknessBase.radius *= m;
        l._fogBoosted = m;   // flag holds the multiplier for clean restore
      }
      this._lightsBoosted = true;
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      // Restore each light's radius to its pre-fog value. Read the stored
      // multiplier off the light itself rather than this._lightRadiusBoost
      // so a different fog instance with a different boost can hand off
      // cleanly during a per-zone weather swap.
      const lights = this.scene?.mapPlugins?.light?.getLights?.() ?? [];
      for (const l of lights) {
        if (!l?._fogBoosted) continue;
        l.radius /= l._fogBoosted;
        if (l._darknessBase) l._darknessBase.radius /= l._fogBoosted;
        l._fogBoosted = 0;
      }

      this.pipeline?.setCamera?.(null);
      try { this.camera?.removePostPipeline(SHADER_KEYS.FOG); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
  }
}
