import { GameMap } from '@Objects';
import KantoRoute19Map from '../maps/route19.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute19',
      map: KantoRoute19Map,
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
