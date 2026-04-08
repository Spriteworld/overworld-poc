import { GameMap } from '@Objects';
import { Route9Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route9',
      map: Route9Map,
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
