import { Direction } from '@Objects';
import store from '../../store/index.js';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::strengthBoulder');
    }
    this._subs = [];
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::strengthBoulder::event', this.scene]);
    }

    // Z on a boulder: only show text when player lacks strength.
    // When they have strength, suppress the interact text — push by walking.
    this._onInteract = (tile) => {
      if (tile.obj.type !== 'strength-boulder') { return; }
      if (store.state.game.gameFlags.has_strength) { return; }

      const text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }

      this.scene.game.events.emit('textbox-changedata', text, tile.obj);
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    // Push whenever the player finishes moving — check what's directly ahead.
    this._subs.push(
      this.scene.gridEngine
        .positionChangeFinished()
        .subscribe(({ charId }) => {
          if (charId !== 'player') { return; }
          const boulder = this.#getBoulderInfrontOfPlayer();
          if (!boulder) { return; }
          const dir = this.scene.characters.get('player')?.getFacingDirection().toUpperCase();
          this.#moveBoulder(boulder, dir);
        })
    );
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  #getBoulderInfrontOfPlayer() {
    const player = this.scene.characters.get('player');
    if (!player) { return null; }
    const layer    = this.scene.gridEngine.getCharLayer('player');
    const pos      = player.getFacingPosition();
    const charId   = this.scene.gridEngine.getCharactersAt(pos, layer)[0];
    const boulder  = this.scene.characters.get(charId);
    if (!boulder || boulder.config.type !== 'strength-boulder') { return null; }
    return boulder;
  }

  #moveBoulder(boulder, dir) {
    if (!store.state.game.gameFlags.has_strength) { return; }
    if (!dir) { return; }
    if (!boulder.canMove(dir)) { return; }
    boulder.move(dir);
  }
}
