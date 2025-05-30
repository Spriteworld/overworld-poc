import BaseItem from '@Objects/items/BaseItem.js';

export default class StrengthBoulder extends BaseItem {
  constructor(config) {
    config.tileId = 35;
    config.type = 'strength-boulder';
    config.properties = [];
    config.properties.push(config.scene.addPropertyToTile(
      config, 'text', 'This boulder can be pushed.'
    ));
    super(config);
  }
}