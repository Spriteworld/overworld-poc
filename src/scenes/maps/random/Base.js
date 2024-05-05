import {GameMap, Flock, Direction, Tile} from '@Objects';
import {BaseMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Base',
      map: BaseMap,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
  }

  update(time, delta) {
    // this.updateCharacters(time, delta);
    // this.flock.update(time, delta);
    // this.npc1.update(time);

  }

}
