import Phaser from 'phaser';
import { Direction } from '@Objects';
import { Vector2 } from '@Utilities';

export default class MovableSprite extends Phaser.GameObjects.Sprite {
  constructor(config) {
    super(config.scene, config.x, config.y, config.texture, config.frame);
    this.config = config;

    this.gridengine = config.scene.gridEngine;
    this.stateMachine = false;
  }
  
  characterFramesDef() {
    return [];
  }

  characterDef() {
    let def = this.config;

    return {
      id: def.id,
      sprite: this,
      walkingAnimationMapping: this.characterFramesDef(),
      startPosition: { x: def.x, y: def.y },
      facingDirection: (def['facing-direction'] ?? Direction.DOWN).toLowerCase(),
      collides: def.collides,
      charLayer: def['char-layer'] ?? 'ground',
      move: def.move,
    };
  }

  isDumbCharacter() {
    return this.stateMachine === false;
  }

  look(dir) {
    dir = dir?.toUpperCase();
    if ([Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].indexOf(dir) === -1) {
      console.warn('Invalid direction:', dir);
      return false;
    }

    return this.gridengine.turnTowards(this.config.id, dir.toLowerCase());
  }

  lookAt(charId) {
    return this.gridengine.turnTowards(this.config.id, this.gridengine.getFacingPosition(charId));
  }

  move(dir) {
    dir = dir?.toUpperCase();
    if ([Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT].indexOf(dir) === -1) {
      console.warn('Invalid direction:', dir);
      return false;
    }
    
    return this.gridengine.move(this.config.id, dir.toLowerCase());
  }

  moveTo(x, y, config) {
    return this.gridengine.moveTo(this.config.id, Vector2(x, y), config);
  }

  isMoving() {
    return this.gridengine.isMoving(this.config.id);
  }

  stopMovement() {
    return this.gridengine.stopMovement(this.config.id);
  }

  remove() {
    this.destroy();
    return this.gridEngine.removeCharacter(this.config.id);
  }

  getPosition() {
    return this.gridengine.getPosition(this.config.id);
  }

  getFacingDirection() {
    return this.gridengine.getFacingDirection(this.config.id);
  }

  getFacingPosition() {
    return this.gridengine.getFacingPosition(this.config.id);
  }

  canMoveUp() {
    return this.canMove(Direction.UP);
  }

  canMoveDown() {
    return this.canMove(Direction.DOWN);
  }

  canMoveLeft() {
    return this.canMove(Direction.LEFT);
  }

  canMoveRight() {
    return this.canMove(Direction.RIGHT);
  }

  canMove(dir) {
    // return true;
    let pos = this.getPosInDirection(dir);
    let layer = this.config['char-layer'] || 'ground';
    return this.gridengine.isBlocked(pos, layer) === false;
  }

  getOppositeFacingDirection() {
    let dir = this.getFacingDirection();
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

  getFacingTile() {
    let faceDir = this.getPosInFacingDirection();
    return this.scene.getTileProperties(faceDir.x, faceDir.y);
  }

  getPosition() {
    return this.gridengine.getPosition(this.config.id);
  }

  getPosInFacingDirection() {
    return this.gridengine.getFacingPosition(this.config.id);
  }

  getPosInDirection(dir) {
    dir = dir?.toUpperCase();
    let pos = this.getPosition();
    if (dir === Direction.UP) {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === Direction.DOWN) {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === Direction.LEFT) {
      return { ...pos, x: pos.x - 1 };
    } else if (dir === Direction.RIGHT) {
      return { ...pos, x: pos.x + 1 };
    }
  }

  getPosInBehindDirection() {
    let pos = this.getPosition();
    let dir = this.getFacingDirection();
    if (dir === Direction.UP) {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === Direction.DOWN) {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === Direction.LEFT) {
      return { ...pos, x: pos.x + 1 };
    } else if (dir === Direction.RIGHT) {
      return { ...pos, x: pos.x - 1 };
    }
  }

  isInArea(topLeft, bottomRight) {
    let charXY = this.getPosition();
    let coords = [];
    
    // generate a list of coords from top left to bottom right
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        coords.push(Vector2(x, y));
      }
    }
    return coords.includes(charXY);
  }
    
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