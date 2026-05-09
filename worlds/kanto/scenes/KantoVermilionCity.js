import { GameMap } from '@Objects';
import KantoVermilionCityMap from '../maps/vermilion_city.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoVermilionCity',
      map: KantoVermilionCityMap,
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
