import { GameMap } from '@Objects';
import KantoRoute4Map from '../maps/route4.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute4',
      map: KantoRoute4Map,
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
