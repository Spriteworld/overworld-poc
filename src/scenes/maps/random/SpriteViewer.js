import Phaser from 'phaser';
import { GameMap } from '@Objects';
import { SpriteViewerMap } from '@Maps';

// Frame indices from Character.characterFramesDef()
const WALK_FRAMES = {
  down:  { leftFoot: 1,  standing: 0,  rightFoot: 3  },
  up:    { leftFoot: 13, standing: 12, rightFoot: 15 },
  left:  { leftFoot: 7,  standing: 4,  rightFoot: 5  },
  right: { leftFoot: 9,  standing: 8,  rightFoot: 11 },
};

const FRAME_RATE    = 6;    // full walk cycle plays at 6 fps
const LOOK_INTERVAL = 2500; // ms between random direction changes

const DIRECTIONS = ['up', 'down', 'left', 'right'];

export default class SpriteViewer extends GameMap {
  constructor() {
    super({
      mapName: 'SpriteViewer',
      map:     SpriteViewerMap,
      active:  false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    this.loadMap();
    this.createCharacters();

    this._lookEvent = this.time.addEvent({
      delay:         LOOK_INTERVAL,
      loop:          true,
      callback:      this._randomLook,
      callbackScope: this,
    });
  }

  update(time, delta) {
    this.updateCharacters(time, delta);

    const npcs = this.npcs?.getChildren?.();
    if (!npcs?.length) return;

    for (const npc of npcs) {
      // Prevent GridEngine from resetting the frame while the character is stationary
      this.gridEngine.setWalkingAnimationMapping(npc.config.id, undefined);

      // Skip until the real texture has replaced the placeholder
      if (npc.texture.key !== npc.config.texture) continue;

      // Create walk animations the first time this texture is ready
      this._ensureWalkAnims(npc.config.texture);

      const dir = this.gridEngine.getFacingDirection(npc.config.id);
      const key = `${npc.config.texture}-walk-${dir}`;

      if (!npc.anims.isPlaying || npc.anims.currentAnim?.key !== key) {
        npc.anims.play(key);
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _randomLook() {
    const npcs = this.npcs?.getChildren?.();
    if (!npcs?.length) return;
    const npc = npcs[Phaser.Math.Between(0, npcs.length - 1)];
    npc.look?.(DIRECTIONS[Phaser.Math.Between(0, DIRECTIONS.length - 1)]);
    // The animation switch is picked up automatically on the next update() tick
  }

  /** Create the four directional walk-in-place animations for a texture (once per texture). */
  _ensureWalkAnims(texture) {
    for (const [dir, frames] of Object.entries(WALK_FRAMES)) {
      const key = `${texture}-walk-${dir}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, {
          frames: [frames.leftFoot, frames.standing, frames.rightFoot, frames.standing],
        }),
        frameRate: FRAME_RATE,
        repeat:    -1,
      });
    }
  }
}
