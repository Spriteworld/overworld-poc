import BaseItem from '@Objects/items/BaseItem.js';

export default class CutTree extends BaseItem {
  constructor(config) {
    config.tileId = 17;
    config.type = 'cut-tree';
    config.properties = [];
    if (config.scene.game.config.gameFlags.has_cut !== true) {
      config.properties.push(config.scene.addPropertyToTile(
        config, 'text', 'This tree can be CUT.'
      ));
    }
    super(config);
  }
}