import BaseItem from '@Objects/items/BaseItem.js';
import { getPropertyValue } from '@Utilities';

export default class Pokeball extends BaseItem {
  /**
   * An item pickup displayed as a Pokéball sprite on the overworld.
   * Registers the `item` property so the interaction system knows what to add to the bag.
   * Uses tile ID 53 from the gen3_outside tileset.
   * @param {object} config - BaseItem configuration; `scene`, `x`, `y`, and `item` (item name) are required.
   */
  constructor(config) {
    config.tileId = getPropertyValue(config.properties, 'hidden', false) === true ? 365 : 53;
    config.type = 'item';
    config.properties = [];
    config.properties.push(config.scene.addPropertyToTile(
      config, 'item', config.item
    ));

    super(config);
  }
}
