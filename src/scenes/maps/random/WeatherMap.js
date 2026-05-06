import { GameMap } from '@Objects';
import { WeatherMapMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'WeatherMap',
      map: WeatherMapMap,
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
