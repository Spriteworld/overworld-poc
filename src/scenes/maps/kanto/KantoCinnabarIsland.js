import { GameMap } from '@Objects';
import { KantoCinnabarIslandMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCinnabarIsland',
      map: KantoCinnabarIslandMap,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
