import { GameMap } from '@Objects';
import KantoFuchsiaCityMap from '../maps/fuchsia_city.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoFuchsiaCity',
      map: KantoFuchsiaCityMap,
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
