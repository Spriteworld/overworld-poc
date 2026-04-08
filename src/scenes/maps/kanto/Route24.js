import { GameMap } from '@Objects';
import { Route24Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route24',
      map: Route24Map,
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
