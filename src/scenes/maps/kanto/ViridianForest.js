import { GameMap } from '@Objects';
import { ViridianForestMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'ViridianForest',
      map: ViridianForestMap,
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
