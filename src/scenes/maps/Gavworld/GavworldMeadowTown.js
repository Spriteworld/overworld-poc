import { GameMap } from '@Objects';
import { GavworldMeadowTownMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldMeadowTown',
      map: GavworldMeadowTownMap,
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
