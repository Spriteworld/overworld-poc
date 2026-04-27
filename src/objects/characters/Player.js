import { Character, Tile, Direction } from '@Objects';
import { EventBus, getInputManager, Action } from '@Utilities';
import { playSfx } from '@Utilities/AudioManager.js';
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
      .addState(this.stateDef.SURF, {
        onEnter: this.surfOnEnter,
        onUpdate: this.surfOnUpdate,
        onExit: this.surfOnExit,
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
      .addState(this.stateDef.JUMP_LEDGE, {
        onEnter: this.jumpLedgeOnEnter,
        onUpdate: this.jumpLedgeOnUpdate,
        onExit: this.jumpLedgeOnExit,
      })
      .setState(this.stateDef.IDLE)
    ;

    this.setOrigin(0.5, 0.5);
    this._lastMoveSucceededAt = Date.now();

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
    this._applyWaterBob(time);
    this.reflection?.update();
    this._surfMount?.update();

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
    // Maps can disable running entirely via map-settings.can_run (e.g. ceremony
    // maps where dashing breaks pacing) — falls back to gameDef.can_run.
    const mapAllowsRun = this.config.scene.getMapFlag?.('can_run') ?? true;
    if (mapAllowsRun && hasShoes && (store.state.game.alwaysRun ? !runHeld : runHeld)) {
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
   * Per-tick update while in the SURF state. Moves at surf speed; auto-dismounts
   * when the player steps off a water tile onto land.
   */
  surfOnUpdate() {
    if (this.config.scene.registry.get('player_input') === false) return;
    const im = getInputManager();

    this.gridengine.setSpeed(this.config.id, 4);

    const confirmDown = !!im?.isDown(Action.CONFIRM);
    const confirmJustPressed = confirmDown && !this._confirmHeldLastFrame;
    this._confirmHeldLastFrame = confirmDown;
    if (confirmJustPressed) {
      this.handleInteractables();
    } else {
      let dir = null;
      if      (im?.isDown(Action.LEFT))  dir = Direction.LEFT;
      else if (im?.isDown(Action.RIGHT)) dir = Direction.RIGHT;
      else if (im?.isDown(Action.UP))    dir = Direction.UP;
      else if (im?.isDown(Action.DOWN))  dir = Direction.DOWN;
      if (dir) this._surfMove(dir);
    }

    // Safety net: if the player somehow ends up on non-water while idle in
    // SURF state (e.g. map/warp edge case), dismount. The normal flow
    // triggers dismount from _surfMove's hop-onto-land — skip it mid-hop
    // (setPosition has already placed us on the landing tile but state
    // hasn't transitioned yet).
    if (!this._isHopping && !this.gridengine.isMoving(this.config.id) && !this._onWaterTile()) {
      this.stateMachine.setState(this.stateDef.IDLE);
      store.commit('game/SET_ON_SURF', false);
    }

    this._emitMoveCompleteIfTileChanged();
  }

  /**
   * Move in SURF state with per-target gating. Water is always walkable for
   * a surfer; any non-water target triggers a dismount hop onto it.
   *
   * collidesWithTiles stays TRUE throughout the SURF state — we only drop it
   * momentarily around each water step so grid-engine accepts the move onto
   * the water tile (water carries ge_collide). Keeping it on between steps
   * means non-water obstacles still block normal movement and the player
   * can never "walk onto water" if they somehow exit SURF unexpectedly.
   */
  _surfMove(dir) {
    if (this._isHopping) return;
    const target  = this.getPosInDirection(dir);
    const ge      = this.gridengine;
    const scene   = this.config.scene;
    const isWater = !!scene.isWaterTile?.(target.x, target.y);

    if (isWater) {
      // Rocks/cliffs sitting on water share the water tile's sw_water flag
      // but add a second ge_collide source on another layer. hasNonWaterCollision
      // catches those so we don't surf through them while tile collision is
      // momentarily off.
      if (scene.hasNonWaterCollision?.(target.x, target.y)) {
        this.look(dir);
        return;
      }
      // Toggle tile collision off just long enough for grid-engine's move()
      // collision check to pass, then flip it back. Grid-engine checks
      // collision at move-initiation; the in-flight animation is unaffected
      // by changing the flag back to true immediately after.
      this._setCollidesWithTiles(false);
      this.handleMove(dir);
      this._setCollidesWithTiles(true);
      return;
    }

    // Non-water target. isBlocked is a tile/character-layer query — it
    // catches ge_collide walls regardless of our own flag. Blocked → turn.
    if (ge.isBlocked(target, ge.getCharLayer(this.config.id))) {
      this.look(dir);
      return;
    }

    // Walkable non-water = shore. Dismount requires a fresh press; a key held
    // continuously into the shore just bumps. Otherwise the hop lands the
    // player in IDLE while the key is still down, and idleOnUpdate's normal
    // IDLE→MOVE transition steps one extra tile inland before the player can
    // react. Gen 3-style: release, re-press, dismount.
    const im = getInputManager();
    const FRESH_PRESS_MS = 150;
    if ((im?.getDuration(dir) ?? 0) > FRESH_PRESS_MS) {
      this.look(dir);
      return;
    }

    // Fresh press → hop off the surf mount onto land. Freeze the mount so it
    // stays on its water tile while the rider arcs to shore. The hop ends
    // with a transition to IDLE, which fires surfOnExit (restores texture,
    // destroys the mount sprite, emits player-surf-change).
    this.look(dir);
    this._surfMount?.freeze();
    const delta = this._tileDeltaForDir(dir, 1);
    this._hopToTile({
      dx: delta.dx,
      dy: delta.dy,
      onComplete: () => {
        this.stateMachine.setState(this.stateDef.IDLE);
        store.commit('game/SET_ON_SURF', false);
      },
    });
  }

  /** Returns true when the player's current tile is a water tile. */
  _onWaterTile() {
    const pos = this.gridengine.getPosition(this.config.id);
    return this.config.scene.isWaterTile?.(pos.x, pos.y) ?? false;
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
    if (interactableTiles.length > 0) {
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

      if (tile) {
        this.scene.registry.set('last-spoke-to', tile.obj.id);
        this.config.scene.game.events.emit('interact-with-obj', tile);
        return true;
      }
    }

    // Fallback: mount surf when facing a water tile. has_surf gates the
    // actual mount; without it, surface a Gen 3-style hint so the player
    // knows why nothing happened. Skip both if the tile isn't water.
    if (!store.state.game.onSurf && this.config.scene.isWaterTile?.(facingTile.x, facingTile.y)) {
      if (store.state.game.gameFlags?.has_surf) {
        this.stateMachine.setState(this.stateDef.SURF);
        store.commit('game/SET_ON_SURF', true);
        return true;
      }
      this.config.scene.game.events.emit('textbox-changedata',
        'The water is a deep blue...');
      return true;
    }

    return false;
  }

  /**
   * Override: plays `movement_blocked` SFX when the player holds a direction
   * but GridEngine stops accepting moves (wall, character, or map edge).
   * Uses `positionChangeStarted` as the reliable "move was accepted" signal —
   * set up by the player interactable plugin via `_lastMoveSucceededAt`.
   *
   * Also handles the autoSurf "walk onto water" plumbing: with autoSurf +
   * has_surf, briefly drop tile collision around the move so grid-engine
   * accepts the step onto the water tile. The actual SURF transition fires
   * from the positionChangeFinished subscription in interactables/player.js
   * once the move settles — keeps the mount check tied to tile entry rather
   * than the push attempt.
   */
  handleMove(dir) {
    const dirLower = dir.toLowerCase();
    let autoSurfStep = false;
    if (this.getFacingDirection() === dirLower) {
      if (
        store.state.game.autoSurf &&
        store.state.game.gameFlags?.has_surf &&
        this.stateMachine.currentState?.name !== this.stateDef.SURF &&
        !this.gridengine.isMoving(this.config.id)
      ) {
        const target = this.getPosInDirection(dir);
        if (this.config.scene.isWaterTile?.(target.x, target.y)) {
          autoSurfStep = true;
        }
      }

      const now = Date.now();
      if (this._lastMoveAttemptDir !== dirLower) {
        this._lastMoveAttemptDir = dirLower;
        this._moveAttemptStartAt = now;
        this._moveBlockedSoundPlayed = false;
      }
      const speed = this.gridengine.getSpeed?.(this.config.id) || 4;
      const tileDuration = 1000 / speed;
      // Cushion absorbs the frame-order race at tile boundaries: grid-engine's
      // plugin update may fire positionChangeStarted AFTER handleMove in the
      // same frame, leaving _lastMoveSucceededAt one tile stale — without a
      // buffer this check trips on every boundary during smooth walking.
      const cushion = 100;
      const sinceSuccess = now - (this._lastMoveSucceededAt ?? 0);
      const sinceAttempt = now - (this._moveAttemptStartAt ?? now);
      if (!autoSurfStep && sinceSuccess >= tileDuration + cushion && sinceAttempt >= tileDuration + cushion && !this._moveBlockedSoundPlayed) {
        playSfx(this.config.scene, 'movement_blocked');
        this._moveBlockedSoundPlayed = true;
      }
    } else {
      this._lastMoveAttemptDir = null;
      this._moveAttemptStartAt = null;
      this._moveBlockedSoundPlayed = false;
    }

    if (autoSurfStep) this._setCollidesWithTiles(false);
    Character.prototype.handleMove.call(this, dir);
    if (autoSurfStep) this._setCollidesWithTiles(true);
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
