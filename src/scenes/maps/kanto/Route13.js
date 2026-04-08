import { GameMap } from '@Objects';
import { Route13Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route13',
      map: Route13Map,
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
