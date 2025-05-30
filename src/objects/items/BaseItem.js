import MovableSprite from '@Objects/characters/MovableSprite';

export default class BaseItem extends MovableSprite {
  constructor(config) {
    config.texture = 'gen3_outside';
    config.frame = config.tileId;
    super(config);
    this.setOrigin(0);

    config.id = this.constructor.name + (Math.random() + 1).toString(36).substring(7);
    this.setName(config.id);
    
    config.scene.add.existing(this);
    config.scene.addCharacter(this);
    config.scene.interactTile(undefined, config, 0xff0000);

    if (config.scene.game.config.debug.objects === true) {
      config.scene.mapPlugins?.debug.debugObject(this, this.constructor.name.toLowerCase());
    }
  }

  remove() {
    this.destroy();
    return this.gridengine.removeCharacter(this.config.id);
  }
}