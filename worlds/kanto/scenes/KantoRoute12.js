import { GameMap } from '@Objects';
import KantoRoute12Map from '../maps/route12.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute12',
      map: KantoRoute12Map,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
