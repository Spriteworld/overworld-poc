import { GameMap } from '@Objects';
import KantoRoute3Map from '../maps/route3.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute3',
      map: KantoRoute3Map,
      active: false,
      visible: false,
      inside: true
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
