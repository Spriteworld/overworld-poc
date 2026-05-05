import { GameMap } from '@Objects';
import KantoRoute8Map from '../maps/route8.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute8',
      map: KantoRoute8Map,
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
