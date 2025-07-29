import MovableSprite from '@Objects/characters/MovableSprite';
import { Tile } from '@Objects';

export default class BaseItem extends MovableSprite {
  constructor(config) {
    config.texture = 'gen3_outside';
    config.frame = config.tileId;
    super(config);
    
    this.setOrigin(0);
    this.x = config.x * Tile.WIDTH;
    this.y = config.y * Tile.HEIGHT;

    config.id = this.constructor.name + (Math.random() + 1).toString(36).substring(7);
    this.setName(config.id);
    
    config.scene.add.existing(this);
    config.scene.addCharacter(this);
    config.scene.interactTile(undefined, config, 0xff0000);

    if (config.scene.game.config.debug.objects === true) {
      config.scene.mapPlugins?.debug.debugObject(this, this.constructor.name.toLowerCase());
    }
  }

}