export default class {
  /**
   * @param {import('@Objects/GameMap').default} scene - The map scene that owns this plugin.
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Scan the tilemap for tiles with the `sw_slide` property (ice tiles) and
   * cache their coordinates.
   */
  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::slideTile');
    }
    this.iceTiles = this.scene.getTilesWithProperty('sw_slide');
  }

  /**
   * Subscribe to GridEngine position-change and movement-stopped events to
   * activate or deactivate sliding as characters move over ice tiles.
   */
  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::slideTile::event', this.scene])
    }
    if (this.iceTiles.length === 0) { return; }

    this._subs = [
      // handle ice tiles
      this.scene.gridEngine
        .positionChangeStarted()
        .subscribe(({ charId, exitTile, enterTile }) => {
          let char = this.scene.characters.get(charId);
          if (typeof char === 'undefined') { return; }
          if (char.isDumbCharacter()) { return; }

          this.handleIceTiles(char, exitTile, enterTile);
        }),

      this.scene.gridEngine
        .movementStopped()
        .subscribe(({ charId, direction }) => {
          let char = this.scene.characters.get(charId);
          if (typeof char === 'undefined') { return; }
          if (char.isDumbCharacter()) { return; }

          if (char.slidingDir !== null) {
            char.stateMachine.setState(char.stateDef.IDLE);
          }
        }),
    ];
  }

  /** Unsubscribe all GridEngine subscriptions to prevent memory leaks. */
  destroy() {
    this._subs?.forEach(s => s.unsubscribe());
  }

  /**
   * Start or stop sliding based on whether the entered tile is an ice tile.
   * @param {import('@Objects/characters/Character').default} char - The moving character.
   * @param {{x:number,y:number}} exitTile - Tile the character left.
   * @param {{x:number,y:number}} enterTile - Tile the character entered.
   */
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