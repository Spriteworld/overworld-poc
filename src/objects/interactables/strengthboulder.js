import { Direction } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::strengthBoulder');
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::strengthBoulder::event', this.scene]);
    }

    
    this.scene.gridEngine
      .positionChangeFinished()
      .subscribe(({charId}) => {
        if (charId !== 'player') {
          return;
        }

        let player = this.scene.characters.get('player');
        if (typeof player === 'undefined') { return; }
        let playerLayer = this.scene.gridEngine.getCharLayer('player');
        
        let playerFacing = player.getFacingDirection().toUpperCase();        
        let boulderPosition = player.getFacingPosition();        
        let characters = this.scene.gridEngine.getCharactersAt(boulderPosition, playerLayer)[0];
        let boulder = this.scene.characters.get(characters);
        if (!boulder || boulder.config.type !== 'strength-boulder') { 
          console.log('No boulder found at position', boulderPosition);
          return; 
        }
        console.log('Boulder found at position', boulderPosition, boulder);
        console.log('Move boulder in direction', playerFacing, {
          canMoveDown: boulder.canMoveDown(),
          canMoveUp: boulder.canMoveUp(),
          canMoveLeft: boulder.canMoveLeft(),
          canMoveRight: boulder.canMoveRight()
        });
        if (playerFacing === Direction.DOWN && boulder.canMoveDown()) {
          boulder.move(Direction.DOWN);
        } else if (playerFacing === Direction.UP && boulder.canMoveUp()) {
          boulder.move(Direction.UP);
        } else if (playerFacing === Direction.LEFT && boulder.canMoveLeft()) {
          boulder.move(Direction.LEFT);
        } else if (playerFacing === Direction.RIGHT && boulder.canMoveRight()) {
          boulder.move(Direction.RIGHT);
        }
      });

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'strength-boulder') { return; }

      let text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }

      this.scene.game.events.emit(
        'textbox-changedata', 
        text, 
        tile.obj
      );
    });
  }
};