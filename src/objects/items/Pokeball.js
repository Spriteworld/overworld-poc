import BaseItem from '@Objects/items/BaseItem.js';

export default class Pokeball extends BaseItem {
  constructor(config) {
    config.tileId = 53;
    config.type = 'item';
    config.properties = [];
    if (config.scene.game.config.gameFlags.has_cut !== true) {
      config.properties.push(config.scene.addPropertyToTile(
        config, 'item', config.item
      ));
    }
    super(config);
  }
}