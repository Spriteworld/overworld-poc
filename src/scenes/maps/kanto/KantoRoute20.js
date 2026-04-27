import { GameMap } from '@Objects';
import { KantoRoute20Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute20',
      map: KantoRoute20Map,
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
