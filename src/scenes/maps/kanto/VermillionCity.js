import { GameMap } from '@Objects';
import { VermillionCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'VermillionCity',
      map: VermillionCityMap,
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
