import { GameMap } from '@Objects';
import { Route5Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route5',
      map: Route5Map,
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
