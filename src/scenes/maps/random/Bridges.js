import {GameMap} from '@Objects';
import {BridgesMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Bridges',
      map: BridgesMap,
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
