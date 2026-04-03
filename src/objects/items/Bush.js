import BaseItem from '@Objects/items/BaseItem.js';

export default class Bush extends BaseItem {
  /**
   * An overworld bush obstacle that can be interacted with.
   * Uses tile ID 18 from the gen3_outside tileset.
   * @param {object} config - BaseItem configuration; `scene`, `x`, `y` are required.
   */
  constructor(config) {
    config.tileId = 18;
    config.type = 'bush';
    config.properties = [];

    super(config);
  }
}
