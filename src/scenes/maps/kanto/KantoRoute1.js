import {GameMap} from '@Objects';
import {KantoRoute1Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute1',
      map: KantoRoute1Map,
      active: false,
      visible: false,
      inside: true
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
