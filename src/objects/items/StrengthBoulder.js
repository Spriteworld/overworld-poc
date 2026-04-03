import BaseItem from '@Objects/items/BaseItem.js';

export default class StrengthBoulder extends BaseItem {
  /**
   * An overworld boulder that can be pushed with the STRENGTH HM.
   * Displays a contextual prompt based on whether the player has the STRENGTH ability.
   * Uses tile ID 35 from the gen3_outside tileset.
   * @param {object} config - BaseItem configuration; `scene`, `x`, `y` are required.
   */
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