
import Phaser from 'phaser';

export default class BaseItem extends Phaser.GameObjects.Sprite {
  constructor(config) {
    super(
      config.scene, config.x, config.y, 'gen3_outside', config.tileId
    );
    this.setOrigin(0);

    config.id = this.constructor.name + (Math.random() + 1).toString(36).substring(7);
    this.setName(config.id);
    
    config.scene.add.existing(this);
    config.scene.addCharacter(this);
    config.scene.interactTile(undefined, config, 0xff0000);

    if (config.scene.game.config.debug.objects === true) {
      config.scene.mapPlugins?.debug.debugObject(this, this.constructor.name.toLowerCase());
    }
    this.config = config;
    this.gridengine = config.scene.gridEngine;
  }

  characterDef() {
    let def = this.config;

    return {
      id: def.id,
      sprite: this,
      walkingAnimationMapping: [],
      startPosition: { x: def.x, y: def.y },
      facingDirection: def['facing-direction'] ?? 'down',
      collides: def.collides,
      charLayer: def['char-layer'] ?? 'ground',
      move: def.move,
    };
  }

  remove() {
    this.destroy();
    return this.gridengine.removeCharacter(this.config.id);
  }
}