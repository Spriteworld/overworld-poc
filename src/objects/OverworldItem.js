import Phaser from 'phaser';
import { Tile } from '@Objects';

export default class OverworldItem extends Phaser.GameObjects.Sprite {
  constructor(config) {
    super(config.scene, config.x, config.y, config.texture);
    
    this.config.scene.add.existing(this);
    this.config.scene.addCharacter(this);

  }

  putPokeball(scene, x, y) {
    let config = {
      scene: scene,
      name: 'pokeball',
      key: 'gen3_outside',
      x: x * Tile.WIDTH,
      y: y * Tile.HEIGHT,
    };

    return new OverworldItem(config);
  }
}