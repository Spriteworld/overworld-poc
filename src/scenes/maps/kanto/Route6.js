import { GameMap } from '@Objects';
import { Route6Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route6',
      map: Route6Map,
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
