import { GameMap } from '@Objects';
import KantoRoute10Map from '../maps/route10.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute10',
      map: KantoRoute10Map,
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
