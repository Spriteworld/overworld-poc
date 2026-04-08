import { GameMap } from '@Objects';
import { Route25Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route25',
      map: Route25Map,
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
