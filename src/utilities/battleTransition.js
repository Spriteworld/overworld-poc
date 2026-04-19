import { SHADER_KEYS } from '@/shaders';
import { SHADER_ASSET_KEYS } from '@/asset-key.js';

/**
 * Tween duration (ms) for the closing-in / fade-out half of a battle-start
 * transition. The original engine used a 240ms three-flash; this is
 * intentionally a touch slower so the gradient effect has time to register.
 */
const TRANSITION_DURATION_MS = 600;

/**
 * Run a battle-start transition by attaching the gradient PostFX pipeline to
 * the map scene's main camera, swapping the gradient texture for this battle
 * (wild → `WIPE`, trainer → `CLOSE_BARS`), tweening `progress` (the shader's
 * `uCutoff`) 0 → 1, then invoking `onMidpoint` when the screen is fully
 * obscured. The pipeline is detached before `onMidpoint` runs so callers can
 * safely `scene.sleep(map)` and launch the battle scene without the pipeline
 * lingering on the wake-up render.
 *
 * Adding a new effect = drop a PNG into `src/assets/shader/`, register it in
 * `src/asset-key.js` + `src/scenes/misc/Preload.js`, switch the `gradientKey`
 * line below.
 *
 * @param {Phaser.Scene} mapScene  - Active map scene whose camera renders the overworld.
 * @param {object}       opts
 * @param {boolean}     [opts.isTrainer]  - true → CLOSE_BARS gradient (Gen 3 trainer style); false → WIPE.
 * @param {number}      [opts.duration]   - tween duration in ms (default 600).
 * @param {() => void}  [opts.onMidpoint] - fired when progress hits 1; safe to swap scenes here.
 */
export function playBattleStartTransition(mapScene, opts = {}) {
  const { isTrainer = false, duration = TRANSITION_DURATION_MS, onMidpoint } = opts;
  const camera = mapScene?.cameras?.main;
  if (!camera) { onMidpoint?.(); return; }

  const gradientKey = isTrainer ? SHADER_ASSET_KEYS.CLOSE_BARS : SHADER_ASSET_KEYS.WIPE;
  console.log('[battleTransition] start', { isTrainer, gradientKey });

  // Phaser warns and no-ops if the pipeline class wasn't registered. Bail
  // gracefully so a missing-pipeline misconfig doesn't break battles.
  let pipeline;
  try {
    camera.setPostPipeline(SHADER_KEYS.GRADIENT);
    const got = camera.getPostPipeline(SHADER_KEYS.GRADIENT);
    // Phaser returns either a single instance OR an array when multiple
    // pipelines share a key. Always grab the latest (top of the stack).
    pipeline = Array.isArray(got) ? got[got.length - 1] : got;
  } catch (_) { pipeline = null; }

  if (!pipeline || typeof pipeline.setTexture !== 'function') {
    console.warn('[battleTransition] pipeline missing or wrong shape', pipeline);
    onMidpoint?.();
    return;
  }
  pipeline.setTexture(gradientKey);
  pipeline.progress = 0;

  mapScene.tweens.addCounter({
    from:     0,
    to:       1,
    duration,
    onUpdate: (tween) => { pipeline.progress = tween.getValue(); },
    onComplete: () => {
      pipeline.progress = 1;
      // Detach before the map sleeps — otherwise the post-FX would re-apply
      // to whatever is on the camera when the map wakes up after the battle.
      try { camera.resetPostPipeline(); } catch (_) {}
      onMidpoint?.();
    },
  });
}
