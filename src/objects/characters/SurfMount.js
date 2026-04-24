import * as Direction from '../Direction.js';

const TEXTURE_KEY = 'base_surf';
const DEPTH_OFFSET = -0.01; // sits just behind the rider in the same char layer
// Pixel offsets from the rider's (x, y) to the surf base's (x, y). The source
// frame centres the base slightly right of where the rider sits, so pull the
// sprite left to realign.
const OFFSET_X = -16;
const OFFSET_Y = 0;

const DIR_FRAMES = {
  [Direction.DOWN]:  { standing: 0,  leftFoot: 1,  rightFoot: 2  },
  [Direction.LEFT]:  { standing: 4,  leftFoot: 5,  rightFoot: 6  },
  [Direction.RIGHT]: { standing: 8,  leftFoot: 9,  rightFoot: 10 },
  [Direction.UP]:    { standing: 12, leftFoot: 13, rightFoot: 14 },
};

export default class SurfMount {
  /**
   * Rideable surf-base sprite tucked under a Character while they're in SURF
   * state. Mirrors the parent's tile position and facing direction; rendered
   * one step behind the rider in the same char layer.
   *
   * @param {object} config
   * @param {Phaser.GameObjects.Sprite} config.parent - Character sprite to anchor to.
   */
  constructor({ parent }) {
    this.parent = parent;
    this.scene  = parent.scene;

    this.sprite = this.scene.add.sprite(
      parent.x + OFFSET_X,
      parent.y + OFFSET_Y,
      TEXTURE_KEY,
      DIR_FRAMES[Direction.DOWN].standing
    );
    this.sprite.setOrigin(parent.originX, parent.originY);
    this.sprite.setDepth(parent.depth + DEPTH_OFFSET);
    this.sprite.setName((parent.name || 'character') + '-surf-mount');

    this._destroyed = false;
  }

  update() {
    const p = this.parent;
    if (!p || !p.active || this._destroyed) return;

    // Frozen: hold the pose captured in freeze() so the mount stays on its
    // water tile while the rider arcs off during a dismount hop.
    if (this._frozen) return;

    const dir = (p.getFacingDirection?.() || Direction.DOWN).toUpperCase();
    const frames = DIR_FRAMES[dir] || DIR_FRAMES[Direction.DOWN];
    this.sprite.setFrame(frames.standing);

    if (this.sprite.originX !== p.originX || this.sprite.originY !== p.originY) {
      this.sprite.setOrigin(p.originX, p.originY);
    }

    this.sprite.x = p.x + OFFSET_X;
    this.sprite.y = p.y + OFFSET_Y;
    this.sprite.setDepth(p.depth + DEPTH_OFFSET);
  }

  /**
   * Pin the mount to its current tile and stop tracking the rider. Used on
   * dismount so the mount remains on the water while the rider hops to shore.
   * The mount is destroyed shortly after (surfOnExit), so this is a one-way
   * transition — no unfreeze.
   */
  freeze() {
    this._frozen = true;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Mirror Reflection.destroy: skip sprite.destroy() during scene shutdown
    // to avoid splicing a sibling out of the DisplayList mid-sweep.
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
