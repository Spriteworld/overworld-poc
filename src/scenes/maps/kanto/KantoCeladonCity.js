import { GameMap } from '@Objects';
import { KantoCeladonCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCeladonCity',
      map: KantoCeladonCityMap,
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
