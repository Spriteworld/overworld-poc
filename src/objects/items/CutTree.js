import BaseItem from '@Objects/items/BaseItem.js';

export default class CutTree extends BaseItem {
  constructor(config) {
    config.tileId = 17;
    config.type = 'cut-tree';
    config.properties = [];

    let text = config.scene.game.config.gameFlags.has_cut === false
      ? 'You need the CUT ability to cut this tree.'
      : 'This tree can be CUT.';

    config.properties.push(config.scene.addPropertyToTile(
      config, 'text', text
    ));
    super(config);
  }
}