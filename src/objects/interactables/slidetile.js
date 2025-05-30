export default class {
  constructor(scene) {
    this.scene = scene;
  }
  
  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::slideTile');
    }
    this.iceTiles = this.scene.getTilesWithProperty('sw_slide');
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::slideTile::event', this.scene])
    }
    if (this.iceTiles.length === 0) { return; }

    // handle ice & spin tiles
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.isDumbCharacter()) { return; }

        // check for ice tiles
        this.handleIceTiles(char, exitTile, enterTile);
      });
  
    this.scene.gridEngine
      .movementStopped()
      .subscribe(({ charId, direction }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.isDumbCharacter()) { return; }

        if (char.slidingDir !== null) {
          char.stateMachine.setState(char.stateDef.IDLE);
        }
      });
  }

  handleIceTiles(char, exitTile, enterTile) {
    let hasIceTiles = this.iceTiles.length;
    if (hasIceTiles > 0) {
      let isIceTile = this.iceTiles.some(tile => {
        return tile[0] == enterTile.x && tile[1] == enterTile.y;
      });
      if (isIceTile && !char.isSliding()) {
        char.stateMachine.setState(char.stateDef.SLIDE);
      }
      if (!isIceTile && char.isSliding()) {
        char.stateMachine.setState(char.stateDef.IDLE);
      }
    }
  }
};