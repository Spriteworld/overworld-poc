import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }
  
  init() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::interactables->initSpinTile');
    }
  }

  event() {
    console.log(['GameMap::event::spinTile', this.scene])
    // handle ice & spin tiles
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        // check for spin tiles
        this.handleSpinTiles(char, exitTile, enterTile);
      });
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
      let props = this.getTileProperties(enterTile.x, enterTile.y);
      let dir = getValue(props, 'sw_spin', false);
      if (!char.isSpinning() && dir !== false) {
        char.stateMachine.setState(char.stateDef.SPIN);
      }
      if (dir !== char.getSlidingDirection()) {
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