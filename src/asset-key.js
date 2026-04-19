/**
 * Phaser texture keys for the gradient PNGs that drive the battle-start
 * transition shader (`GradientTexturePostFxPipeline`).
 *
 * Each gradient is sampled by `gradient-texture-post-fx-pipeline.ts` — the
 * shader compares each pixel's red channel against `uCutoff` and outputs
 * black where `red < uCutoff`, source pixel otherwise. So:
 *
 *   - Use a GREYSCALE PNG (red == green == blue per pixel).
 *   - Darker pixels get hidden first; brighter pixels get hidden last.
 *   - Aspect ratio should roughly match the camera (we render at 800×600);
 *     the shader samples in normalised UV (0–1) so the image is stretched
 *     to fill, not tiled.
 *
 * To add a new transition: drop a PNG into `src/assets/shader/`, add a key
 * here, load it in `src/scenes/misc/Preload.js`, and call
 * `pipeline.setTexture(SHADER_ASSET_KEYS.NEW_KEY)` from
 * `src/utilities/battleTransition.js` (or anywhere else).
 */
export const SHADER_ASSET_KEYS = {
  WIPE:          'shader_wipe',
  WIPE_DIAGONAL: 'shader_wipe_diagonal',
  WIPE_VERTICAL: 'shader_wipe_vertical',
  CLOSE_BARS:    'shader_close_bars',
  TRAPPED:       'shader_trapped',
};
