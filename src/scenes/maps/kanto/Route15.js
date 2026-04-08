import { GameMap } from '@Objects';
import { Route15Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route15',
      map: Route15Map,
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
