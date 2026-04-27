import { GameMap } from '@Objects';
import { KantoPewterCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoPewterCity',
      map: KantoPewterCityMap,
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
