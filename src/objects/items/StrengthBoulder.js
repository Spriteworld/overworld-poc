import BaseItem from '@Objects/items/BaseItem.js';

export default class StrengthBoulder extends BaseItem {
  constructor(config) {
    config.tileId = 35;
    config.type = 'strength-boulder';
    config.properties = [];

    let text = config.scene.game.config.gameFlags.has_strength === false
      ? 'You need the STRENGTH ability to push this boulder.'
      : 'This boulder can be pushed.';

    config.properties.push(config.scene.addPropertyToTile(
      config, 'text', text
    ));
    super(config);
  }
}