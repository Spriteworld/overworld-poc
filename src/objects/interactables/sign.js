import Debug from '@Data/debug.js';
import { Tile } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::Signs');
    }
    let signs = this.scene.findInteractions('sign');
    if (signs.length === 0) { return; }

    signs.forEach((sign) => {
      // sign.x /= Tile.WIDTH;
      // sign.y /= Tile.HEIGHT;
      this.scene.interactTile(this.scene.game.config.tilemap, sign, 0x00afe4);
    });
  }
}