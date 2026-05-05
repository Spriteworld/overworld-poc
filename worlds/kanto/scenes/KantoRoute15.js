import { GameMap } from '@Objects';
import KantoRoute15Map from '../maps/route15.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute15',
      map: KantoRoute15Map,
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
