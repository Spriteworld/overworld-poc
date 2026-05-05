import { GameMap } from '@Objects';
import KantoRoute23Map from '../maps/route23.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute23',
      map: KantoRoute23Map,
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
