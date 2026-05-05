import { GameMap } from '@Objects';
import KantoRoute9Map from '../maps/route9.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute9',
      map: KantoRoute9Map,
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
