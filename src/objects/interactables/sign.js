import Debug from '@Data/debug.js';
import { Tile } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (Debug.functions.interactables.sign || Debug.functions.interactableShout) {
      console.log('Interactables::Signs');
    }
    let signs = this.scene.findInteractions('sign');
    if (signs.length === 0) { return; }

    signs.forEach((sign) => {
      // sign.x /= Tile.WIDTH;
      // sign.y /= Tile.HEIGHT;
      this.scene.interactTile(this.scene.config.tilemap, sign, 0x00afe4);
    });
  }
}