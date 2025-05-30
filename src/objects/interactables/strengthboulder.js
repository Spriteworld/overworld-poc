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
        if (charId !== 'player') { return; }

        let player = this.scene.characters.get('player');
        if (typeof player === 'undefined') { return; }
        
        let playerFacing = player.getFacingDirection().toUpperCase();
        console.log('Player facing direction:', playerFacing);
        
        let boulder = this.#getBoulderInfrontOfPlayer();
        if (!boulder) { return; }
        this.#moveBoulder(boulder, playerFacing);
      });

    this.scene.gridEngine
      .directionChanged()
      .subscribe(({charId, direction}) => {
        if (charId !== 'player') { return; }

        let boulder = this.#getBoulderInfrontOfPlayer();
        if (!boulder) { return; }
        this.#moveBoulder(boulder, direction);
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

  #getBoulderInfrontOfPlayer() {
    let player = this.scene.characters.get('player');
    if (typeof player === 'undefined') { return false; }
    let playerLayer = this.scene.gridEngine.getCharLayer('player');

    let playerFacing = player.getFacingDirection().toUpperCase();        
    let boulderPosition = player.getFacingPosition();        
    let characters = this.scene.gridEngine.getCharactersAt(boulderPosition, playerLayer)[0];
    let boulder = this.scene.characters.get(characters);
    if (!boulder || boulder.config.type !== 'strength-boulder') { 
      console.log('No boulder found at position', boulderPosition);
      return; 
    }
    
    return boulder;
  }

  #moveBoulder(boulder, dir) {
    if (boulder.config.type !== 'strength-boulder') { return; }
    if (typeof dir === 'undefined') { return; }
    if (!boulder.canMove(dir)) { return; }

    boulder.move(dir);
  }
};