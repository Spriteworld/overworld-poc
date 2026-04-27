import { GameMap } from '@Objects';
import { KantoCeruleanCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCeruleanCity',
      map: KantoCeruleanCityMap,
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
