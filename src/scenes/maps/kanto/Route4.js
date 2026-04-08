import { GameMap } from '@Objects';
import { Route4Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route4',
      map: Route4Map,
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
