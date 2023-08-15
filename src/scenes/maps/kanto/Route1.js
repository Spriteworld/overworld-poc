import {GameMap} from '@Objects';
import {Route1Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route1',
      map: Route1Map,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
