import MovableSprite from '@Objects/characters/MovableSprite';
import { Tile } from '@Objects';

const _gidMapGlob = import.meta.glob('@Maps/*/gen3_to_*_common.json', { eager: true, import: 'default' });
const GID_MAPS = Object.fromEntries(
  Object.entries(_gidMapGlob).map(([path, data]) => [
    path.split('/').pop().replace('gen3_to_', '').replace('.json', ''),
    data,
  ])
);

function findCommonTileset(scene) {
  const tilesets = scene.config.map?.tilesets ?? [];
  for (const ts of tilesets) {
    const name = ts.source?.split('/').pop()?.replace('.json', '');
    if (name && name.endsWith('_common') && GID_MAPS[name]) return name;
  }
  return 'kanto_common';
}

export default class BaseItem extends MovableSprite {
  constructor(config) {
    const commonName = findCommonTileset(config.scene);
    const gidMap = GID_MAPS[commonName];
    const gen3Gid  = config.tileId + 1;
    const commonGid = gidMap[gen3Gid];
    config.texture = commonName;
    config.frame   = commonGid != null ? commonGid - 1 : config.tileId;
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