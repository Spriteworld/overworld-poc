import { GameMap } from '@Objects';
import { Route16Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route16',
      map: Route16Map,
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
