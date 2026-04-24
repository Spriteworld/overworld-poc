import * as Tile from '../Tile.js';

const ALPHA          = 0.5;
const TINT           = 0x6688cc;
const WATER_PROP_KEY = 'sw_water';
const DEPTH_OFFSET   = 0.5; // sits between floor (water) and ground char-layer

export default class Reflection {
  /**
   * A mirrored sprite that tracks a parent Character and renders as its
   * water reflection. Clipped via a GeometryMask built from every
   * `sw_water`-tagged tile on the `floor` layer — so the reflection
   * tracks the parent smoothly and the shore naturally hides whatever
   * portion isn't over water (no tile-boundary flicker).
   *
   * @param {object} config
   * @param {Phaser.GameObjects.Sprite} config.parent - Character sprite to mirror.
   */
  constructor({ parent, offsetY = 0 }) {
    this.parent   = parent;
    this.scene    = parent.scene;
    this._offsetY = offsetY;

    this.sprite = this.scene.add.sprite(
      parent.x,
      parent.y + (Tile.HEIGHT + parent.displayHeight) / 2,
      parent.texture.key,
      parent.frame.name
    );
    this.sprite.setFlipY(true);
    this.sprite.setAlpha(ALPHA);
    this.sprite.setTint(TINT);
    this.sprite.setName((parent.name || 'character') + '-reflection');

    this._ready = false;
    this._destroyed = false;
  }

  /**
   * Resolve depth, apply the shared water mask. Runs once, lazily — both
   * depend on the `floor` tilemap layer being populated (grid-engine
   * reassigns layer depths during scene init, which happens after the
   * parent Character is constructed).
   */
  _initRendering() {
    if (this._ready) return;
    const floor = this.scene.tilemaps?.floor;
    if (!floor) return;

    this.sprite.setDepth(floor.depth + DEPTH_OFFSET);

    const mask = Reflection._getOrCreateWaterMask(this.scene);
    if (mask) {
      this.sprite.setMask(mask);
    } else {
      // No water tiles on this map — there's nothing for the reflection to
      // land on. Without a mask the sprite would render over every non-water
      // surface (common on indoor maps). Hide it and flag so update() skips
      // the per-frame pose sync until the scene tears down.
      this.sprite.setVisible(false);
      this._noWater = true;
    }

    this._ready = true;
  }

  /**
   * Build (once per scene) a GeometryMask covering every water tile on
   * the floor layer. Cached on the scene so all Reflections share a
   * single mask.
   */
  static _getOrCreateWaterMask(scene) {
    if (scene._waterReflectionMask) return scene._waterReflectionMask;
    const floor = scene.tilemaps?.floor;
    if (!floor) return null;

    const graphics = scene.make.graphics({ add: false });
    graphics.fillStyle(0xffffff, 1);
    let waterTileCount = 0;
    floor.forEachTile((tile) => {
      if (tile?.properties?.[WATER_PROP_KEY]) {
        graphics.fillRect(tile.pixelX, tile.pixelY, tile.width, tile.height);
        waterTileCount++;
      }
    });
    if (waterTileCount === 0) return null;

    scene._waterReflectionMask = graphics.createGeometryMask();
    return scene._waterReflectionMask;
  }

  /**
   * Called each frame from the parent Character's update(). Copies pose
   * from parent — the mask handles clipping, so visibility is always on.
   */
  update() {
    const p = this.parent;
    if (!p || !p.active) return;

    this._initRendering();
    if (this._noWater) return;

    if (this.sprite.texture.key !== p.texture.key) {
      this.sprite.setTexture(p.texture.key, p.frame.name);
    } else if (this.sprite.frame.name !== p.frame.name) {
      this.sprite.setFrame(p.frame.name);
    }

    if (this.sprite.originX !== p.originX || this.sprite.originY !== p.originY) {
      this.sprite.setOrigin(p.originX, p.originY);
    }
    if (this.sprite.scaleX !== p.scaleX || this.sprite.scaleY !== p.scaleY) {
      this.sprite.setScale(p.scaleX, p.scaleY);
    }

    this.sprite.x     = p.x;
    this.sprite.y     = p.y + (Tile.HEIGHT + p.displayHeight) / 2 + this._offsetY;
    this.sprite.flipX = p.flipX;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Skip explicit sprite.destroy() when the scene is already tearing down:
    // Phaser's DisplayList.shutdown sweeps the list backwards with a cached
    // index, and our parent's 'destroy' handler fires mid-sweep. Destroying
    // our sprite here would splice a sibling out of the same list Phaser is
    // iterating, leaving a hole that crashes the next `list[i].destroy()`.
    // Settings.status is flipped to SHUTDOWN (8) / DESTROYED (9) before
    // Phaser emits the SHUTDOWN event, so we can detect it synchronously.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;

    if (!sceneDown) {
      this.sprite?.destroy();
    }
    this.sprite = null;
    this.parent = null;
    this.scene  = null;
  }
}
