import MovableSprite from '@Objects/characters/MovableSprite';
import { Tile } from '@Objects';
import gen3ToKantoCommon from '@Maps/kanto/gen3_to_kanto_common.json';

export default class BaseItem extends MovableSprite {
  /**
   * Base class for all overworld item/obstacle sprites.
   * Renders the sprite at the correct pixel position, registers it as both a
   * scene character and an interactable tile, and optionally draws a debug label.
   * Subclasses must set `config.tileId`, `config.type`, and `config.properties`
   * before calling `super(config)`.
   * @param {object} config - Configuration object.
   * @param {Phaser.Scene} config.scene - The owning GameMap scene.
   * @param {number} config.x - Tile x position.
   * @param {number} config.y - Tile y position.
   * @param {number} config.tileId - Frame index in the gen3_outside tileset.
   * @param {string} config.type - Interactable type string (e.g. `'cut-tree'`).
   */
  constructor(config) {
    // tileId is a gen3_outside frame (0-based). ITEM_TILE_IDS are always in
    // kanto_common, so both outdoor and indoor scenes use the same texture/frame.
    const gen3Gid  = config.tileId + 1;
    const kantoGid = gen3ToKantoCommon[gen3Gid];
    config.texture = 'kanto_common';
    config.frame   = kantoGid != null ? kantoGid - 1 : config.tileId;
    super(config);
    
    this.setOrigin(0);
    this.x = config.x * Tile.WIDTH;
    this.y = config.y * Tile.HEIGHT;
    this.setDepth(1);

    config.id = this.constructor.name + (Math.random() + 1).toString(36).substring(7);
    this.setName(config.id);
    
    config.scene.add.existing(this);
    config.scene.addCharacter(this);
    config.scene.interactTile(undefined, config, 0xff0000);

    if (config.scene.game.config.debug.objects === true) {
      config.scene.mapPlugins?.debug.debugObject(this, this.constructor.name.toLowerCase());
    }
  }

}