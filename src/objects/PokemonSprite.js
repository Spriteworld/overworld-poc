import Phaser from 'phaser';

/**
 * Species whose icon set ships a distinct `<id>-female.png` file. Every other
 * species shares one icon across genders, so asking for a `-female` variant
 * would 404 and waste a load round-trip.
 */
const HAS_FEMALE_ICON = new Set([521, 592, 593]);

/**
 * Reusable Phaser Container that displays a Pokémon icon from
 * worlds/_base/pokemon/icons/ (32×32 static PNGs).
 *
 * Handles lazy texture loading, shiny variants (front/shiny/),
 * female variants (-female suffix for species that ship one), and
 * formes (-<forme> suffix).
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
 *   variant {'icon'|'front'} - 'icon' = 32×32 menu icon (default),
 *                              'front' = full front-facing battle sprite
 */
export default class PokemonSprite extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { species, shiny = false, gender = null, forme = null, size = 64, variant = 'icon' } = {}) {
    super(scene, x, y);

    this._size = size;

    // Build the variant-aware filename stem — icons use plain dex number ('1', '4')
    const base   = String(species);
    const suffix = forme ? `-${forme}`
                 : (gender === 'female' && HAS_FEMALE_ICON.has(Number(species))) ? '-female'
                 : '';
    const dir = variant === 'front' ? 'front' : 'icons';
    this._key  = `pkmn-${dir}-${base}${suffix}${shiny ? '-shiny' : ''}`;
    const assetsBase = import.meta.env.VITE_ASSETS_URL ?? '/';
    this._path = shiny
      ? `${assetsBase}pokemon/${dir}/shiny/${base}${suffix}.png`
      : `${assetsBase}pokemon/${dir}/${base}${suffix}.png`;

    this._fallbackKey  = `pkmn-${dir}-${base}${shiny ? '-shiny' : ''}`;
    this._fallbackPath = shiny
      ? `${assetsBase}pokemon/${dir}/shiny/${base}.png`
      : `${assetsBase}pokemon/${dir}/${base}.png`;

    const altDir = dir === 'front' ? 'icons' : 'front';
    this._altKey  = `pkmn-${altDir}-${base}`;
    this._altPath = `${assetsBase}pokemon/${altDir}/${base}.png`;

    this._unknownKey  = 'pkmn-icon-unknown';
    this._unknownPath = `${assetsBase}pokemon/front/0.png`;

    // Placeholder while loading
    this._placeholder = scene.add.graphics();
    this._placeholder.fillStyle(0xe0e8f0, 0.5);
    this._placeholder.fillRect(0, 0, size, size);
    this.add(this._placeholder);

    this._loadAndShow(scene);

    scene.add.existing(this);
  }

  _loadAndShow(scene) {
    // Cascade: primary variant → variant base → cross-variant base → unknown.
    // Dedupe so we don't try the same key twice (e.g. when the primary IS the
    // base because no gender/forme/shiny suffix applies).
    const tiers = [];
    const push = (key, path) => {
      if (key && path && !tiers.some(t => t.key === key)) tiers.push({ key, path });
    };
    push(this._key,         this._path);
    push(this._fallbackKey, this._fallbackPath);
    push(this._altKey,      this._altPath);

    // Any tier already in the texture cache? Show it synchronously.
    for (const { key } of tiers) {
      if (scene.textures.exists(key)) return this._show(scene, key);
    }
    if (scene.textures.exists(this._unknownKey)) return this._show(scene, this._unknownKey);

    // Otherwise load each tier in order, moving down on error.
    const tryTier = (i) => {
      if (i >= tiers.length) return this._showUnknown(scene);
      const { key, path } = tiers[i];
      if (scene.textures.exists(key)) return this._show(scene, key);
      scene.load.image(key, path);
      scene.load.once('filecomplete-image-' + key, () => this._show(scene, key));
      scene.load.once('loaderror', (file) => {
        if (file.key !== key) return;
        tryTier(i + 1);
      });
      scene.load.start();
    };
    tryTier(0);
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

    // Scale to fit within size×size, preserving the texture's aspect ratio.
    const src = img.texture?.source?.[0];
    const tw  = src?.width  || this._size;
    const th  = src?.height || this._size;
    const scale = this._size / Math.max(tw, th);
    img.setDisplaySize(tw * scale, th * scale);

    this.add(img);
  }
}
