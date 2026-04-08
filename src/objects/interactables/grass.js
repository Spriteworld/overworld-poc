import Phaser from 'phaser';
import { Tile } from '@Objects';

const ANIM_KEY    = 'grass-rustle';
const TEXTURE_KEY = 'animated_grass';
const FRAME_COUNT = 8;
const FRAME_RATE  = 10; // 100 ms per frame

export default class {
  constructor(scene) {
    this.scene      = scene;
    this.grassTiles = [];
  }

  init() {
    const zones = this.scene.findInteractions('encounters');
    if (zones.length === 0) return;

    zones.forEach(obj => {
      if (typeof obj.polygon !== 'undefined') return;
      const cols = Math.floor(obj.width  / Tile.WIDTH);
      const rows = Math.floor(obj.height / Tile.HEIGHT);
      for (let dx = 0; dx < cols; dx++) {
        for (let dy = 0; dy < rows; dy++) {
          this.grassTiles.push({
            x: (obj.x / Tile.WIDTH)  + dx,
            y: (obj.y / Tile.HEIGHT) + dy,
          });
        }
      }
    });

    if (this.grassTiles.length === 0) return;

    if (!this.scene.anims.exists(ANIM_KEY)) {
      this.scene.anims.create({
        key:       ANIM_KEY,
        frames:    this.scene.anims.generateFrameNumbers(TEXTURE_KEY, { start: 0, end: FRAME_COUNT - 1 }),
        frameRate: FRAME_RATE,
        repeat:    0,
      });
    }
  }

  update() {}

  event() {
    if (this.grassTiles.length === 0) return;

    this._sub = this.scene.gridEngine.positionChangeStarted().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') return;

      const isGrass = this.grassTiles.some(t => t.x === enterTile.x && t.y === enterTile.y);
      if (!isGrass) return;

      const sprite = this.scene.add.sprite(
        enterTile.x * Tile.WIDTH,
        enterTile.y * Tile.HEIGHT,
        TEXTURE_KEY,
        0,
      );
      sprite.setOrigin(0).setDepth(2);
      sprite.play(ANIM_KEY);
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    });
  }

  destroy() {
    this._sub?.unsubscribe();
  }
}
