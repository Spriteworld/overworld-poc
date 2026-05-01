import { Tile } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;
    this._defs = new Map();
    this._active = new Map();
  }

  init() {
    const tilemap = this.scene.config.tilemap;
    const objLayer = tilemap.getObjectLayer('placeables');
    if (!objLayer) return;

    for (const obj of objLayer.objects) {
      if (obj.type !== 'placeable' || !obj.name) continue;

      const tileX = Math.floor(obj.x / Tile.WIDTH);
      const tileY = Math.floor(obj.y / Tile.HEIGHT);
      const w = Math.max(1, Math.floor((obj.width ?? Tile.WIDTH) / Tile.WIDTH));
      const h = Math.max(1, Math.floor((obj.height ?? Tile.HEIGHT) / Tile.HEIGHT));

      const layer = this.scene.getPropertyFromTile(obj, 'layer') ?? 'ground';

      const tiles = [];
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const tx = tileX + dx;
          const ty = tileY + dy;
          const tile = tilemap.getTileAt(tx, ty, true, layer);
          if (tile && tile.index !== -1) {
            tiles.push({
              dx, dy,
              index: tile.index,
              properties: { ...tile.properties },
            });
            tilemap.removeTileAt(tx, ty, true, true, layer);
          }
        }
      }

      this._defs.set(obj.name, { tileX, tileY, w, h, tiles, layer });
    }

    this.scene._tilePropsCache?.clear();
  }

  event() {}

  show(name, overrideX, overrideY) {
    const def = this._defs.get(name);
    if (!def || this._active.has(name)) return;

    const tilemap = this.scene.config.tilemap;
    const baseX = overrideX ?? def.tileX;
    const baseY = overrideY ?? def.tileY;

    for (const { dx, dy, index, properties } of def.tiles) {
      const placed = tilemap.putTileAt(index, baseX + dx, baseY + dy, true, def.layer);
      if (placed) placed.properties = { ...properties };
    }

    this.scene._tilePropsCache?.clear();
    this._active.set(name, { x: baseX, y: baseY });
  }

  hide(name) {
    const def = this._defs.get(name);
    const pos = this._active.get(name);
    if (!def || !pos) return;

    const tilemap = this.scene.config.tilemap;
    for (const { dx, dy } of def.tiles) {
      tilemap.removeTileAt(pos.x + dx, pos.y + dy, true, true, def.layer);
    }

    this.scene._tilePropsCache?.clear();
    this._active.delete(name);
  }

  moveTo(name, x, y) {
    this.hide(name);
    this.show(name, x, y);
  }

  destroy() {
    this._active.clear();
    this._defs.clear();
  }
}
