import { GameMap } from '@Objects';
import { KantoRoute25Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute25',
      map: KantoRoute25Map,
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
