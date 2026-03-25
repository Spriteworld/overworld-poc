import Phaser from 'phaser';

/**
 * Reusable Phaser Container that displays a Pokémon icon from
 * src/tileset/pokemon/icons/ (32×32 static PNGs).
 *
 * Handles lazy texture loading, shiny variants (front/shiny/),
 * female variants (-female suffix), and formes (-<forme> suffix).
 *
 * Usage:
 *   const sprite = new PokemonSprite(scene, x, y, { species: 4, size: 64 });
 *   parentContainer.add(sprite);
 *
 * Props:
 *   species {number}  - National Dex ID
 *   shiny   {boolean} - Show shiny variant (default false)
 *   gender  {string}  - 'male' | 'female' — uses -female suffix when available
 *   forme   {string}  - Forme name, e.g. 'plant' — uses -<forme> suffix when available
 *   size    {number}  - Display size in pixels (square, default 64)
 */
export default class PokemonSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { species, shiny = false, gender = null, forme = null, size = 64 } = {}) {
    super(scene, x, y);

    this._size = size;

    // Build the variant-aware filename stem — icons use plain dex number ('1', '4')
    const base   = String(species);
    const suffix = forme ? `-${forme}`
                 : gender === 'female' ? '-female'
                 : '';
    this._key  = `pkmn-icon-${base}${suffix}${shiny ? '-shiny' : ''}`;
    this._path = shiny
      ? new URL('../tileset/pokemon/front/shiny/' + base + suffix + '.png', import.meta.url).href
      : new URL('../tileset/pokemon/icons/'       + base + suffix + '.png', import.meta.url).href;

    // Fallback (base, no variant) used if the specific variant file is missing
    this._fallbackKey  = `pkmn-icon-${base}`;
    this._fallbackPath = new URL('../tileset/pokemon/icons/' + base + '.png', import.meta.url).href;

    // Ultimate fallback: unknown Pokémon silhouette (species 0)
    this._unknownKey  = 'pkmn-icon-unknown';
    this._unknownPath = new URL('../tileset/pokemon/front/0.png', import.meta.url).href;

    // Placeholder while loading
    this._placeholder = scene.add.graphics();
    this._placeholder.fillStyle(0xe0e8f0, 0.5);
    this._placeholder.fillRect(0, 0, size, size);
    this.add(this._placeholder);

    this._loadAndShow(scene);

    scene.add.existing(this);
  }

  _loadAndShow(scene) {
    if (scene.textures.exists(this._key)) {
      this._show(scene, this._key);
      return;
    }
    if (this._key !== this._fallbackKey && scene.textures.exists(this._fallbackKey)) {
      this._show(scene, this._fallbackKey);
      return;
    }
    if (scene.textures.exists(this._unknownKey)) {
      this._show(scene, this._unknownKey);
      return;
    }

    scene.load.image(this._key, this._path);
    scene.load.once('filecomplete-image-' + this._key, () => this._show(scene, this._key));

    // If the variant file is missing fall back to the base icon, then to the unknown sprite
    if (this._key !== this._fallbackKey) {
      scene.load.once('loaderror', (file) => {
        if (file.key !== this._key) return;
        if (!scene.textures.exists(this._fallbackKey)) {
          scene.load.image(this._fallbackKey, this._fallbackPath);
          scene.load.once('filecomplete-image-' + this._fallbackKey, () => this._show(scene, this._fallbackKey));
          scene.load.once('loaderror', (f) => {
            if (f.key !== this._fallbackKey) return;
            this._showUnknown(scene);
          });
          scene.load.start();
        } else {
          this._show(scene, this._fallbackKey);
        }
      });
    } else {
      // primary IS the base — if it fails, go straight to unknown
      scene.load.once('loaderror', (file) => {
        if (file.key !== this._key) return;
        this._showUnknown(scene);
      });
    }

    scene.load.start();
  }

  _showUnknown(scene) {
    if (scene.textures.exists(this._unknownKey)) {
      this._show(scene, this._unknownKey);
      return;
    }
    scene.load.image(this._unknownKey, this._unknownPath);
    scene.load.once('filecomplete-image-' + this._unknownKey, () => this._show(scene, this._unknownKey));
    scene.load.start();
  }

  _show(scene, key) {
    // Guard: container may have been destroyed before the async load completed
    if (!this.scene) return;
    if (this._placeholder) {
      this._placeholder.destroy();
      this._placeholder = null;
    }
    const img = scene.add.image(this._size / 2, this._size / 2, key);
    img.setOrigin(0.5, 0.5);
    img.setDisplaySize(this._size, this._size);
    this.add(img);
  }
}
