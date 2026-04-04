import {GameMap} from '@Objects';
import {Route21Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route21',
      map: Route21Map,
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
