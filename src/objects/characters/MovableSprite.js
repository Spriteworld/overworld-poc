import Phaser from 'phaser';
import * as Direction from '../Direction.js';
import { Vector2 } from '@Utilities';

export default class MovableSprite extends Phaser.GameObjects.Sprite {
  /**
   * @param {object} config - Sprite configuration.
   * @param {Phaser.Scene} config.scene - The owning scene.
   * @param {number} config.x - Starting tile x position.
   * @param {number} config.y - Starting tile y position.
   * @param {string} config.texture - Texture key.
   * @param {number} [config.frame] - Initial frame index.
   */
  constructor(config) {
    super(config.scene, config.x, config.y, config.texture, config.frame);
    this.config = config;

    this.gridengine = config.scene.gridEngine;
    this.stateMachine = false;
  }

  /**
   * Returns the walking animation frame mapping for this sprite type.
   * Subclasses should override this to provide directional frame sets.
   * @returns {object} Frame mapping keyed by direction.
   */
  characterFramesDef() {
    return [];
  }

  /**
   * Build the GridEngine character definition object for this sprite.
   * @returns {object} Configuration object accepted by `GridEngine.create()`.
   */
  characterDef() {
    let def = this.config;

    return {
      id: def.id,
      sprite: this,
      walkingAnimationMapping: this.characterFramesDef(),
      startPosition: Vector2(def.x, def.y),
      facingDirection: (def['facing-direction'] ?? Direction.DOWN).toLowerCase(),
      collides: def.collides,
      charLayer: def['char-layer'] ?? 'ground',
      move: def.move,
    };
  }

  /**
   * Returns true when this sprite has no state machine (e.g. an item or
   * background character that does not participate in AI logic).
   * @returns {boolean}
   */
  isDumbCharacter() {
    return this.stateMachine === false;
  }

  /**
   * Turn the sprite to face the given cardinal direction without moving.
   * @param {string} dir - Direction constant (UP | DOWN | LEFT | RIGHT).
   * @returns {boolean|void} False if the direction is invalid.
   */
  look(dir) {
    dir = dir?.toUpperCase();
    if ([Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].indexOf(dir) === -1) {
      console.warn('Invalid direction:', dir);
      return false;
    }

    return this.gridengine.turnTowards(this.config.id, dir.toLowerCase());
  }

  /**
   * Turn this sprite to face another character identified by its GridEngine ID.
   * @param {string} charId - The GridEngine character ID to face toward.
   * @returns {void}
   */
  lookAt(charId) {
    return this.gridengine.turnTowards(this.config.id, this.gridengine.getFacingPosition(charId));
  }

  /**
   * Move the sprite one tile in the given cardinal direction.
   * @param {string} dir - Direction constant (UP | DOWN | LEFT | RIGHT).
   * @returns {boolean|void} False if the direction is invalid.
   */
  move(dir) {
    dir = dir?.toUpperCase();
    if ([Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].indexOf(dir) === -1) {
      console.warn('Invalid direction:', dir);
      return false;
    }
    
    return this.gridengine.move(this.config.id, dir.toLowerCase());
  }

  /**
   * Use GridEngine pathfinding to move the sprite toward the given tile coordinates.
   * @param {{x:number,y:number}} coords - Target tile position.
   * @param {object} [config] - Optional GridEngine moveTo configuration.
   * @returns {void}
   */
  moveTo(coords, config) {
    return this.gridengine.moveTo(this.config.id, coords, config);
  }

  /**
   * Returns true if this sprite is currently moving in GridEngine.
   * @returns {boolean}
   */
  isMoving() {
    return this.gridengine.isMoving(this.config.id);
  }

  /**
   * Halt any ongoing GridEngine movement for this sprite.
   * @returns {void}
   */
  stopMovement() {
    return this.gridengine.stopMovement(this.config.id);
  }

  /**
   * Returns the direction this sprite is currently facing.
   * @returns {string} Lowercase direction string from GridEngine.
   */
  getFacingDirection() {
    return this.gridengine.getFacingDirection(this.config.id);
  }

  /**
   * Returns the tile position directly in front of this sprite.
   * @returns {{x:number,y:number}}
   */
  getFacingPosition() {
    return this.gridengine.getFacingPosition(this.config.id);
  }

  /**
   * Returns true if the tile above is not blocked.
   * @returns {boolean}
   */
  canMoveUp() {
    return this.canMove(Direction.UP);
  }

  /**
   * Returns true if the tile below is not blocked.
   * @returns {boolean}
   */
  canMoveDown() {
    return this.canMove(Direction.DOWN);
  }

  /**
   * Returns true if the tile to the left is not blocked.
   * @returns {boolean}
   */
  canMoveLeft() {
    return this.canMove(Direction.LEFT);
  }

  /**
   * Returns true if the tile to the right is not blocked.
   * @returns {boolean}
   */
  canMoveRight() {
    return this.canMove(Direction.RIGHT);
  }

  /**
   * Returns true if the tile one step in `dir` is not blocked on this sprite's layer.
   * @param {string} dir - Direction constant (UP | DOWN | LEFT | RIGHT).
   * @returns {boolean}
   */
  canMove(dir) {
    // return true;
    let pos = this.getPosInDirection(dir);
    let layer = this.config['char-layer'] || 'ground';
    return this.gridengine.isBlocked(pos, layer) === false;
  }

  /**
   * Returns the cardinal direction opposite to the direction this sprite is facing.
   * @returns {string} Direction constant.
   */
  getOppositeFacingDirection() {
    let dir = this.getFacingDirection()?.toUpperCase();
    if (dir === Direction.UP) {
      return Direction.DOWN;
    } else if (dir === Direction.DOWN) {
      return Direction.UP;
    } else if (dir === Direction.LEFT) {
      return Direction.RIGHT;
    } else if (dir === Direction.RIGHT) {
      return Direction.LEFT;
    }
  }

  /**
   * Returns the tile properties Map for the tile directly in front of this sprite.
   * @returns {Map<string,*>}
   */
  getFacingTile() {
    let faceDir = this.getPosInFacingDirection();
    return this.scene.getTileProperties(faceDir.x, faceDir.y);
  }

  /**
   * Returns the current tile position of this sprite.
   * @returns {{x:number,y:number}}
   */
  getPosition() {
    return this.gridengine.getPosition(this.config.id);
  }

  /**
   * Returns the tile position one step ahead of this sprite's facing direction.
   * @returns {{x:number,y:number}}
   */
  getPosInFacingDirection() {
    return this.gridengine.getFacingPosition(this.config.id);
  }

  /**
   * Returns the tile position one step in the given direction from the sprite's
   * current position.
   * @param {string} dir - Direction constant (UP | DOWN | LEFT | RIGHT).
   * @returns {{x:number,y:number}}
   */
  getPosInDirection(dir) {
    dir = dir?.toUpperCase();
    let pos = this.getPosition();
    if (dir === Direction.UP) {
      return Vector2(pos.x, pos.y - 1);
    } else if (dir === Direction.DOWN) {
      return Vector2(pos.x, pos.y + 1);
    } else if (dir === Direction.LEFT) {
      return Vector2(pos.x - 1, pos.y);
    } else if (dir === Direction.RIGHT) {
      return Vector2(pos.x + 1, pos.y);
    }
  }

  /**
   * Returns the tile position one step behind this sprite (opposite to the facing direction).
   * @returns {{x:number,y:number}}
   */
  getPosInBehindDirection() {
    let pos = this.getPosition();
    let dir = this.getFacingDirection();
    if (dir === Direction.UP) {
      return Vector2(pos.x, pos.y + 1);
    } else if (dir === Direction.DOWN) {
      return Vector2(pos.x, pos.y - 1);
    } else if (dir === Direction.LEFT) {
      return Vector2(pos.x + 1, pos.y);
    } else if (dir === Direction.RIGHT) {
      return Vector2(pos.x - 1, pos.y);
    }
  }

  /**
   * Returns true if this sprite's current tile position falls within the
   * rectangular area defined by the two corner tiles (inclusive).
   * @param {{x:number,y:number}} topLeft - Top-left corner of the area.
   * @param {{x:number,y:number}} bottomRight - Bottom-right corner of the area.
   * @returns {boolean}
   */
  isInArea(topLeft, bottomRight) {
    let charXY = this.getPosition();
    let coords = [];
    
    // generate a list of coords from top left to bottom right
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        coords.push(Vector2(x, y));
      }
    }
    return coords.some(c => c.x === charXY.x && c.y === charXY.y);
  }
    
  /**
   * Destroy this sprite, remove it from the scene's character map, and
   * deregister it from GridEngine.
   * @returns {void}
   */
  remove() {
    // remove sprite
    this.destroy();

    // remove character from scene
    if (this.config.scene && this.config.scene.characters) {
      this.config.scene.characters.delete(this.config.id);
    }

    // remove character from gridengine
    return this.gridengine.removeCharacter(this.config.id);
  }
};