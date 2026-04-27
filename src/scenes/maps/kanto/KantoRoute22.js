import {GameMap} from '@Objects';
import {KantoRoute22Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute22',
      map: KantoRoute22Map,
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
