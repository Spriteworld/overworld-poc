import { GameMap } from '@Objects';
import { ForestMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Forest',
      map: ForestMap,
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
