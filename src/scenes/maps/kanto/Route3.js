import { GameMap } from '@Objects';
import { Route3Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route3',
      map: Route3Map,
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
