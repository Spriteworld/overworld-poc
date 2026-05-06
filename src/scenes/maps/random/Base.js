import { GameMap } from '@Objects';
import { BaseMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Base',
      map: BaseMap,
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
