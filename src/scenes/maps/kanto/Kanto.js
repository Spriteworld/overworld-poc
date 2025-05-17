import {GameMap} from '@Objects';
import {KantoMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Kanto',
      map: KantoMap,
      active: false,
      visible: false,
    });
    this.config['char-layer'] = 'ground';
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
