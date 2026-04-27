/**
 * Lazy-load a 4x4 overworld spritesheet, auto-deriving frame size from the
 * image's intrinsic dimensions. Every overworld sheet (characters and
 * pokemon) is laid out as 4 cols x 4 rows, so frameWidth = imageWidth / 4
 * and frameHeight = imageHeight / 4. This handles the 128x192 (32x48)
 * trainer sheets, the wider 192x192 (48x48, e.g. old_man_lying_down,
 * *_bike), the 256x256 (64x64, base_surf and most pokemon), and the larger
 * 512x512 (128x128) pokemon variants without per-texture overrides.
 *
 * Probes dimensions via an in-memory Image so we can pass the right frame
 * size to Phaser's loader before it slices the sheet. Floors the divisions
 * defensively in case of an odd-pixel asset.
 *
 * @param {Phaser.Scene} scene
 * @param {string} key   - texture key to register
 * @param {string} url   - resolved sprite URL
 * @returns {Promise<{frameWidth:number, frameHeight:number}>} resolves once
 *   the spritesheet is in the texture cache, with the derived frame size.
 */
export function loadOverworldSpritesheet(scene, key, url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!scene.sys) return resolve({ frameWidth: 0, frameHeight: 0 });
      const frameWidth  = Math.floor(img.width  / 4);
      const frameHeight = Math.floor(img.height / 4);
      scene.load.spritesheet(key, url, { frameWidth, frameHeight });
      scene.load.once('filecomplete-spritesheet-' + key, () => resolve({ frameWidth, frameHeight }));
      scene.load.once('loaderror', (file) => {
        if (file?.key === key) reject(new Error('failed to load ' + key));
      });
      scene.load.start();
    };
    img.onerror = () => reject(new Error('failed to probe ' + url));
    img.src = url;
  });
}
