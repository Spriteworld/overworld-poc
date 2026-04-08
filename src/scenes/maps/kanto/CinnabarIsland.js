import { GameMap } from '@Objects';
import { CinnabarIslandMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'CinnabarIsland',
      map: CinnabarIslandMap,
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
