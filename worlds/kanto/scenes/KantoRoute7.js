import { GameMap } from '@Objects';
import KantoRoute7Map from '../maps/route7.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute7',
      map: KantoRoute7Map,
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
