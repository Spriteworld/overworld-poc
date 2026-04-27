import { GameMap } from '@Objects';
import { GavworldViridianForestMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldViridianForest',
      map: GavworldViridianForestMap,
      inside: true,
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
