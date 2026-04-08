import { GameMap } from '@Objects';
import { Route14Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route14',
      map: Route14Map,
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
