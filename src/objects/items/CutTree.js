import BaseItem from '@Objects/items/BaseItem.js';

export default class CutTree extends BaseItem {
  /**
   * An overworld tree that can be cleared with the CUT HM.
   * Displays a contextual prompt based on whether the player has the CUT ability.
   * Uses tile ID 17 from the gen3_outside tileset.
   * @param {object} config - BaseItem configuration; `scene`, `x`, `y` are required.
   */
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