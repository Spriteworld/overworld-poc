import { GameMap } from '@Objects';
import { GavworldStarterTownMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldStarterTown',
      map: GavworldStarterTownMap,
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
