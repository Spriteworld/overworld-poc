import { GameMap } from '@Objects';
import { FuchsiaCityMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'FuchsiaCity',
      map: FuchsiaCityMap,
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
