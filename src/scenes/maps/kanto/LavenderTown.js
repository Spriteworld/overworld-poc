import { GameMap } from '@Objects';
import { LavenderTownMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'LavenderTown',
      map: LavenderTownMap,
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
