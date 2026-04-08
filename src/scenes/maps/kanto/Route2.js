import { GameMap } from '@Objects';
import { Route2Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route2',
      map: Route2Map,
      active: false,
      visible: false,
      inside: true
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
