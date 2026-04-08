import { GameMap } from '@Objects';
import { CeladonCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'CeladonCity',
      map: CeladonCityMap,
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
