import Phaser from 'phaser';
import { SHADER_KEYS } from '@/shaders/keys.js';
import debug from '@Data/debug.js';

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
    this._shaderKey = opts.shaderKey ?? SHADER_KEYS.RAIN;

    if (!this.camera) { this._dead = true; return; }

    this.camera.setPostPipeline(this._shaderKey);
    this.pipeline = this.camera.getPostPipeline(this._shaderKey);
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

    this._puddleMaskKey = null;
    this._puddleMaskRT = null;
    this._puddleTarget = null;
    this._buildPuddleMask(scene, opts);

    this._timeSec = 0;
  }

  _buildPuddleMask(scene, opts) {
    // Puddles render on the subground layer (the visible walkable surface).
    // Fall back to floor if no subground exists.
    const surface = scene.tilemaps?.subground ?? scene.tilemaps?.floor;
    if (!surface) return;

    const tilemap = scene.config.tilemap;
    const mapW = tilemap.widthInPixels;
    const mapH = tilemap.heightInPixels;
    const waterProp = 'sw_water';

    // Block tiles covered by layers above the surface
    const blocked = new Set();
    ['ground', 'middle', 'top'].forEach(name => {
      const layer = scene.tilemaps?.[name];
      if (!layer) return;
      layer.forEachTile(t => {
        if (t?.index >= 0) blocked.add(`${t.x},${t.y}`);
      });
    });

    const gfx = scene.make.graphics({ add: false });
    gfx.fillStyle(0xffffff, 1);
    let count = 0;

    surface.forEachTile(t => {
      if (t?.index >= 0 && !t?.properties?.[waterProp] && !blocked.has(`${t.x},${t.y}`)) {
        gfx.fillRect(t.pixelX, t.pixelY, t.width, t.height);
        count++;
      }
    });

    if (count === 0) { gfx.destroy(); return; }

    const key = `_puddle_mask_${scene.sys.settings.key}_${this._shaderKey}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);

    const rt = scene.add.renderTexture(0, 0, mapW, mapH);
    rt.setVisible(false);
    rt.draw(gfx, 0, 0);
    rt.saveTexture(key);
    gfx.destroy();

    this._puddleMaskKey = key;
    this._puddleMaskRT = rt;
    this.pipeline.setPuddleMask?.(key, mapW, mapH);

    // Apply puddle post-FX to the surface layer (subground or floor).
    // Game-object post-FX renders under characters naturally.
    this._puddleTarget = surface;
    surface.setPostPipeline(SHADER_KEYS.PUDDLE);
    const pp = surface.getPostPipeline(SHADER_KEYS.PUDDLE);
    this._puddlePipeline = Array.isArray(pp) ? pp[0] : pp;
    if (this._puddlePipeline) {
      this._puddlePipeline.setCamera?.(this.camera);
      this._puddlePipeline.setPuddleMask?.(key, mapW, mapH);
      this._puddlePipeline.setIntensity?.(opts.intensity ?? 0.45);
      this._puddlePipeline.setSpeed?.(opts.speed ?? 1.0);
    }

    if (debug.puddleFxMask) {
      rt.setVisible(true);
      rt.setAlpha(0.4);
      rt.setTint(0x00ff88);
      rt.setDepth(9999);
    }
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
    const zoom = this.camera.zoom || 1;
    const resW = this.camera.width / zoom;
    const resH = this.camera.height / zoom;
    this.pipeline.setResolution?.(resW, resH);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
    this.pipeline.setWind?.(wind);

    if (this._puddlePipeline) {
      this._puddlePipeline.setTime?.(this._timeSec);
      this._puddlePipeline.setResolution?.(resW, resH);
      this._puddlePipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
      this._puddlePipeline.setWind?.(wind);
    }

  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      try { this.camera?.removePostPipeline(this._shaderKey); } catch (_) {}
      if (this._puddleTarget) {
        try { this._puddleTarget.removePostPipeline(SHADER_KEYS.PUDDLE); } catch (_) {}
      }
    }

    if (this._puddleMaskKey && this.scene?.textures?.exists(this._puddleMaskKey)) {
      try { this.scene.textures.remove(this._puddleMaskKey); } catch (_) {}
    }
    this._puddleMaskRT?.destroy();
    this._puddleMaskRT = null;

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
    this._puddlePipeline = null;
    this._puddleTarget = null;
  }
}
