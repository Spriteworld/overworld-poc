import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }
  
  init() {
    this.scene.eventPlugins.set('slideTile', this.event.bind(this));
    if (Debug.functions.gameMap) {
      console.log('GameMap::initSlideTile');
    }
  }

  event() {
    // handle ice & spin tiles
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        // check for ice tiles
        this.handleIceTiles(char, exitTile, enterTile);

      });
  
    this.scene.gridEngine
      .movementStopped()
      .subscribe(({ charId, direction }) => {
        let char = this.scene.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        if (char.slidingDir !== null) {
          char.stateMachine.setState(char.stateDef.IDLE);
        }
      });
  }
};