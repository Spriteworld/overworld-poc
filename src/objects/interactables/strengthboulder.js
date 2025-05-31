import { Direction } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::strengthBoulder');
    }

    this.activeBoulder = null;
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::strengthBoulder::event', this.scene]);
    }

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'strength-boulder') { return; }

      let text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }

      this.activeBoulder = tile.obj.id;
      this.scene.removeInteraction(tile.obj.id);
      this.scene.game.events.emit(
        'textbox-changedata', 
        text, 
        tile.obj
      );
    });

    if (this.scene.game.config.gameFlags.has_strength === false) {
      return;
    }

    this.scene.gridEngine
      .positionChangeFinished()
      .subscribe(({charId}) => {
        if (charId !== 'player') { return; }

        let player = this.scene.characters.get('player');
        if (typeof player === 'undefined') { return; }
        
        let playerFacing = player.getFacingDirection().toUpperCase();
        
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

    this.scene.game.events.once('textbox-disable', () => {
      if (this.activeBoulder === null) { return; }
      let player = this.scene.characters.get('player');
      if (typeof player === 'undefined') { return false; }
      let playerFacing = player.getFacingDirection().toUpperCase();

      let boulder = this.#getBoulderInfrontOfPlayer();

      this.#moveBoulder(boulder, playerFacing);
    });
  }

  #getBoulderInfrontOfPlayer() {
    let player = this.scene.characters.get('player');
    if (typeof player === 'undefined') { return false; }
    let playerLayer = this.scene.gridEngine.getCharLayer('player');

    let boulderPosition = player.getFacingPosition();        
    let characters = this.scene.gridEngine.getCharactersAt(boulderPosition, playerLayer)[0];
    let boulder = this.scene.characters.get(characters);
    if (!boulder || boulder.config.type !== 'strength-boulder') { 
      return; 
    }
    
    return boulder;
  }

  #moveBoulder(boulder, dir) {
    if (boulder.config.type !== 'strength-boulder') { return; }
    if (boulder.config.id !== this.activeBoulder) { return; }
    if (typeof dir === 'undefined') { return; }
    if (!boulder.canMove(dir)) { return; }

    boulder.move(dir);
  }
};