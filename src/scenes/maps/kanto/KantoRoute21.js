import {GameMap} from '@Objects';
import {KantoRoute21Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute21',
      map: KantoRoute21Map,
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
