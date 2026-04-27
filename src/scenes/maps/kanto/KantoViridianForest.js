import { GameMap } from '@Objects';
import { KantoViridianForestMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoViridianForest',
      map: KantoViridianForestMap,
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
