import {GameMap} from '@Objects';
import {ViridianCityMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'ViridianCity',
      map: ViridianCityMap,
      active: false,
      visible: false,
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
