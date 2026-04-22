import * as Tile from '../Tile.js';

const ALPHA          = 0.5;
const TINT           = 0x6688cc;
const WATER_PROP_KEY = 'sw_water';
const DEPTH_OFFSET   = 0.5; // sits between floor (water) and ground char-layer

// Debug toggle — set to true to force reflections always visible regardless
// of the sw_water check. Useful to verify the sprite is being drawn in the
// right place / depth without needing to stand next to water.
const FORCE_VISIBLE = false;

export default class Reflection {
  /**
   * A mirrored sprite that tracks a parent Character and renders as its
   * water reflection. Shown only when the tile directly south of the parent
   * has the `sw_water` tile property.
   *
   * @param {object} config
   * @param {Phaser.GameObjects.Sprite} config.parent - Character sprite to mirror.
   * @param {number} [config.yOffset] - Pixel offset applied to the reflection's
   *   y position.  Defaults to tracking the parent's height each frame (so
   *   the reflection's top edge meets the parent's bottom edge even if the
   *   parent's texture size changes after construction — common for pkmn
   *   sprites that start on the 'red' placeholder).
   */
  constructor({ parent, yOffset }) {
    this.parent  = parent;
    this.scene   = parent.scene;
    this.yOffset = yOffset ?? null;

    this.sprite = this.scene.add.sprite(
      parent.x,
      parent.y + (this.yOffset ?? parent.displayHeight),
      parent.texture.key,
      parent.frame.name
    );
    this.sprite.setFlipY(true);
    this.sprite.setAlpha(ALPHA);
    this.sprite.setTint(TINT);
    this.sprite.setVisible(false);
    this.sprite.setName((parent.name || 'character') + '-reflection');

    this._depthResolved = false;
  }

  /**
   * Resolve the reflection's depth from the `floor` tilemap layer's current
   * depth.  Grid-engine assigns tilemap-layer and character depths after
   * GameMap.loadMap(), so we resolve on first update() — not in the
   * constructor.  Sitting at floor.depth + 0.5 places the reflection above
   * any water tile on `floor` but below anything on `ground` (including
   * characters, which grid-engine places at groundDepth + pixelPad).
   */
  _resolveDepth() {
    if (this._depthResolved) return;
    const floor = this.scene.tilemaps?.floor;
    if (!floor) return; // try again next frame; floor layer may not exist
    this.sprite.setDepth(floor.depth + DEPTH_OFFSET);
    this._depthResolved = true;
  }

  /**
   * Called each frame from the parent Character's update(). Copies pose
   * from parent and toggles visibility based on the water check below.
   */
  update() {
    const p = this.parent;
    if (!p || !p.active) return;

    this._resolveDepth();

    if (this.sprite.texture.key !== p.texture.key) {
      this.sprite.setTexture(p.texture.key, p.frame.name);
    } else if (this.sprite.frame.name !== p.frame.name) {
      this.sprite.setFrame(p.frame.name);
    }

    // Mirror parent's origin/scale so the reflection's rendered rect aligns
    // with the parent's rendered rect. Without this we see a horizontal
    // shift (when origins differ) and a vertical gap/overlap (when scale
    // or origin differ).
    if (this.sprite.originX !== p.originX || this.sprite.originY !== p.originY) {
      this.sprite.setOrigin(p.originX, p.originY);
    }
    if (this.sprite.scaleX !== p.scaleX || this.sprite.scaleY !== p.scaleY) {
      this.sprite.setScale(p.scaleX, p.scaleY);
    }

    this.sprite.x     = p.x;
    this.sprite.flipX = p.flipX;
    // Anchor the reflection's top to the bottom of the parent's current
    // tile, not to the parent sprite's visual feet.  With origin (0.5, 0.5)
    // and a tile-sized sprite, grid-engine's engineOffset places the
    // sprite's visual bottom at the middle of the tile — so anchoring on
    // visual feet makes the reflection straddle shore + water.  Anchoring
    // on the tile bottom keeps the reflection fully inside the water tile.
    const feetY = p.y + p.displayHeight * (1 - p.originY) - 1;
    const tileBottom = (Math.floor(feetY / Tile.HEIGHT) + 1) * Tile.HEIGHT;
    this.sprite.y = tileBottom + this.sprite.originY * this.sprite.displayHeight;

    this.sprite.setVisible(FORCE_VISIBLE || this._isOverWater());
  }

  /**
   * True when the tile immediately south of the parent has `sw_water: true`.
   * That tile is what the reflection draws onto — if it isn't water, the
   * reflection shouldn't render.
   *
   * Computed from the parent's pixel position, not grid-engine's tile
   * position. Grid-engine's `getPosition()` returns the source tile for the
   * entire duration of a tile-to-tile move (it only updates on completion),
   * so we'd keep the reflection visible all the way across an inland
   * transition.  Pixel math flips at the midpoint of the move, which is
   * what Gen3 does.
   */
  _isOverWater() {
    // Check every tile cell the reflection sprite's rendered rect covers,
    // not just the parent's center tile.  Without this, reflections
    // straddle tile boundaries and visibly bleed onto adjacent shore tiles
    // — horizontally mid-walk (for any sprite) and vertically (for sprites
    // taller than one tile, like bigger pkmn followers).
    if (typeof this.scene.getTileProperties !== 'function') return false;

    const s = this.sprite;
    const w = s.displayWidth;
    const h = s.displayHeight;
    const left   = s.x - w * s.originX;
    const right  = s.x + w * (1 - s.originX);
    const top    = s.y - h * s.originY;
    const bottom = s.y + h * (1 - s.originY);

    const leftTileX  = Math.floor(left       / Tile.WIDTH);
    const rightTileX = Math.floor((right - 1) / Tile.WIDTH);
    const topTileY    = Math.floor(top        / Tile.HEIGHT);
    const bottomTileY = Math.floor((bottom - 1) / Tile.HEIGHT);

    for (let ty = topTileY; ty <= bottomTileY; ty++) {
      for (let tx = leftTileX; tx <= rightTileX; tx++) {
        const props = this.scene.getTileProperties(tx, ty);
        if (!props?.get(WATER_PROP_KEY)) return false;
      }
    }
    return true;
  }

  destroy() {
    this.sprite?.destroy();
    this.sprite = null;
    this.parent = null;
  }
}
