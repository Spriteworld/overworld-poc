export default class {
  /**
   * @param {import('@Objects/GameMap').default} scene - The map scene that owns this plugin.
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Scan the tilemap for tiles with the `sw_jump` property and cache their coordinates.
   */
  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::ledge');
    }
    this.ledgeTiles = this.scene.getTilesWithProperty('sw_jump');
  }

  /**
   * Subscribe to GridEngine position-change events and trigger ledge jumps
   * whenever a character steps onto a jump tile.
   */
  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::ledge::event', this.scene])
    }
    if (this.ledgeTiles.length === 0) { return; }

    this._sub = this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.isDumbCharacter()) { return; }

        // check for jump ledges
        this.handleJumps(char, exitTile, enterTile);
      });
  }

  /** Unsubscribe from GridEngine events to prevent memory leaks. */
  destroy() {
    this._sub?.unsubscribe();
  }

  /**
   * If the entered tile is a ledge jump tile, transition the character to
   * the JUMP_LEDGE state.
   * @param {import('@Objects/characters/Character').default} char - The moving character.
   * @param {{x:number,y:number}} exitTile - Tile the character left.
   * @param {{x:number,y:number}} enterTile - Tile the character entered.
   */
  handleJumps(char, exitTile, enterTile) {
    let isJumpTile = this.ledgeTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isJumpTile) {
      char.stateMachine.setState(char.stateDef.JUMP_LEDGE);
    }
  }
};