import { GameMap } from '@Objects';
import { ProfLabMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'ProfLab',
      map: ProfLabMap,
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
