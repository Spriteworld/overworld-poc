import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }
  
  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::spinTile');
    }
    this.spinTiles = this.scene.getTilesWithProperty('sw_spin');
    this.stopTiles = this.scene.getTilesWithProperty('sw_stop');
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::spinTile::event', this.scene]);
    }
    if (this.spinTiles.length === 0 && this.stopTiles.length === 0) return;

    this._subs = [
      // handle spin tiles
      this.scene.gridEngine
        .positionChangeStarted()
        .subscribe(({ charId, exitTile, enterTile }) => {
          let char = this.scene.characters.get(charId);
          if (typeof char === 'undefined') { return; }
          if (char.isDumbCharacter()) { return; }

          this.handleSpinTiles(char, exitTile, enterTile);
        }),

      this.scene.gridEngine
        .movementStopped()
        .subscribe(({ charId, direction }) => {
          let char = this.scene.characters.get(charId);
          if (typeof char === 'undefined') { return; }
          if (char.isDumbCharacter()) { return; }

          if (char.slidingDir !== null) {
            char?.stateMachine.setState(char.stateDef.IDLE);
          }
        }),
    ];
  }

  destroy() {
    this._subs?.forEach(s => s.unsubscribe());
  }

  handleSpinTiles(char, exitTile, enterTile) {
    let hasSpinTiles = this.spinTiles.length;
    if (hasSpinTiles <= 0) {
      return;
    }

    let isSpinTile = this.spinTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });

    if (isSpinTile) {
      let props = this.scene.getTileProperties(enterTile.x, enterTile.y);
      let dir = props.get('sw_spin') || false;
      if (dir === false) {
        dir = char.getSpinningDirection();
      }

      if (!char.isSpinning() && dir !== false) {
        char.stateMachine.setState(char.stateDef.SPIN);
      }
      if (dir !== char.getSpinningDirection()) {
        char.setSpinDirection(dir);
      }
    }

    let isStopTile = this.stopTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isStopTile && char.isSpinning()) {
      char.stateMachine.setState(char.stateDef.IDLE);
    }
  }
};