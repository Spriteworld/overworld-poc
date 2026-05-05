import { GameMap } from '@Objects';
import KantoRoute16Map from '../maps/route16.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute16',
      map: KantoRoute16Map,
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
