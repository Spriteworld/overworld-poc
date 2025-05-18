import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::cutTree');
    }
  }
};