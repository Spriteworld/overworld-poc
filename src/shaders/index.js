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

export const SHADER_KEYS = {
  GRADIENT: 'fx_gradient',
};

const PIPELINES = [
  [SHADER_KEYS.GRADIENT, GradientTexturePostFxPipeline],
];

export function registerBattlePipelines(game) {
  const mgr = game?.renderer?.pipelines;
  if (!mgr || typeof mgr.addPostPipeline !== 'function') return;
  for (const [key, Pipeline] of PIPELINES) {
    if (mgr.has?.(key)) continue;  // re-registration is fatal in Phaser
    mgr.addPostPipeline(key, Pipeline);
  }
}
