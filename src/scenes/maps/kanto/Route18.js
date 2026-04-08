import { GameMap } from '@Objects';
import { Route18Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route18',
      map: Route18Map,
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
