import { GameMap } from '@Objects';
import { PewterCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'PewterCity',
      map: PewterCityMap,
      active: false,
      visible: false,
      inside: true
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
