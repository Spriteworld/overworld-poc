import { GameMap } from '@Objects';
import KantoRoute6Map from '../maps/route6.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute6',
      map: KantoRoute6Map,
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
