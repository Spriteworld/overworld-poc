import {GameMap, Flock, Direction, Tile} from '@Objects';
import {SkylandMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Skyland',
      map: SkylandMap,
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
