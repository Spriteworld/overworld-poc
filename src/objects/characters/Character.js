import Phaser from 'phaser';
import StateMachine from '@Objects/StateMachine';
import MovableSprite from '@Objects/characters/MovableSprite';
import Reflection from '@Objects/characters/Reflection';
import SurfMount from '@Objects/characters/SurfMount';
import * as Tile from '../Tile.js';
import * as Direction from '../Direction.js';
import { Vector2, getPropertyValue, getInputManager, Action, generateTid } from '@Utilities';
import { playSfx } from '@Utilities/AudioManager.js';
import { getGameDef } from '@Data/gameDef.js';

export default class extends MovableSprite {
  /**
   * @param {object} config - Character configuration merged with sensible defaults.
   * @param {Phaser.Scene} config.scene - The owning GameMap scene.
   * @param {string} config.id - Unique character identifier for GridEngine.
   * @param {string} config.texture - Sprite sheet texture key.
   * @param {number} config.x - Starting tile x position.
   * @param {number} config.y - Starting tile y position.
   * @param {boolean} [config.spin=false] - Whether this character auto-spins.
   * @param {number} [config.spin-rate=600] - Interval in ms between auto-spin direction changes.
   * @param {boolean} [config.move=false] - Whether this character wanders randomly.
   * @param {boolean} [config.collides=true] - Whether GridEngine treats this character as solid.
   * @param {string} [config.facing-direction='down'] - Initial facing direction.
   * @param {number} [config.seen-radius=0] - Tiles in front the character can "see".
   * @param {boolean} [config.track-player=false] - Whether to track the player in a pyramid radius.
   */
  constructor(config) {
    config = {...{
      scene: null,
      id: null,
      spin: false,
      'spin-rate': 600,
      move: false,
      'move-rate': 600,
      'move-radius': 0,
      follow: false,
      'follow-target': null,
      'follow-distance': 1,
      collides: true,
      'facing-direction': Direction.DOWN,
      'seen-radius': 0,
      'seen-character': null,
      'char-layer': 'ground',
      'can-run': true,
      'ignore-warp': false,
      'track-player': false,
      'track-player-radius': 0,
      reflect: false,
      tid: null,
    }, ...config};
    super(config);
    this.config = config;
    // Every character has a trainer ID generated the same way Pokémon
    // trainer IDs are (16-bit public TID). For the player this is provided
    // via config from the store so it's stable across saves; NPCs and
    // trainers get a fresh random one per construction.
    this.tid = (this.config.tid != null) ? (this.config.tid | 0) & 0xffff : generateTid();

    this.rectColor = {
      normal: 0x1d7196,
      selected: 0xff0000
    };

    if (this.config.scene.characters.get(this.config.id)) {
      this.config.id = (Math.random() + 1).toString(36).substring(7);
    }

    let identification = (this.config.id ?? this.config.texture);
    this.setName(identification);

    this.stateDef = {
      IDLE: 'idle',
      MOVE: 'move',
      BIKE: 'bike',
      SURF: 'surf',
      LOOK: 'look',
      SPIN: 'spin',
      SLIDE: 'slide',
      JUMP: 'jump',
      JUMP_LEDGE: 'jump_ledge',
    };

    this.stateMachine = new StateMachine(this, this.config.id);
    this.initalCreation = true;
    this.spinRate = parseInt(this.config['spin-rate']);
    
    this._baseMovementState = this.stateDef.IDLE;

    this.config.scene.add.existing(this);
    this.config.scene.addCharacter(this);

    if (this.config.reflect) {
      this.reflection = new Reflection({
        parent: this,
        offsetY: this.config['reflect-offset-y'] ?? 0,
      });
      this.once('destroy', () => this.reflection?.destroy());
    }

    this._installBobRenderHooks();

    this.initSeenRadius(identification);
    this.trackingCoords = [];
    this._trackingCoordsMap  = null;      // "x,y" → dir, set by generateTrackingCoords
    this._trackingCoordsStale = true;     // rebuild on first canTrackPlayer
    this._lastSightSeq = -1;              // GameMap._tileSeq at last canSeeCharacter
    this._lastTrackSeq = -1;              // GameMap._playerTileSeq at last canTrackPlayer
    this._refreshHasUpdateWork();
  }

  /**
   * Recompute whether this character has any per-frame work (auto-spin/move/
   * follow, line-of-sight, or tracking). Static NPCs (no behavior + no sight
   * radius) skip their update() body entirely so on-screen crowds are cheap.
   * Called from the constructor and from setMovementBehavior.
   */
  _refreshHasUpdateWork() {
    const c = this.config;
    this._hasUpdateWork = !!(
      c.spin ||
      c.move ||
      c.follow ||
      c['track-player'] ||
      c['avoid-character'] ||
      (c['seen-radius'] ?? 0) > 0
    );
  }

  /**
   * Returns the walking animation frame mapping for a standard 16-frame character sheet.
   * @returns {{ up: object, down: object, left: object, right: object }}
   */
  characterFramesDef() {
    return {
      up: { leftFoot: 13, standing: 12, rightFoot: 15 },
      down: { leftFoot: 1, standing: 0, rightFoot: 3 },
      left: { leftFoot: 7, standing: 4, rightFoot: 5 },
      right: { leftFoot: 9, standing: 8, rightFoot: 11 },
    };
  }

  /**
   * Returns the frame mapping for the bike spritesheet. Same 16-frame layout
   * as the walking sheet; pedal positions replace left/right foot frames.
   * @returns {{ up: object, down: object, left: object, right: object }}
   */
  characterFramesBikeDef() {
    return {
      up: { leftFoot: 13, standing: 12, rightFoot: 15 },
      down: { leftFoot: 1, standing: 0, rightFoot: 3 },
      left: { leftFoot: 7, standing: 4, rightFoot: 5 },
      right: { leftFoot: 9, standing: 8, rightFoot: 11 },
    };
  }

  /**
   * Returns a static (non-animated) frame mapping where all foot positions
   * resolve to the same standing frame — used during slides and jumps.
   * @returns {{ up: object, down: object, left: object, right: object }}
   */
  characterFramesStaticDef() {
    return {
      up: { leftFoot: 12, standing: 12, rightFoot: 12 },
      down: { leftFoot: 0, standing: 0, rightFoot: 0 },
      left: { leftFoot: 4, standing: 4, rightFoot: 4 },
      right: { leftFoot: 8, standing: 8, rightFoot: 8 },
    };
  }

  /**
   * Delegate a state transition to this character's StateMachine.
   * @param {string} state - State name from `this.stateDef`.
   */
  setState(state) {
    this.stateMachine.setState(state);
  }

  /**
   * Create the debug rectangles used to visualise the character's
   * position and its line-of-sight detection zone.
   * @param {string} identification - Unique name prefix for the rectangles.
   */
  initSeenRadius(identification) {
    this.seenRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      0, 0,
      this.rectColor.normal,
      this.scene.game.config.debug.tests.rectOutlines ? 0.4 : 0
    );
    this.characterRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      30, 30,
      this.rectColor.normal,
      this.scene.game.config.debug.tests.rectOutlines ? 0.5 : 0
    );

    this.seenRect.setOrigin(0, 0);
    this.seenRect.setName(identification+'-seen');
    this.characterRect.setOrigin(0, 0);
    this.characterRect.setName(identification+'-character');

    if (!this.scene.game.config.debug.tests.rectOutlines) {
      this.seenRect.setVisible(false);
      this.characterRect.setVisible(false);
    }
  }

  /**
   * State callback: called when entering the IDLE state.
   * Resets spinning, sliding, and jumping direction trackers.
   */
  idleOnEnter() {
    this.spinningDir = null;
    this.slidingDir = null;
    this.jumpingDir = null;
    this._moveDebounceUntil = 0;
    this._lastBlockedTile = null;
  }
  /** State callback: called when leaving the IDLE state. */
  idleOnExit() {}

  /**
   * Idle update for non-player characters. Does not poll input — only refreshes
   * the collision rect. Player overrides this with full input handling.
   */
  npcIdleOnUpdate() {
    this.updateCharacterRect();
  }

  /**
   * State callback: polls cursor keys each tick and transitions to MOVE
   * when any directional key is held. Also refreshes the character collision rect.
   */
  idleOnUpdate() {
    const im = getInputManager();
    if (!im) { this.updateCharacterRect(); return; }

    let dir = null;
    if      (im.isDown(Action.LEFT))  dir = 'left';
    else if (im.isDown(Action.RIGHT)) dir = 'right';
    else if (im.isDown(Action.UP))    dir = 'up';
    else if (im.isDown(Action.DOWN))  dir = 'down';

    if (dir) {
      if (this.getFacingDirection() !== dir) {
        this.look(dir);
        this._moveDebounceUntil = Date.now() + 100;
      }
      this.stateMachine.setState(this.stateDef.MOVE);
    }
    this.updateCharacterRect();
  }

  /** State callback: per-tick logic while in the MOVE state (subclasses override). */
  moveOnUpdate() {}

  /**
   * State callback: called when leaving the MOVE state.
   * Refreshes the character collision rect.
   */
  moveOnExit() {
    this.updateCharacterRect();
  }

  /**
   * Sync the character's collision rectangle position to match its current
   * rendered bounds. Applies a type-specific pixel offset for pokemon sprites.
   */
  updateCharacterRect() {
    let character = this.config.scene.characters.get(this.config.id);
    if (!character) {
      return;
    }
    let characterBounds = character.getBounds();

    this.characterRect.x = (characterBounds.x+1) +
      (character.config.type === 'pkmn' ? 16 : 0);
    this.characterRect.y = (characterBounds.y+1) +
      (character.config.type === 'pkmn' ? 32 : 8);
  }

  /**
   * Process a directional move request. If already facing that direction,
   * moves immediately; otherwise looks first and moves only after the key
   * has been held long enough (150 ms debounce).
   * @param {string} dir - Direction constant (up | down | left | right).
   */
  handleMove(dir) {
    dir = dir.toLowerCase();

    if (this.getFacingDirection() !== dir) {
      this.look(dir);
      this._moveDebounceUntil = Date.now() + 100;
      return;
    }

    if (this._moveDebounceUntil && Date.now() < this._moveDebounceUntil) {
      return;
    }
    this._moveDebounceUntil = 0;

    if (!this.canMove(dir.toUpperCase())) {
      if (this.config.type === 'player') {
        const target = this.getPosInDirection(dir.toUpperCase());
        const key = `${target.x},${target.y}`;
        if (this._lastBlockedTile !== key) {
          this._lastBlockedTile = key;
          this.config.scene.game.events.emit('player-blocked-tile', target);
        }
      }
      return;
    }
    this._lastBlockedTile = null;
    this.move(dir);
  }

  /** State callback: start the spin animation and lock the spin direction. */
  spinOnEnter() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, undefined);
    this.anims.play(this.config.texture + '-spin');
    this.spinningDir = this.getFacingDirection();
  }
  /** State callback: keep moving in the locked spin direction each tick. */
  spinOnUpdate() {
    if (!this.isSpinning()) { return; }
    this.move(this.spinningDir);
  }
  /** State callback: restore the walking animation mapping and clear the spin direction. */
  spinOnExit() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.anims.stop();
    this.spinningDir = null;
  }
  /**
   * Returns true when the character is in an active spin.
   * @returns {boolean}
   */
  isSpinning() {
    return this.spinningDir !== null;
  }

  /**
   * Returns the direction the character is currently spinning, or null.
   * @returns {string|null}
   */
  getSpinningDirection() {
    return this.spinningDir;
  }

  /**
   * Look in the given direction and lock it as the active spin direction.
   * @param {string} dir - Direction constant (UP | DOWN | LEFT | RIGHT).
   */
  setSpinDirection(dir) {
    this.look(dir);
    this.spinningDir = dir;
  }

  /** State callback: freeze walk animation and lock the slide direction. */
  slideOnEnter() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesStaticDef());
    this.slidingDir = this.getFacingDirection();
  }
  /** State callback: continue moving in the locked slide direction each tick. */
  slideOnUpdate() {
    if (!this.isSliding()) { return; }
    this.move(this.slidingDir);
  }
  /** State callback: restore the walk animation mapping and clear the slide direction. */
  slideOnExit() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.anims.stop();
    this.slidingDir = null;
  }
  /**
   * Returns true when the character is actively sliding on an ice tile.
   * @returns {boolean}
   */
  isSliding() {
    return this.slidingDir !== null;
  }

  /**
   * Returns the direction the character is currently sliding, or null.
   * @returns {string|null}
   */
  getSlidingDirection() {
    return this.slidingDir;
  }

  /** State callback: swap to the bike texture and frame mapping when entering the BIKE state. */
  bikeOnEnter() {
    this._baseMovementState = this.stateDef.BIKE;
    const bikeTexture = this.config.texture + '_bike';
    if (this.config.scene.textures.exists(bikeTexture)) {
      this.setTexture(bikeTexture);
    }
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesBikeDef());
    this.look(this.getFacingDirection());
  }
  /** State callback: restore the base texture and frame mapping when leaving the BIKE state. */
  bikeOnExit() {
    this._baseMovementState = this.stateDef.IDLE;
    this.setTexture(this.config.texture);
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.look(this.getFacingDirection());
  }

  characterFramesSurfDef() {
    return this.characterFramesDef();
  }

  /** State callback: swap to the surf texture and frame mapping when entering the SURF state. */
  surfOnEnter() {
    this._baseMovementState = this.stateDef.SURF;
    const surfTexture = this.config.texture + '_surf';
    if (this.config.scene.textures.exists(surfTexture)) {
      this.setTexture(surfTexture);
    }
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesSurfDef());
    this.look(this.getFacingDirection());

    this.scene.game.events.emit('player-surf-change', true, this);

    // Two ways to enter SURF:
    //   1. Pressing A while facing water (handleInteractables) — we're on
    //      land, hop forward onto the water tile.
    //   2. autoSurf: the player just walked onto a water tile — already
    //      there, skip the hop so we don't land two tiles deep.
    const pos = this.getPosition();
    const alreadyOnWater = !!this.config.scene.isWaterTile?.(pos.x, pos.y);
    const spawnMount = () => {
      if (!this._surfMount) {
        this._surfMount = new SurfMount({ parent: this });
        this.once('destroy', () => this._surfMount?.destroy());
      }
    };

    if (alreadyOnWater) {
      spawnMount();
      return;
    }

    const delta = this._tileDeltaForDir(this.getFacingDirection(), 1);
    this._hopToTile({
      dx: delta.dx,
      dy: delta.dy,
      onComplete: () => {
        // _hopToTile swaps to static frames during the arc — restore the
        // surf walk mapping so subsequent _surfMove() plays surf anims.
        this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesSurfDef());
        spawnMount();
      },
    });
  }

  /** State callback: restore the base texture and frame mapping when leaving the SURF state. */
  surfOnExit() {
    this._baseMovementState = this.stateDef.IDLE;
    this.setTexture(this.config.texture);
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.look(this.getFacingDirection());

    if (this._surfMount) {
      this._surfMount.destroy();
      this._surfMount = null;
    }
    this.scene.game.events.emit('player-surf-change', false, this);
  }

  /**
   * Vertical bob applied while the character occupies a water tile, phase-
   * matched to the water shader's wave so riders rise and fall with the
   * surface they're on. Call from the subclass's per-frame update() AFTER
   * the state machine (so any GE-driven y change has already landed) and
   * BEFORE reflection / surf-mount sync (so they bob with the parent).
   *
   * Bookkeeping: when stationary GE doesn't touch sprite.y, so we own it
   * and must restore last frame's offset before applying a new one. When
   * moving, GE re-writes sprite.y each tick (overwriting last frame's bob),
   * so we skip the restore. `gridEngine.isMoving(id)` distinguishes.
   */
  _applyWaterBob(time) {
    const ge = this.scene?.gridEngine;
    const id = this.config?.id;
    if (!ge?.hasCharacter?.(id)) { this._waterBobY = 0; return; }

    const pos = ge.getPosition(id);
    if (!pos || !this.scene.isWaterTile?.(pos.x, pos.y)) {
      this._waterBobY = 0;
      return;
    }

    // Compute-only: store the desired offset; the actual sprite.y mutation
    // happens inside the camera's PRE_RENDER hook (see _installBobRenderHooks).
    // That timing keeps the bob out of camera follow-scroll calculations,
    // which run earlier in camera.preRender — so the viewport never moves.
    const AMPLITUDE_PX = 3;
    const SPEED        = 4.0;
    const t = time / 1000;
    this._waterBobY = Math.cos(this.x * 0.08 - t * SPEED) * AMPLITUDE_PX;
  }

  /**
   * Hook the main camera's PRE_RENDER / POST_RENDER events to apply and
   * revert the per-frame water bob exclusively for rendering. Phaser's
   * camera computes follow-scroll inside camera.preRender BEFORE its
   * PRE_RENDER event fires, so by the time we mutate sprite.y here the
   * scroll is already locked to the un-bobbed position. POST_RENDER (after
   * the camera renders the display list) reverts the offset so the next
   * scene-update tick sees the clean logical y — no drift, no GE conflict.
   * Reflection and surf mount sprites get the same delta pushed through
   * because their own update() ran during scene-update with un-bobbed parent
   * y, so they need a render-time nudge too.
   */
  _installBobRenderHooks() {
    const cam = this.config.scene?.cameras?.main;
    if (!cam) return;

    this._onCamPreRender = () => {
      const off = this._waterBobY || 0;
      if (!off) return;
      this.y += off;
      if (this.reflection?.sprite) this.reflection.sprite.y += off;
      if (this._surfMount?.sprite)  this._surfMount.sprite.y  += off;
    };
    this._onCamPostRender = () => {
      const off = this._waterBobY || 0;
      if (!off) return;
      this.y -= off;
      if (this.reflection?.sprite) this.reflection.sprite.y -= off;
      if (this._surfMount?.sprite)  this._surfMount.sprite.y  -= off;
    };

    cam.on(Phaser.Cameras.Scene2D.Events.PRE_RENDER,  this._onCamPreRender);
    cam.on(Phaser.Cameras.Scene2D.Events.POST_RENDER, this._onCamPostRender);

    this.once('destroy', () => {
      try {
        cam.off(Phaser.Cameras.Scene2D.Events.PRE_RENDER,  this._onCamPreRender);
        cam.off(Phaser.Cameras.Scene2D.Events.POST_RENDER, this._onCamPostRender);
      } catch (_) {}
    });
  }

  /**
   * Flip this character's tile-collision flag at runtime. Grid-engine v2.48
   * doesn't expose a public setter. The real GridCharacter lives on the
   * headless engine — `gridEngine.gridCharacters` on the Phaser plugin holds
   * a sprite/offset wrapper that does NOT carry `setCollidesWithTiles`, so
   * reaching through `geHeadless.gridCharacters` is required. Wrapped so
   * callers fail soft if that ever changes. Used by Player._surfMove to
   * briefly disable collision around each water step so grid-engine accepts
   * moves onto water tiles (which carry ge_collide).
   */
  _setCollidesWithTiles(collides) {
    const gc = this.gridengine?.geHeadless?.gridCharacters?.get?.(this.config.id);
    gc?.setCollidesWithTiles?.(collides);
  }

  /**
   * Transition back to whichever base movement state is active (IDLE or BIKE).
   * Use this instead of hardcoding setState(IDLE) after ledge jumps and slides.
   */
  _returnToBaseMovement() {
    this.stateMachine.setState(this._baseMovementState);
  }

  /** State callback: log the start of a jump (placeholder). */
  jumpOnEnter() {
    if (this.scene.game.config.debug.console.character) console.log('JUMP START');
  }
  /** State callback: tween a simple vertical arc and return to IDLE on completion. */
  jumpOnUpdate() {
    let jumpHeight = Tile.HEIGHT;
    this.config.scene.tweens.add({
      targets: this,
      y: this.getBounds().y - jumpHeight,
      yoyo: true,
      ease: 'linear',
      duration: 320,
      complete: () => {
        this._returnToBaseMovement();
      },
    });
  }
  /** State callback: log the end of a jump (placeholder). */
  jumpOnExit() {
    if (this.scene.game.config.debug.console.character) console.log('JUMP END');
  }

  /**
   * Resolve a (dx, dy) tile delta for a facing direction and distance (in tiles).
   * @param {string} dir - Direction ('up' | 'down' | 'left' | 'right'; any case).
   * @param {number} [tiles=1]
   */
  _tileDeltaForDir(dir, tiles = 1) {
    const d = (dir || Direction.DOWN).toUpperCase();
    const unit = {
      [Direction.DOWN]:  { dx: 0,  dy: 1  },
      [Direction.UP]:    { dx: 0,  dy: -1 },
      [Direction.LEFT]:  { dx: -1, dy: 0  },
      [Direction.RIGHT]: { dx: 1,  dy: 0  },
    }[d] || { dx: 0, dy: 0 };
    return { dx: unit.dx * tiles, dy: unit.dy * tiles };
  }

  /**
   * Hop the character from its current tile to (currentTile + dx, currentTile + dy)
   * with an arc. GridEngine is anchored to the landing tile up-front and the
   * sprite's visual offset is tweened back to (0, 0), so GE's per-frame
   * `updatePixelPos()` carries the sprite along the arc.
   *
   * Sets `this._isHopping` for the duration so per-tick state logic (e.g. the
   * auto-dismount in `Player.surfOnUpdate`) can skip mid-arc. Callers are
   * responsible for restoring the walking-animation mapping in `onComplete`
   * — this helper swaps to static frames while in flight.
   *
   * @param {object} opts
   * @param {number} opts.dx - Tile delta X.
   * @param {number} opts.dy - Tile delta Y.
   * @param {() => void} [opts.onComplete]
   */
  _hopToTile({ dx, dy, onComplete }) {
    const currentTile = this.getPosition();
    const landingTile = { x: currentTile.x + dx, y: currentTile.y + dy };

    this._isHopping = true;
    this.gridengine.stopMovement(this.config.id);
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesStaticDef());
    playSfx(this.config.scene, 'ledge_jump');

    // GridEngine updates sprite.x/y every frame via updatePixelPos().
    // Tweening this.x/y directly fights that and loses.
    // Instead: anchor GE to landingTile immediately, then tween a visual
    // offset from (startPixels - landingPixels) back to (0, 0) so GE's
    // own update carries the sprite to the correct position each frame.
    const pixelDX  = dx * Tile.WIDTH;
    const pixelDY  = dy * Tile.HEIGHT;
    const arcHeight = Tile.HEIGHT;

    this.gridengine.setPosition(
      this.config.id,
      landingTile,
      this.config['char-layer'] || 'ground'
    );

    // Ledge jumps triggered from positionChangeStarted can leave grid-engine's
    // last-movement-direction stale, so the standing frame picked from the
    // static mapping renders the default (frame 0 = down) during left/right
    // hops. Derive the hop direction from the delta and turn the character
    // towards it to force the standing frame to the correct facing.
    let hopDir = null;
    if      (dx < 0) hopDir = Direction.LEFT;
    else if (dx > 0) hopDir = Direction.RIGHT;
    else if (dy < 0) hopDir = Direction.UP;
    else if (dy > 0) hopDir = Direction.DOWN;
    if (hopDir) this.look(hopDir);

    this.gridengine.setOffsetX(this.config.id, -pixelDX);
    this.gridengine.setOffsetY(this.config.id, -pixelDY);

    // Arc peak offset: 30% forward + arc up
    const midOX = -pixelDX + pixelDX * 0.3;
    const midOY = -pixelDY + pixelDY * 0.3 - arcHeight;

    const proxy = { ox: -pixelDX, oy: -pixelDY };

    // Phase 1 (120 ms): hop up and slightly forward
    this.config.scene.tweens.add({
      targets:  proxy,
      ox: midOX,
      oy: midOY,
      duration: 120,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.gridengine.setOffsetX(this.config.id, proxy.ox);
        this.gridengine.setOffsetY(this.config.id, proxy.oy);
      },
      onComplete: () => {
        // Phase 2 (200 ms): fall to landing
        this.config.scene.tweens.add({
          targets:  proxy,
          ox: 0,
          oy: 0,
          duration: 200,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            this.gridengine.setOffsetX(this.config.id, proxy.ox);
            this.gridengine.setOffsetY(this.config.id, proxy.oy);
          },
          onComplete: () => {
            this.gridengine.setOffsetX(this.config.id, 0);
            this.gridengine.setOffsetY(this.config.id, 0);
            this._isHopping = false;
            onComplete?.();
          },
        });
      },
    });
  }

  /** State callback: hop two tiles forward in the facing direction (ledge jump). */
  jumpLedgeOnEnter() {
    // bikeOnExit() runs before this and resets _baseMovementState to IDLE.
    // Restore it so _returnToBaseMovement() returns to BIKE after the jump.
    if (this.stateMachine.previousState?.name === this.stateDef.BIKE) {
      this._baseMovementState = this.stateDef.BIKE;
      const bikeTexture = this.config.texture + '_bike';
      if (this.config.scene.textures.exists(bikeTexture)) {
        this.setTexture(bikeTexture);
      }
    }

    this.jumpingDir = this.getFacingDirection().toUpperCase();
    const delta = this._tileDeltaForDir(this.jumpingDir, 2);

    this._hopToTile({
      dx: delta.dx,
      dy: delta.dy,
      onComplete: () => {
        this.jumpingDir = null;
        this.gridengine.setWalkingAnimationMapping(
          this.config.id,
          this._baseMovementState === this.stateDef.BIKE
            ? this.characterFramesBikeDef()
            : this.characterFramesDef()
        );
        this._returnToBaseMovement();
      },
    });
  }
  /** State callback: no per-tick logic needed during a ledge jump. */
  jumpLedgeOnUpdate() { }

  /**
   * State callback: clean up GridEngine offsets and restore the walk animation
   * mapping after a ledge jump completes or is interrupted.
   */
  jumpLedgeOnExit() {
    this.jumpingDir = null;
    this.gridengine.setOffsetX(this.config.id, 0);
    this.gridengine.setOffsetY(this.config.id, 0);
    this.gridengine.setWalkingAnimationMapping(
      this.config.id,
      this._baseMovementState === this.stateDef.BIKE
        ? this.characterFramesBikeDef()
        : this.characterFramesDef()
    );
  }
  /**
   * Returns true when the character is currently performing a ledge jump.
   * @returns {boolean}
   */
  isJumping() {
    return this.jumpingDir !== null;
  }

  /**
   * If `config.move` is true, begin GridEngine random wandering and then
   * clear the flag so it only triggers once.
   */
  addAutoMove() {
    if (this.config.move !== true) { return; }
    this.gridengine.moveRandomly(this.config.id, this.config['move-rate'], 1);
    this.config.move = false;
    this._autoMoving = true;
  }

  /**
   * Start following a target character using Gen 2-style breadcrumb trail:
   * each time the leader vacates a tile, the follower walks onto it.
   * Requires `config.follow === true` and `config['follow-target']` to be set.
   */
  addAutoFollow() {
    if (!this.config.follow || this._followStarted) return;
    const target = this.config['follow-target'];
    if (!target || !this.gridengine.hasCharacter(target)) return;
    this._startBreadcrumbFollow(target);
  }

  /**
   * Subscribe to the leader's position-change stream and walk this character
   * onto each tile the leader just vacated. Mirrors the player_mon follower.
   */
  _startBreadcrumbFollow(leaderId) {
    const ge = this.gridengine;
    const followerId = this.config.id;
    if (!ge?.hasCharacter(followerId) || !ge.hasCharacter(leaderId)) return;
    this._stopBreadcrumbFollow();
    // Use positionChangeFinished so the leader has fully vacated the tile before
    // the follower's pathfind runs — otherwise a colliding follower (anything
    // except collides:false like playerMon) treats the leader as a path blocker.
    this._followTrailSub = ge.positionChangeFinished().subscribe(({ charId, exitTile }) => {
      if (charId !== leaderId) return;
      if (!ge.hasCharacter(followerId)) return;
      ge.moveTo(followerId, exitTile, {
        noPathFoundStrategy: 'STOP',
        pathBlockedStrategy: 'WAIT',
      });
    });
    this._followStarted = true;
    this.once?.('destroy', () => this._stopBreadcrumbFollow());
  }

  _stopBreadcrumbFollow() {
    if (this._followTrailSub) {
      this._followTrailSub.unsubscribe();
      this._followTrailSub = null;
    }
    this._followStarted = false;
  }

  /**
   * Called each update tick to handle the initial facing direction on first creation
   * and periodic random direction changes when `config.spin` is true.
   * @param {number} delta - Time in ms since the last frame.
   */
  applyInitialFacing() {
    const lookDir = (this.config['facing-direction'] ?? Direction.DOWN).toUpperCase();
    if (this.look(lookDir) === false) return;
    this.initalCreation = false;
  }

  addAutoSpin(delta) {
    if (this.initalCreation) {
      this.applyInitialFacing();
      if (this.initalCreation) return;
    }

    if (this.config.spin !== true && this.config['spin-rate'] && delta) { return; }
    if (!this.config['spin-rate'] || !delta) { return; }
    this.spinRate -= delta;
    if (this.spinRate <= 0) {
      this.spinRate = parseInt(this.config['spin-rate']);

      let directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
      let dir = Phaser.Math.RND.pick(directions);

      if (this.scene.game.config.debug.console.character) {
        console.log('Character::addAutoSpin', this.config.id, 'looking at', dir);
      }
      this.look(dir);
    }
  }

  /**
   * Disable auto-spinning. Optionally re-enable it after the next textbox closes.
   * @param {boolean} [restart=false] - If true, resume spinning on the next `textbox-disable` event.
   */
  stopSpin(restart=false) {
    const wasSpin = this.config.spin;
    this.config.spin = false;

    if (restart && wasSpin) {
      this.scene.game.events.once('textbox-disable', this.startSpin, this);
    }
  }

  /** Re-enable auto-spinning. */
  startSpin() {
    this.config.spin = true;
  }

  /**
   * Stop random wandering. Optionally resume it after the next textbox closes.
   * Only restarts if the character was previously set up to auto-move.
   * @param {boolean} [restart=false]
   */
  stopMove(restart = false) {
    this.gridengine.stopMovement(this.config.id);
    if (restart && this._autoMoving) {
      this.scene.game.events.once('textbox-disable', this.startMove, this);
    }
  }

  /** Resume random wandering. */
  startMove() {
    this.gridengine.moveRandomly(this.config.id, this.config['move-rate'], 1);
  }

  /**
   * Rebuild the set of tile coordinates that the player must occupy for this
   * character to "track" them, forming four directional pyramids around the NPC.
   */
  generateTrackingCoords() {
    if (typeof this.config['track-player'] === 'undefined' 
      && typeof this.config['avoid-character'] === 'undefined') { return; }
        
    if (this.config['track-player'] === false) {
      return;
    }
    if (this.config['avoid-character'] === false) { 
      return; 
    }

    const radius = this.config['track-player-radius'];
    const pyramidCount = [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29];
    const npcBounds = this.getBounds();
    const baseX = parseInt(npcBounds.x / Tile.WIDTH);
    const baseY = parseInt(npcBounds.y / Tile.HEIGHT);

    this.trackingCoords = [];
    this._trackingCoordsMap = new Map();
    this._trackingCoordsStale = false;

    const debugRects = !this.isMoving() && this.scene.game.config.debug.tests.rectOutlines;

    const addCoord = (cx, cy, dir) => {
      this.trackingCoords.push({ x: cx, y: cy, dir });
      this._trackingCoordsMap.set(cx + ',' + cy, dir);
      if (debugRects) {
        const tile = this.config.scene.add.rectangle(
          cx * Tile.WIDTH, cy * Tile.HEIGHT,
          Tile.WIDTH, Tile.HEIGHT,
          this.rectColor.normal,
          0.5,
        );
        tile.setOrigin(0, 0);
      }
    };

    // top pyramid
    let npcX = baseX - 1;
    let npcY = baseY;
    for (let i = 0; i < radius; i++) {
      let cx = npcX - i;
      const cy = npcY - i;
      for (let j = 0; j < pyramidCount[i]; j++) {
        cx += 1;
        addCoord(cx, cy, Direction.UP);
      }
    }

    // bottom pyramid
    npcX = baseX + 1;
    npcY = baseY + 2;
    for (let i = 0; i < radius; i++) {
      let cx = npcX + i;
      const cy = npcY + i;
      for (let j = 0; j < pyramidCount[i]; j++) {
        cx -= 1;
        addCoord(cx, cy, Direction.DOWN);
      }
    }

    // right pyramid
    npcX = baseX + 1;
    npcY = baseY;
    for (let i = 0; i < radius; i++) {
      const cx = npcX + i;
      let cy = npcY - i;
      for (let j = 0; j < pyramidCount[i]; j++) {
        cy += 1;
        addCoord(cx, cy, Direction.RIGHT);
      }
    }

    // left pyramid
    npcX = baseX - 1;
    npcY = baseY;
    for (let i = 0; i < radius; i++) {
      const cx = npcX - i;
      let cy = npcY - i;
      for (let j = 0; j < pyramidCount[i]; j++) {
        cy += 1;
        addCoord(cx, cy, Direction.LEFT);
      }
    }
  }

  /**
   * Check whether the player is within this character's tracking pyramid.
   * If so, fires the `event-can-see-character` callback and turns toward the player.
   */
  canTrackPlayer() {
    if (this.config['track-player'] !== true
      && this.config['avoid-character'] === false) {
      return;
    }
    // The player's tile must have changed (or our own pyramid must be stale
    // from our own movement) for this check to produce a new result.
    const playerSeq = this.config.scene._playerTileSeq ?? 0;
    if (this._lastTrackSeq === playerSeq && !this._trackingCoordsStale) return;
    this._lastTrackSeq = playerSeq;

    let player = this.config.scene.mapPlugins['player'].player;
    let playerPos = player.getPosition();

    if (this._trackingCoordsStale || this.trackingCoords.length === 0) {
      this.generateTrackingCoords();
    }

    const key = parseInt(playerPos.x) + ',' + parseInt(playerPos.y);
    const dir = this._trackingCoordsMap?.get(key);
    if (!dir) return;

    if (typeof this.config['event-can-track-character'] === 'function') {
      this.config['event-can-track-character'](this.config.id, dir);
    } else {
      this.look(dir.toLowerCase());
    }
  }

  /**
   * Cast a line-of-sight check up to `seen-radius` tiles, stopping at collisions.
   * If `facing-direction` was explicitly set in properties, only checks the current
   * facing direction. Otherwise checks all four directions.
   * Fires `event-can-see-character` if the target falls within the sight rectangle.
   */
  canSeeCharacter() {
    if (this.scene.game.config.debug.noTrainerSight) { return; }
    if ((this.config['seen-radius'] ?? 0) === 0) { return; }
    if (this.config['seen-character'] === null || this.config['seen-character']?.length === 0) { return; }
    // Per-map / gameDef opt-out — set map-settings.can_see = false to
    // disable every trainer / NPC line-of-sight cast on this map (e.g.
    // a stealth section the player is meant to sneak through).
    if (this.config.scene.getMapFlag && !this.config.scene.getMapFlag('can_see')) { return; }
    // Skip the sight cast when no character has moved on the map since our
    // last evaluation — the prior `isInside` result is still correct.
    const seq = this.config.scene._tileSeq ?? 0;
    if (this._lastSightSeq === seq) return;
    this._lastSightSeq = seq;

    if (!this.gridengine.hasCharacter(this.config['seen-character'])) {
      if (this.scene.game.config.debug.tests.rectOutlines) {
        console.log('GridEngine doesnt know about character: ', this.config['seen-character'], this.config.id);
      }
      return;
    }

    const character = this.config.scene.characters.get(this.config['seen-character']);
    if (!character) {
      if (this.scene.game.config.debug.tests.rectOutlines) {
        console.log(this.config['seen-character'], 'gamemap doesnt has character');
      }
      return;
    }

    // A trainer can only see the way they're currently facing. For spinner
    // trainers the facing rotates over time via addAutoSpin, so this
    // naturally re-evaluates each tick to the direction the sprite is
    // actually pointing — letting the player sneak past while they're
    // turned away.
    //
    // Two opt-ins escalate to omnidirectional sight (all four cardinals at
    // once, impossible to slip past):
    //   • per-trainer `impassible: true` (Tiled property) — flags one
    //     specific trainer as a key encounter that always sees everywhere,
    //     regardless of the gameDef.
    //   • gameDef `impassibleSpinners: true` — applies the same effect to
    //     every spinner trainer in the run, for ROM-hack-style mods.
    // Either trigger flips the same path; static trainers without
    // `impassible` stay single-direction even when the gameDef flag is on.
    const isSpinner   = !!this.config.spin;
    const omniByDef   = isSpinner && !!getGameDef().impassibleSpinners;
    const omniByProp  = !!this.config.impassible;
    let isInside;
    if (omniByDef || omniByProp) {
      isInside = false;
      for (const dir of [Direction.LEFT, Direction.RIGHT, Direction.UP, Direction.DOWN]) {
        if (this._sightCheckDir(dir, character)) { isInside = true; break; }
      }
    } else {
      isInside = this._sightCheckDir(this.getFacingDirection(), character);
    }

    if (isInside && typeof this.config['event-can-see-character'] === 'function') {
      this.config['event-can-see-character'](this.config.id);
    }
    this.seenRect.fillColor = isInside
      ? this.rectColor.selected
      : this.rectColor.normal;
  }

  /**
   * Check sight in a single direction. Updates `seenRect` to the computed
   * rectangle and returns whether the target character is inside it.
   */
  _sightCheckDir(dir, character) {
    dir = dir.toUpperCase();
    const npcBounds  = this.getBounds();
    const faceDir    = this.getPosInDirection(dir);
    const radius     = this.config['seen-radius'];
    const isPkmn     = this.config.type === 'pkmn';

    let count = radius;
    for (let i = 0; i < radius; i++) {
      let tile;
      switch (dir.toUpperCase()) {
        case Direction.LEFT:  tile = Vector2(faceDir.x - i, faceDir.y); break;
        case Direction.RIGHT: tile = Vector2(faceDir.x + i, faceDir.y); break;
        case Direction.UP:    tile = Vector2(faceDir.x, faceDir.y - i); break;
        case Direction.DOWN:  tile = Vector2(faceDir.x, faceDir.y + i); break;
      }
      const blocked = this.config.scene.isCharacterOnTile(tile.x, tile.y)
                   || this.gridengine.isBlocked(tile);
      if (blocked) { count = i; break; }
    }

    const seenRadiusInTiles = count * Tile.WIDTH;

    switch (dir) {
      case Direction.LEFT:
        this.seenRect.x      = ((faceDir.x + 1) * Tile.WIDTH) - seenRadiusInTiles;
        this.seenRect.y      = npcBounds.y + (isPkmn ? 30 : 8);
        this.seenRect.width  = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
        break;
      case Direction.RIGHT:
        this.seenRect.x      = faceDir.x * Tile.WIDTH;
        this.seenRect.y      = npcBounds.y + (isPkmn ? 30 : 8);
        this.seenRect.width  = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
        break;
      case Direction.UP:
        this.seenRect.x      = npcBounds.x + (isPkmn ? 15 : 0);
        this.seenRect.y      = ((faceDir.y + 1) * Tile.HEIGHT) - seenRadiusInTiles;
        this.seenRect.width  = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
        break;
      case Direction.DOWN:
        this.seenRect.x      = npcBounds.x + (isPkmn ? 15 : 0);
        this.seenRect.y      = faceDir.y * Tile.HEIGHT;
        this.seenRect.width  = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
        break;
    }

    return Phaser.Geom.Rectangle.ContainsPoint(this.seenRect, character.characterRect);
  }

  setMovementBehavior(movement, target) {
    if (this.scene.game.config.debug.console.character) {
      console.log('Setting movement behavior for', this.config.id, 'to', movement, 'with target', target);
    }
    this.config['movement-target'] = target;
    switch (movement) {
      case 'match-movement':
        this.config['movement-behavior'] = movement;
      break;
      case 'mirror-move':
        this.config['movement-behavior'] = movement;
      break;
      case 'follow': {
        const ge = this.gridengine;
        const targetId = ge?.hasCharacter(target)
          ? target
          : (ge?.hasCharacter('npc_' + target) ? 'npc_' + target : null);
        if (!ge || !targetId || !ge.hasCharacter(this.config.id)) {
          console.warn('[Character.setMovementBehavior] follow: target not found:', target);
          break;
        }
        this.config['movement-behavior'] = 'follow';
        this.config['follow-target']     = targetId;
        this.config.follow               = true;
        this._startBreadcrumbFollow(targetId);
      }
      break;
      case 'none': {
        const wasFollowing = this.config['movement-behavior'] === 'follow' || this._followStarted;
        this.config['movement-behavior'] = null;
        this.config['movement-target']   = null;
        if (wasFollowing) {
          this.config.follow          = false;
          this.config['follow-target'] = null;
          this._stopBreadcrumbFollow();
          if (this.gridengine?.hasCharacter(this.config.id)) {
            this.gridengine.stopMovement(this.config.id);
          }
        }
      }
      break;
    }
    this._refreshHasUpdateWork();
  }
}
