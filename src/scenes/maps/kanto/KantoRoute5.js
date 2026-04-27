import { GameMap } from '@Objects';
import { KantoRoute5Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute5',
      map: KantoRoute5Map,
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
