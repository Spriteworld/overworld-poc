import Phaser from 'phaser';
import StateMachine from '@Objects/StateMachine';
import MovableSprite from '@Objects/characters/MovableSprite';
import * as Tile from '../Tile.js';
import * as Direction from '../Direction.js';
import { Vector2, getPropertyValue, getInputManager, Action } from '@Utilities';

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
      collides: true,
      'facing-direction': Direction.DOWN,
      'seen-radius': 0,
      'seen-character': null,
      'char-layer': 'ground',
      'can-run': true,
      'ignore-warp': false,
      'track-player': false,
      'track-player-radius': 0,
    }, ...config};
    super(config);
    this.config = config;

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

    this.initSeenRadius(identification);
    this.trackingCoords = [];
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
  }

  /**
   * State callback: called when entering the IDLE state.
   * Resets spinning, sliding, and jumping direction trackers.
   */
  idleOnEnter() {
    this.spinningDir = null;
    this.slidingDir = null;
    this.jumpingDir = null;
  }
  /** State callback: called when leaving the IDLE state. */
  idleOnExit() {}

  /**
   * State callback: polls cursor keys each tick and transitions to MOVE
   * when any directional key is held. Also refreshes the character collision rect.
   */
  idleOnUpdate() {
    const im = getInputManager();
    if (im && (im.isDown(Action.LEFT) || im.isDown(Action.RIGHT) || im.isDown(Action.UP) || im.isDown(Action.DOWN))) {
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
    const duration = 150;
    // Action values ('up','down','left','right') match the lowercased Direction constants.
    dir = dir.toLowerCase();
    if (this.getFacingDirection() === dir) {
      this.move(dir);
    } else {
      const im = getInputManager();
      const held = im ? im.getDuration(dir) : 0;
      held >= duration ? this.move(dir) : this.look(dir);
    }
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
  }
  /** State callback: restore the base texture and frame mapping when leaving the BIKE state. */
  bikeOnExit() {
    this._baseMovementState = this.stateDef.IDLE;
    this.setTexture(this.config.texture);
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
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
    console.log('JUMP START');
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
    console.log('JUMP END');
  }

  /**
   * State callback: initiate a ledge-hop animation using a GridEngine offset tween.
   * Teleports the character two tiles forward in the facing direction via GridEngine,
   * then animates the sprite back to (0, 0) offset with an arc to create the illusion
   * of a jump.
   */
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

    const faceDir = this.getFacingDirection();
    // GridEngine returns directions in lowercase; Direction constants are uppercase.
    const faceDirUpper = faceDir.toUpperCase();
    this.jumpingDir = faceDirUpper;
    const currentTile  = this.getPosition();

    this.gridengine.stopMovement(this.config.id);
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesStaticDef());

    const delta = {
      [Direction.DOWN]:  { dx: 0,  dy: 2  },
      [Direction.UP]:    { dx: 0,  dy: -2 },
      [Direction.LEFT]:  { dx: -2, dy: 0  },
      [Direction.RIGHT]: { dx: 2,  dy: 0  },
    }[faceDirUpper] || { dx: 0, dy: 0 };

    const landingTile = {
      x: currentTile.x + delta.dx,
      y: currentTile.y + delta.dy,
    };

    // GridEngine updates sprite.x/y every frame via updatePixelPos().
    // Tweening this.x/y directly fights that and loses.
    // Instead: anchor GE to landingTile immediately, then tween a visual
    // offset from (startPixels - landingPixels) back to (0, 0) so GE's
    // own update carries the sprite to the correct position each frame.
    const pixelDX  = delta.dx * Tile.WIDTH;
    const pixelDY  = delta.dy * Tile.HEIGHT;
    const arcHeight = Tile.HEIGHT; // 32px upward arc

    this.gridengine.setPosition(
      this.config.id,
      landingTile,
      this.config['char-layer'] || 'ground'
    );

    // Start offset: sprite appears at exitTile visually
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
   * Called each update tick to handle the initial facing direction on first creation
   * and periodic random direction changes when `config.spin` is true.
   * @param {number} delta - Time in ms since the last frame.
   */
  addAutoSpin(delta) {
    if (this.initalCreation) {
      let lookDir = this.config['facing-direction'];
      let faceDir = this.getFacingDirection();

      if (faceDir !== lookDir) {
        this.look(lookDir);
        return;
      }
      this.initalCreation = !this.initalCreation;
    }

    if (this.config.spin !== true && this.config['spin-rate'] && delta) { return; }
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

    let radius = this.config['track-player-radius'];
    this.trackingCoords = [];
    let npcBounds = this.getBounds();
    let pyramidCount = [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29];

    let npcCoords = { 
      x: parseInt(npcBounds.x / Tile.WIDTH), 
      y: parseInt(npcBounds.y / Tile.HEIGHT)
    };

    // top pyramid
    npcCoords.x -= 1;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x -= i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.x += 1;
        
        this.trackingCoords.push({...coord, dir: Direction.UP});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // bottom pyramid
    npcCoords.x += 2;
    npcCoords.y += 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x += i;
      coord.y += i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.x -= 1;
        
        this.trackingCoords.push({...coord, dir: Direction.DOWN});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // right pyramid
    npcCoords.y -= 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x += i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.y += 1;

        this.trackingCoords.push({...coord, dir: Direction.RIGHT});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // left pyramid
    npcCoords.x -= 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x -= i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.y += 1;

        this.trackingCoords.push({...coord, dir: Direction.LEFT});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
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
    let radius = this.config['track-player-radius'];

    let player = this.config.scene.mapPlugins['player'].player;
    let playerPos = player.getPosition();
    
    if (this.trackingCoords.length === 0) {
      // this.scene.mapPlugins['debug'].debugObject(this, radius);
      this.generateTrackingCoords();
    }

    const facingDir = this.getFacingDirection().toUpperCase();
    let coord = Object
      .values(this.trackingCoords)
      .find((coord) => {
        return coord.x === parseInt(playerPos.x)
          && coord.y === parseInt(playerPos.y);
      })
    ;

    if (coord) {
      if (typeof this.config['event-can-track-character'] === 'function') {
        this.config['event-can-track-character'](this.config.id, coord.dir);
      } else {
        this.look(coord.dir.toLowerCase());
      }
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

    const facingLocked = getPropertyValue(this.config.properties, 'facing-direction') != null;
    const directions = facingLocked
      ? [this.getFacingDirection()]
      : [Direction.LEFT, Direction.RIGHT, Direction.UP, Direction.DOWN];

    let isInside = false;
    for (const dir of directions) {
      if (this._sightCheckDir(dir, character)) {
        isInside = true;
        break;
      }
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

}
