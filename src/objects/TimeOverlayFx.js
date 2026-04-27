import { SHADER_KEYS } from '@/shaders/keys.js';

/**
 * Per-scene time-of-day tint. Replaces the old TimeOverlay scene's full-
 * screen image with a post-FX pipeline applied to the main camera.
 *
 * Reads the canonical time state off the (now visual-less) TimeOverlay scene
 * — keeping that scene as the single source of truth means the Light plugin
 * (which reads `time.day` directly from it) keeps working unchanged.
 *
 * Outdoor maps only — instantiation is gated by `config.inside` in GameMap.
 */

// Same tints/alphas the old TimeOverlay image used; desaturation is new.
// Night drains the most colour (cones don't fire well in low light), evening
// drops a touch as the sun sets. Day gets a faint baseline desat so raw
// pixel-art chroma doesn't punch out of the time cycle.
const PRESETS = {
  morning: { tint: [0x00 / 255, 0x26 / 255, 0xb2 / 255], alpha: 0.15, desat: 0.05 },
  day:     { tint: [0,           0,           0          ], alpha: 0,    desat: 0.08 },
  evening: { tint: [0xdd / 255, 0x54 / 255, 0x16 / 255], alpha: 0.15, desat: 0.15 },
  night:   { tint: [0x00 / 255, 0x26 / 255, 0xb2 / 255], alpha: 0.35, desat: 0.40 },
};

export default class TimeOverlayFx {
  constructor(scene) {
    this.scene  = scene;
    this.camera = scene.cameras?.main ?? null;
    this._destroyed = false;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(SHADER_KEYS.TIME_OVERLAY);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.TIME_OVERLAY);
    if (!this.pipeline) { this._dead = true; return; }

    this.pipeline.setCamera?.(this.camera);

    // Reusable scratch list for the per-frame light push — avoids reallocating.
    this._lightBuf = [];

    // Start at zero alpha — first update() call resolves the actual preset.
    this._currentKey = null;
  }

  /**
   * Per-frame: pick the preset matching the canonical time state and push
   * it to the pipeline. Cheap to call every frame — the pipeline only runs
   * its mix when alpha > 0, so daytime pays nothing extra.
   */
  update() {
    if (this._destroyed || this._dead || !this.pipeline) return;

    const time = this.scene.scene?.get?.('TimeOverlay')?.time;
    let key = 'day';
    if      (time?.morning) key = 'morning';
    else if (time?.evening) key = 'evening';
    else if (time?.night)   key = 'night';

    if (key !== this._currentKey) {
      const p = PRESETS[key];
      this.pipeline.setTint?.(p.tint[0], p.tint[1], p.tint[2]);
      this.pipeline.setAlpha?.(p.alpha);
      this.pipeline.setDesaturation?.(p.desat);
      this._currentKey = key;
    }

    // Push the live light list every frame — pointlights tween radius and
    // the player can move around so positions are always live. Same 0.6×
    // radius factor the Darkness overlay uses (the metaball field reads
    // tighter than the glow's visual extent).
    const lightPlugin = this.scene.mapPlugins?.light;
    const lights      = lightPlugin?.getLights?.() ?? [];
    this._lightBuf.length = 0;
    for (const l of lights) {
      if (!l?.active) continue;
      this._lightBuf.push({ x: l.x, y: l.y, radius: l.radius * 0.6 });
    }
    this.pipeline.setLights?.(this._lightBuf);
    this.pipeline.setResolution?.(this.camera.width, this.camera.height);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Mirror the shutdown caveat from Darkness/RainFx: don't poke the
    // camera's pipeline list once the scene is shutting down.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      try { this.camera?.removePostPipeline(SHADER_KEYS.TIME_OVERLAY); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
    this._lightBuf = null;
  }
}
