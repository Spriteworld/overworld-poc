import {GameMap, Flock, Direction, Tile} from '@Objects';
import {BasicMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Basic',
      map: BasicMap,
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
