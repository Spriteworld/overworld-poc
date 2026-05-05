import { GameMap } from '@Objects';
import KantoRoute25Map from '../maps/route25.json';

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
