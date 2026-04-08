import { GameMap } from '@Objects';
import { Route7Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route7',
      map: Route7Map,
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
