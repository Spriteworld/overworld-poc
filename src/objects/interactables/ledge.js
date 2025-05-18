import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::ledge');
    }
    this.ledgeTiles = this.scene.getTilesWithProperty('sw_jump');
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::ledge::event', this.scene])
    }
    if (this.ledgeTiles.length === 0) { return; }

    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }

        // check for jump ledges
        this.handleJumps(char, exitTile, enterTile);
      });
  }

  handleJumps(char, exitTile, enterTile) {
    let isJumpTile = this.ledgeTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isJumpTile) {
      char.stateMachine.setState(char.stateDef.JUMP_LEDGE);
    }
  }
};