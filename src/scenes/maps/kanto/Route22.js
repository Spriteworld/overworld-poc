import {GameMap} from '@Objects';
import {Route22Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Route22',
      map: Route22Map,
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
