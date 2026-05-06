import {GameMap} from '@Objects';
import KantoViridianCityMap from '../maps/viridian_city.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoViridianCity',
      map: KantoViridianCityMap,
    });
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
