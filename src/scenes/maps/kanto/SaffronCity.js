import { GameMap } from '@Objects';
import { SaffronCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'SaffronCity',
      map: SaffronCityMap,
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
