import { Character, Tile, Direction } from '@Objects';
import { EventBus, getInputManager, Action } from '@Utilities';
import store from '../../store/index.js';

export default class extends Character {
  /**
   * The player-controlled character. Registers all movement states including
   * JUMP and JUMP_LEDGE, and creates debug blocker rectangles for each direction.
   * @param {object} config - Character configuration (see Character constructor).
   */
  constructor(config) {
    config.type = 'player';
    // config.collides = false;
    super(config);

    this.stateMachine
      .addState(this.stateDef.IDLE, {
        onEnter: this.idleOnEnter,
        onUpdate: this.idleOnUpdate,
        onExit: this.idleOnExit,
      })
      .addState(this.stateDef.MOVE, {
        onEnter: this.moveOnEnter,
        onUpdate: this.moveOnUpdate,
        onExit: this.moveOnExit,
      })
      .addState(this.stateDef.BIKE, {
        onEnter: this.bikeOnEnter,
        onUpdate: this.bikeOnUpdate,
        onExit: this.bikeOnExit,
      })
      .addState(this.stateDef.SPIN, {
        onEnter: this.spinOnEnter,
        onUpdate: this.spinOnUpdate,
        onExit: this.spinOnExit,
      })
      .addState(this.stateDef.SLIDE, {
        onEnter: this.slideOnEnter,
        onUpdate: this.slideOnUpdate,
        onExit: this.slideOnExit,
      })
      .addState(this.stateDef.JUMP, {
        onEnter: this.jumpOnEnter,
        onUpdate: this.jumpOnUpdate,
        onExit: this.jumpOnExit,
      })
      .addState(this.stateDef.JUMP_LEDGE, {
        onEnter: this.jumpLedgeOnEnter,
        onUpdate: this.jumpLedgeOnUpdate,
        onExit: this.jumpLedgeOnExit,
      })
      // warp-doors
      // warp-tiles
      // interact-npcs
      // interact-signs
      // item-pickup
      // HM-options
      // water-currents
      .setState(this.stateDef.IDLE)
    ;

    this.setOrigin(0.5, 0.5);

    this.blockedRight = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setAlpha(0)
      .setName('blocked-right')
    ;
    this.blockedDown = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setAlpha(0)
      .setName('blocked-down')
    ;
    this.blockedLeft = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setAlpha(0)
      .setName('blocked-left')
    ;
    this.blockedUp = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setAlpha(0)
      .setName('blocked-up')
    ;
  }

  /**
   * Per-frame update. Runs the state machine and, in debug mode, visualises
   * blocked tiles around the player.
   * @param {number} time - Current game time in ms.
   * @param {number} delta - Time since last frame in ms.
   */
  update(time, delta) {
    this.stateMachine.update(time);
    this.reflection?.update();

    if (this.config.scene.game.config.debug.tests.playerBlockers) {
      this.debugBlockers();
    }
  }

  /**
   * Override: also checks for the confirm button to trigger interaction with facing objects.
   */
  idleOnUpdate() {
    Character.prototype.idleOnUpdate.call(this);
    if (this.config.scene.registry.get('player_input') === false) {
      return;
    }
    const im = getInputManager();
    // Edge-triggered: fire exactly once on the frame CONFIRM is first pressed.
    // Previously this fired every frame for ~5 frames (getDuration < 80ms),
    // calling handleInteractables and the registry interaction search each time.
    const confirmDown = !!im?.isDown(Action.CONFIRM);
    if (confirmDown && !this._confirmHeldLastFrame) {
      this.handleInteractables();
    }
    this._confirmHeldLastFrame = confirmDown;
  }

  /**
   * Override: reads directional inputs and the run modifier to move
   * the player each tick, adjusting GridEngine speed accordingly.
   */
  moveOnUpdate() {
    if (this.config.scene.registry.get('player_input') === false) {
      return;
    }
    const im = getInputManager();

    let moveSpeed = 4;
    const hasShoes = this.config.scene.game.config.gameFlags.has_running_shoes;
    const runHeld  = !!im?.isDown(Action.RUN);
    // alwaysRun on → runs by default, B walks. Off → walks by default, B runs.
    if (hasShoes && (store.state.game.alwaysRun ? !runHeld : runHeld)) {
      moveSpeed = 8;
    }

    this.gridengine.setSpeed(this.config.id, moveSpeed);

    if (im?.isDown(Action.LEFT)) {
      this.handleMove(Direction.LEFT);
    } else if (im?.isDown(Action.RIGHT)) {
      this.handleMove(Direction.RIGHT);
    } else if (im?.isDown(Action.UP)) {
      this.handleMove(Direction.UP);
    } else if (im?.isDown(Action.DOWN)) {
      this.handleMove(Direction.DOWN);
    } else {
      this.stateMachine.setState(this.stateDef.IDLE);
    }
    this._emitMoveCompleteIfTileChanged();
  }

  /** Override: swap texture/mapping and shift camera x by -0.5 tiles. */
  bikeOnEnter() {
    Character.prototype.bikeOnEnter.call(this);
    const cam = this.config.scene.cameras.main;
    cam.setFollowOffset((cam.followOffset.x - Tile.WIDTH / 2) + 8, cam.followOffset.y);
  }

  /** Override: restore texture/mapping and undo the camera x shift. */
  bikeOnExit() {
    Character.prototype.bikeOnExit.call(this);
    const cam = this.config.scene.cameras.main;
    cam.setFollowOffset((cam.followOffset.x + Tile.WIDTH / 2) - 8, cam.followOffset.y);
  }

  /**
   * Per-tick update while in the BIKE state. Moves at bike speed; stays in BIKE
   * when no inputs are held (unlike MOVE, which returns to IDLE on release).
   */
  bikeOnUpdate() {
    if (this.config.scene.registry.get('player_input') === false) {
      return;
    }
    const im = getInputManager();

    this.gridengine.setSpeed(this.config.id, 20);

    // Edge-triggered CONFIRM (matches idleOnUpdate).
    const confirmDown = !!im?.isDown(Action.CONFIRM);
    const confirmJustPressed = confirmDown && !this._confirmHeldLastFrame;
    this._confirmHeldLastFrame = confirmDown;
    if (confirmJustPressed) {
      this.handleInteractables();
    } else if (im?.isDown(Action.LEFT)) {
      this.handleMove(Direction.LEFT);
    } else if (im?.isDown(Action.RIGHT)) {
      this.handleMove(Direction.RIGHT);
    } else if (im?.isDown(Action.UP)) {
      this.handleMove(Direction.UP);
    } else if (im?.isDown(Action.DOWN)) {
      this.handleMove(Direction.DOWN);
    }
    this._emitMoveCompleteIfTileChanged();
  }

  /**
   * Only emit the cross-boundary `player-move-complete` event when the player's
   * tile coordinate actually changes. Previously this fired every tick while
   * the move state was active, churning Vue reactivity for no new information.
   */
  _emitMoveCompleteIfTileChanged() {
    const tx = (this.x / Tile.WIDTH)  | 0;
    const ty = (this.y / Tile.HEIGHT) | 0;
    if (tx === this._lastEmittedTileX && ty === this._lastEmittedTileY) return;
    this._lastEmittedTileX = tx;
    this._lastEmittedTileY = ty;
    EventBus.emit('player-move-complete', this);
  }

  /**
   * Disable player input by setting the `player_input` registry flag to false.
   */
  disableMovement() {
    this.config.scene.registry.set('player_input', false);
  }

  /**
   * Re-enable player input by setting the `player_input` registry flag to true.
   */
  enableMovement() {
    this.config.scene.registry.set('player_input', true);
  }

  /**
   * Check the tile in front of the player against the interactable registry
   * and emit `interact-with-obj` if a match is found.
   */
  handleInteractables() {
    let facingTile = this.getPosInFacingDirection();

    // check for interactable tiles
    let interactableTiles = this.scene.registry.get('interactions');
    if (interactableTiles.length === 0) { return; }
    let tile = interactableTiles.find((tile) => {
      // For movable characters (NPCs, overworld Pokémon) use their live
      // GridEngine position so interaction follows them as they walk around.
      const charId = tile.obj.id;
      if (this.scene.characters.has(charId) && this.scene.gridEngine.hasCharacter(charId)) {
        const pos = this.scene.gridEngine.getPosition(charId);
        return pos.x === facingTile.x && pos.y === facingTile.y;
      }
      // Static interactables: compare stored coords (may be pixels or tiles).
      return (
        tile.x / Tile.WIDTH === facingTile.x &&
        tile.y / Tile.HEIGHT === facingTile.y
      ) || (
        tile.x === facingTile.x &&
        tile.y === facingTile.y
      );
    });

    if (!tile) { return; }
    
    this.scene.registry.set('last-spoke-to', tile.obj.id);

    this.config.scene.game.events.emit('interact-with-obj', tile);
  }

  /**
   * Show coloured rectangles on tiles blocked in each direction around the player.
   * Only called when `debug.tests.playerBlockers` is enabled in the game config.
   */
  debugBlockers() {
    let player = this.config.scene.characters.get(this.config.id);
    let tilePos = {};

    tilePos = this.getPosInDirection(Direction.LEFT);
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedLeft.x = tilePos.x * Tile.WIDTH;
      this.blockedLeft.y = tilePos.y * Tile.HEIGHT;
      this.blockedLeft.width = Tile.WIDTH;
      this.blockedLeft.height = Tile.HEIGHT;
      this.blockedLeft.setAlpha(0.5);
    } else {
      this.blockedLeft.x = 0;
      this.blockedLeft.y = 0;
      this.blockedLeft.setAlpha(0);
    }

    tilePos = this.getPosInDirection(Direction.UP);
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedUp.x = tilePos.x * Tile.WIDTH;
      this.blockedUp.y = tilePos.y * Tile.HEIGHT;
      this.blockedUp.width = Tile.WIDTH;
      this.blockedUp.height = Tile.HEIGHT;
      this.blockedUp.setAlpha(0.5);
    } else {
      this.blockedUp.x = 0;
      this.blockedUp.y = 0;
      this.blockedUp.setAlpha(0);
    }

    tilePos = this.getPosInDirection(Direction.RIGHT);
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedRight.x = tilePos.x * Tile.WIDTH;
      this.blockedRight.y = tilePos.y * Tile.HEIGHT;
      this.blockedRight.width = Tile.WIDTH;
      this.blockedRight.height = Tile.HEIGHT;
      this.blockedRight.setAlpha(0.5);
    } else {
      this.blockedRight.x = 0;
      this.blockedRight.y = 0;
      this.blockedRight.setAlpha(0);
    }

    tilePos = this.getPosInDirection(Direction.DOWN);
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedDown.x = tilePos.x * Tile.WIDTH;
      this.blockedDown.y = tilePos.y * Tile.HEIGHT;
      this.blockedDown.width = Tile.WIDTH;
      this.blockedDown.height = Tile.HEIGHT;
      this.blockedDown.setAlpha(0.5);
    } else {
      this.blockedDown.x = 0;
      this.blockedDown.y = 0;
      this.blockedDown.setAlpha(0);
    }
  }
}
