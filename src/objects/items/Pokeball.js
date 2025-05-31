import BaseItem from '@Objects/items/BaseItem.js';

export default class Pokeball extends BaseItem {
  constructor(config) {
    config.tileId = 53;
    config.type = 'item';
    config.properties = [];
    config.properties.push(config.scene.addPropertyToTile(
      config, 'item', config.item
    ));

    super(config);
  }
}