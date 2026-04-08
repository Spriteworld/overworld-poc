import { GameMap } from '@Objects';
import { Route23Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route23',
      map: Route23Map,
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
