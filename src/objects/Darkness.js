import Phaser from 'phaser';
import { EventBus } from '@Utilities';
import * as Tile from './Tile.js';
import store from '../store/index.js';
import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';

const BASE_RADIUS_TILES  = 2.5;
const FLASH_RADIUS_TILES = 7.0;
const FLASH_TWEEN_MS     = 500;

export default class Darkness {
  constructor(scene) {
    this.scene         = scene;
    this.flashUsed     = false;
    this.currentRadius = BASE_RADIUS_TILES * Tile.WIDTH;

    this.camera = scene.cameras.main;
    this.camera.setPostPipeline(SHADER_KEYS.DARKNESS);
    this.pipeline = this.camera.getPostPipeline(SHADER_KEYS.DARKNESS);
    this.pipeline?.setCamera?.(this.camera);

    // Reusable scratch buffer to avoid per-frame allocations.
    this._lightBuf = [];
    this._lightSpecs = [
      {
        getX: () => {
          const p = scene.registry.get('player');
          if (!p) return null;
          const c = p.getCenter ? p.getCenter() : { x: p.x, y: p.y };
          return c.x;
        },
        getY: () => {
          const p = scene.registry.get('player');
          if (!p) return null;
          const c = p.getCenter ? p.getCenter() : { x: p.x, y: p.y };
          return c.y;
        },
        getRadius: () => this.currentRadius,
      },
    ];

    this._onFlash  = this._onFlash.bind(this);
    this._onUpdate = this._onUpdate.bind(this);
    EventBus.on('use-flash', this._onFlash);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this._onUpdate);

    // TODO: replace with move-menu trigger once the in-game menu lands.
    this._fKey = scene.input.keyboard?.addKey('F');
  }

  registerLight(getX, getY, getRadius) {
    if (this._destroyed) return null;
    const spec = { getX, getY, getRadius };
    this._lightSpecs.push(spec);
    return spec;
  }

  unregisterLight(spec) {
    if (this._destroyed || !spec) return;
    const idx = this._lightSpecs.indexOf(spec);
    if (idx >= 0) this._lightSpecs.splice(idx, 1);
  }

  setZoneMask(key, mapW, mapH) {
    this.pipeline?.setZoneMask?.(key, mapW, mapH);
  }

  useFlash() {
    if (this.flashUsed || this._destroyed) return;
    this.flashUsed = true;
    this.setRadius(FLASH_RADIUS_TILES * Tile.WIDTH, FLASH_TWEEN_MS);
  }

  /**
   * Set the player's light radius. Optionally tweens over `duration` ms.
   * @param {number} pixels - Target radius in pixels.
   * @param {number} [duration=0] - Tween duration in ms; 0 sets instantly.
   * @param {() => void} [onComplete] - Called when the tween/set finishes.
   */
  setRadius(pixels, duration = 0, onComplete) {
    if (this._destroyed) { onComplete?.(); return; }
    if (!(duration > 0)) {
      this.currentRadius = pixels;
      onComplete?.();
      return;
    }
    this.scene.tweens.add({
      targets:       this,
      currentRadius: pixels,
      duration,
      ease:          'Quad.easeOut',
      onComplete,
    });
  }

  _onFlash() {
    this.useFlash();
  }

  _onUpdate() {
    if (this._destroyed || !this.pipeline) return;

    if (this._fKey && Phaser.Input.Keyboard.JustDown(this._fKey)) {
      if (store.state.game.gameFlags?.has_flash) {
        EventBus.emit('use-flash');
      }
    }

    this._lightBuf.length = 0;
    for (const spec of this._lightSpecs) {
      const x = spec.getX();
      const y = spec.getY();
      const r = spec.getRadius();
      if (!Number.isFinite(x) || !Number.isFinite(y) || !(r > 0)) continue;
      this._lightBuf.push({ x, y, radius: r });
    }
    this.pipeline.setLights(this._lightBuf);
    // Pass the WORLD-pixel size visible through the camera, not the screen-pixel
    // viewport size. Shaders compute `worldPx = uv * uResolution + uScroll` and
    // uScroll is in world pixels — passing the screen size would over-scale by
    // the zoom factor and offset world-anchored effects (e.g. light positions).
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution(this.camera.width / zoom, this.camera.height / zoom);
    this.pipeline.setScroll(this.camera.scrollX, this.camera.scrollY);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    EventBus.off('use-flash', this._onFlash);
    this.scene?.events?.off(Phaser.Scenes.Events.UPDATE, this._onUpdate);

    // Mirrors Reflection.destroy(): when the scene is already tearing down,
    // mutating the camera's pipeline list can splice into Phaser's in-flight
    // sweep. The pipeline is camera-scoped and gets cleaned up automatically.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;
    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      this.camera?.removePostPipeline(SHADER_KEYS.DARKNESS);
    }

    this.camera     = null;
    this.pipeline   = null;
    this._lightBuf  = null;
    this._lightSpecs = null;
    this.scene      = null;
  }
}
