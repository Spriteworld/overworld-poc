import { GameMap } from '@Objects';
import { KantoRoute2Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute2',
      map: KantoRoute2Map,
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
