import { GameMap } from '@Objects';
import { Route11Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route11',
      map: Route11Map,
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
