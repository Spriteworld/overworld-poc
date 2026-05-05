import { GameMap } from '@Objects';
import KantoViridianCityHouseMap from '../maps/viridian_city_house.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoViridianCityHouse',
      map: KantoViridianCityHouseMap,
      inside: true,
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
