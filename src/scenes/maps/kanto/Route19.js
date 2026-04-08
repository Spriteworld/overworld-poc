import { GameMap } from '@Objects';
import { Route19Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route19',
      map: Route19Map,
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
