import { SHADER_KEYS } from '@/shaders/keys.js';

/**
 * 4-camera compare grid for the time-of-day shader. Replaces the old sprite-
 * tint debug overlay so each panel actually runs the live TimeOverlay
 * pipeline — desaturation, tint, light-aware sat-recover all included — on
 * the same world view, with one preset forced per panel.
 *
 * Layout (chronological, left-to-right top-to-bottom):
 *   ┌──────────┬──────────┐
 *   │ Morning  │   Day    │
 *   ├──────────┼──────────┤
 *   │ Evening  │  Night   │
 *   └──────────┴──────────┘
 *
 * The main camera is reused for the first panel (Morning). The other three
 * are added as secondary cameras and torn down in destroy(), which also
 * removes the pipelines so the scene transitions cleanly.
 */

const PANEL_W = 400;
const PANEL_H = 300;

// Mirrors the live PRESETS in TimeOverlayFx so the compare grid is an
// accurate preview. Update both tables together. Order is chronological
// (Morning → Day → Evening → Night).
const PANELS = [
  { key: 'morning', x: 0,        y: 0,        tint: [0x00 / 255, 0x26 / 255, 0xb2 / 255],       alpha: 0.15, desat: 0.05 },
  { key: 'day',     x: PANEL_W,  y: 0,        tint: [0, 0, 0],                                  alpha: 0,    desat: 0.08 },
  { key: 'evening', x: 0,        y: PANEL_H,  tint: [0xdd / 255, 0x54 / 255, 0x16 / 255],       alpha: 0.15, desat: 0.15 },
  { key: 'night',   x: PANEL_W,  y: PANEL_H,  tint: [0x00 / 255, 0x26 / 255, 0xb2 / 255],       alpha: 0.35, desat: 0.40 },
];

export default class TimeOverlayDebug {
  constructor(scene, player) {
    this.scene = scene;
    this._destroyed = false;
    this._cameras   = [];
    this._pipelines = [];

    const smoothCam = !!scene.game.config.debug?.smoothCam;
    const lerp = smoothCam ? 0.3 : 1;
    const fox  = -(player.width  / 2);
    const foy  = -(player.height / 2);

    PANELS.forEach((p, i) => {
      let cam;
      if (i === 0) {
        // Reuse the main camera for the Day panel — Phaser's main camera is
        // already wired up by Interactables.Player (round-pixels, follow,
        // etc.), so just shrink its viewport into the top-left quadrant.
        cam = scene.cameras.main;
        cam.setViewport(p.x, p.y, PANEL_W, PANEL_H);
      } else {
        cam = scene.cameras.add(p.x, p.y, PANEL_W, PANEL_H);
        cam.startFollow(player, true, lerp, lerp);
        cam.setFollowOffset(fox, foy);
      }

      // Day panel: no shader needed; it's the neutral baseline.
      if (p.alpha === 0 && p.desat === 0) {
        this._cameras.push(cam);
        return;
      }

      cam.setPostPipeline(SHADER_KEYS.TIME_OVERLAY);
      const pipe = cam.getPostPipeline(SHADER_KEYS.TIME_OVERLAY);
      if (pipe) {
        pipe.setCamera?.(cam);
        pipe.setTint?.(p.tint[0], p.tint[1], p.tint[2]);
        pipe.setAlpha?.(p.alpha);
        pipe.setDesaturation?.(p.desat);
        this._pipelines.push({ cam, pipe });
      }
      this._cameras.push(cam);
    });

    this._lightBuf = [];
  }

  /**
   * Per-frame uniform refresh — pushes the live light list and each panel
   * camera's scroll/resolution to its own pipeline instance, so the
   * sat-recover effect tracks torches across all four panels at once.
   */
  update() {
    if (this._destroyed) return;

    const lightPlugin = this.scene.mapPlugins?.light;
    const lights      = lightPlugin?.getLights?.() ?? [];
    this._lightBuf.length = 0;
    for (const l of lights) {
      if (!l?.active) continue;
      this._lightBuf.push({ x: l.x, y: l.y, radius: l.radius * 0.6 });
    }

    for (let i = 0; i < this._pipelines.length; i++) {
      const { cam, pipe } = this._pipelines[i];
      pipe.setLights?.(this._lightBuf);
      // World-pixel uResolution — see Darkness.js for the rationale.
      const zoom = cam.zoom || 1;
      pipe.setResolution?.(cam.width / zoom, cam.height / zoom);
      pipe.setScroll?.(cam.scrollX, cam.scrollY);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Same shutdown caveat as Darkness/RainFx — don't poke camera lists once
    // Phaser begins its scene-shutdown sweep.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;

    if (!sceneDown) {
      for (let i = 0; i < this._pipelines.length; i++) {
        const { cam, pipe } = this._pipelines[i];
        pipe.setCamera?.(null);
        try { cam.removePostPipeline(SHADER_KEYS.TIME_OVERLAY); } catch (_) {}
      }
      // Skip index 0 — that's the main camera, leave it for Phaser to manage.
      for (let i = 1; i < this._cameras.length; i++) {
        try { this.scene.cameras.remove(this._cameras[i]); } catch (_) {}
      }
    }

    this._cameras   = null;
    this._pipelines = null;
    this._lightBuf  = null;
    this.scene      = null;
  }
}
