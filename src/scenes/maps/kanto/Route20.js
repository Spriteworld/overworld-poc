import { GameMap } from '@Objects';
import { Route20Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route20',
      map: Route20Map,
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
