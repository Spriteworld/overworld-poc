import { GameMap } from '@Objects';
import KantoRoute11Map from '../maps/route11.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute11',
      map: KantoRoute11Map,
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
