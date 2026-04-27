import { GameMap } from '@Objects';
import { KantoSaffronCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoSaffronCity',
      map: KantoSaffronCityMap,
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
