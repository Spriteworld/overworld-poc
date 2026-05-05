import { GameMap } from '@Objects';
import KantoVermillionCityMap from '../maps/vermillion_city.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoVermillionCity',
      map: KantoVermillionCityMap,
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
