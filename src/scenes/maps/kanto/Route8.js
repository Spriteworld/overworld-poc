import { GameMap } from '@Objects';
import { Route8Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route8',
      map: Route8Map,
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
