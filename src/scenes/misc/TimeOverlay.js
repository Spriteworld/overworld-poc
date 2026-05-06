import Phaser from 'phaser';

/**
 * Canonical source of time-of-day state. Used to render a full-screen tinted
 * image; the visual now lives in TimeOverlayFx (post-FX shader on each map's
 * camera). This scene stays as a passive state holder so other systems
 * (Light plugin reads `time.day`, GameMap's TimeOverlayFx reads the whole
 * `time` object each frame) keep their existing API.
 *
 * The 4-quadrant debug grid (one viewport per time of day) was removed with
 * the visual overlay — turn `debug.tests.timeOverlay` into a different
 * harness if that comparison view is wanted again.
 */
// Debug compare grid — 2×2 panel labels overlaid on the canvas; the actual
// per-panel tint/desat/light-recover comes from TimeOverlayDebug, which
// resizes the main camera + adds 3 secondary cameras each running the
// TimeOverlay shader with a forced preset. Gated by `debug.tests.timeOverlay`.
const PANEL_W = 400;
const PANEL_H = 300;
const PANEL_LABELS = [
  { label: 'Morning', x: 0,        y: 0       },
  { label: 'Day',     x: PANEL_W,  y: 0       },
  { label: 'Evening', x: 0,        y: PANEL_H },
  { label: 'Night',   x: PANEL_W,  y: PANEL_H },
];
const LABEL_STYLE = { fontSize: '32px', fill: '#000', stroke: '#000', strokeThickness: 2 };

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'TimeOverlay' });
    this.time = forcedTime() ?? computeTime();
  }

  create() {
    if (!this.game.config.debug?.tests?.timeOverlay) return;
    if (this.game.scene.getScenes(true).some(s => s.config?.inside === true)) return;

    PANEL_LABELS.forEach(p => {
      this.add.text(p.x + 16, p.y + 16, p.label, LABEL_STYLE);
    });
  }

  update() {
    // Resolution order, highest priority first:
    //   1. `debug.forceTimeOfDay` (test-harness pin) — explicit override.
    //   2. Harsh-sunlight weather on any active map scene — implicitly day,
    //      so the TimeOverlay shader doesn't paint a sunset/night tint over
    //      what's supposed to read as midday glare. Light plugin's
    //      `time.day` check also falls into line so torches don't fire.
    //   3. Real-world clock (default).
    const forced = this.game.config.debug?.forceTimeOfDay;
    if (forced) {
      this.time = forcedFlags(forced);
      return;
    }
    const sunlightActive = this.game.scene.getScenes(true).some(s => s.sunlightFx);
    if (sunlightActive) {
      this.time = forcedFlags('day');
      return;
    }
    this.time = computeTime();
  }
}

function forcedFlags(key) {
  return {
    morning: key === 'morning',
    day:     key === 'day',
    evening: key === 'evening',
    night:   key === 'night',
  };
}

/** Read `debug.forceTimeOfDay` (if set) at construction time. */
function forcedTime() {
  // Phaser's global game config isn't available in the scene constructor,
  // but Phaser.GAMES holds boot-completed games; for early-construction
  // safety we look it up if present.
  const game = (typeof Phaser !== 'undefined' && Phaser.GAMES && Phaser.GAMES[0]) || null;
  const forced = game?.config?.debug?.forceTimeOfDay;
  if (!forced) return null;
  return {
    morning: forced === 'morning',
    day:     forced === 'day',
    evening: forced === 'evening',
    night:   forced === 'night',
  };
}

/** Map real-world clock to a {morning, day, evening, night} flag set. */
function computeTime() {
  const hour = new Date().getHours();
  const mins = new Date().getMinutes();
  return {
    morning: (hour >= 7  && (hour <= 10 && mins <= 59)),
    day:     (hour >= 11 && (hour <= 18 && mins <= 59)),
    evening: (hour >= 19 && (hour <= 21 && mins <= 59)),
    night:   (hour >= 22 || (hour <= 6  && mins <= 59)),
  };
}
