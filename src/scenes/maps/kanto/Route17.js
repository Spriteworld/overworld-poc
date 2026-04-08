import { GameMap } from '@Objects';
import { Route17Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route17',
      map: Route17Map,
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
