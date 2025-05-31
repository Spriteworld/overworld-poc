import Phaser from 'phaser';
import { Direction } from '@Objects';

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
      facingDirection: def['facing-direction'] ?? 'down',
      collides: def.collides,
      charLayer: def['char-layer'] ?? 'ground',
      move: def.move,
    };
  }

  isDumbCharacter() {
    return this.stateMachine === false;
  }

  look(dir) {
    return this.gridengine.turnTowards(this.config.id, dir.toLowerCase());
  }

  lookAt(charId) {
    return this.gridengine.turnTowards(this.config.id, this.gridengine.getFacingPosition(charId));
  }

  move(dir) {
    return this.gridengine.move(this.config.id, dir.toLowerCase());
  }

  moveTo(x, y, config) {
    return this.gridengine.moveTo(this.config.id, { x: x, y: y }, config);
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

  canMoveUp(layer) {
    return this.canMove(Direction.UP, layer);
  }

  canMoveDown(layer) {
    return this.canMove(Direction.DOWN, layer);
  }

  canMoveLeft(layer) {
    return this.canMove(Direction.LEFT, layer);
  }

  canMoveRight(layer) {
    return this.canMove(Direction.RIGHT, layer);
  }

  canMove(dir, layer) {
    return true;
    let pos = this.getPosInDirection(dir);
    return this.gridengine.isBlocked(pos, layer) === false;
  }

  getOppositeFacingDirection() {
    let dir = this.getFacingDirection();
    if (dir === 'up') {
      return 'down';
    } else if (dir === 'down') {
      return 'up';
    } else if (dir === 'left') {
      return 'right';
    } else if (dir === 'right') {
      return 'left';
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
    let pos = this.getPosition();
    if (dir === 'up') {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === 'down') {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === 'left') {
      return { ...pos, x: pos.x - 1 };
    } else if (dir === 'right') {
      return { ...pos, x: pos.x + 1 };
    }
  }

  getPosInBehindDirection() {
    let pos = this.getPosition();
    let dir = this.getFacingDirection();
    if (dir === 'up') {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === 'down') {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === 'left') {
      return { ...pos, x: pos.x + 1 };
    } else if (dir === 'right') {
      return { ...pos, x: pos.x - 1 };
    }
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