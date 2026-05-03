/**
 * Battle / scene-transition post-FX pipelines.
 *
 * After Simoes part 2 we use a single gradient-texture-sampling shader for
 * every transition; visual variety comes from swapping the gradient PNG via
 * `pipeline.setTexture(SHADER_ASSET_KEYS.X)`. See `src/asset-key.js` for the
 * texture key registry, `src/scenes/misc/Preload.js` for asset loading, and
 * `src/utilities/battleTransition.js` for the per-battle picker.
 *
 * Vite (esbuild) compiles the .ts pipeline class for us — no extra config.
 */

import { GradientTexturePostFxPipeline } from './gradient-texture-post-fx-pipeline';
import { DarknessPostFxPipeline } from './darkness-post-fx-pipeline';
import { WaterPostFxPipeline } from './water-post-fx-pipeline';
import { RainPostFxPipeline } from './rain-post-fx-pipeline';
import { FogPostFxPipeline } from './fog-post-fx-pipeline';
import { SandstormPostFxPipeline } from './sandstorm-post-fx-pipeline';
import { SnowPostFxPipeline } from './snow-post-fx-pipeline';
import { SunlightPostFxPipeline } from './sunlight-post-fx-pipeline';
import { PuddlePostFxPipeline } from './puddle-post-fx-pipeline';
import { TimeOverlayPostFxPipeline } from './time-overlay-post-fx-pipeline';
import { SHADER_KEYS } from './keys.js';

export { SHADER_KEYS };

const PIPELINES = [
  [SHADER_KEYS.GRADIENT,     GradientTexturePostFxPipeline],
  [SHADER_KEYS.DARKNESS,     DarknessPostFxPipeline],
  [SHADER_KEYS.WATER,        WaterPostFxPipeline],
  [SHADER_KEYS.RAIN,         RainPostFxPipeline],
  [SHADER_KEYS.HEAVY_RAIN,   RainPostFxPipeline],
  [SHADER_KEYS.FOG,          FogPostFxPipeline],
  [SHADER_KEYS.SANDSTORM,    SandstormPostFxPipeline],
  [SHADER_KEYS.SNOW,         SnowPostFxPipeline],
  [SHADER_KEYS.HEAVY_SNOW,   SnowPostFxPipeline],
  [SHADER_KEYS.SUNLIGHT,     SunlightPostFxPipeline],
  [SHADER_KEYS.PUDDLE,       PuddlePostFxPipeline],
  [SHADER_KEYS.TIME_OVERLAY, TimeOverlayPostFxPipeline],
];

export function registerBattlePipelines(game) {
  const mgr = game?.renderer?.pipelines;
  if (!mgr || typeof mgr.addPostPipeline !== 'function') return;
  for (const [key, Pipeline] of PIPELINES) {
    if (mgr.has?.(key)) continue;  // re-registration is fatal in Phaser
    mgr.addPostPipeline(key, Pipeline);
  }
}
