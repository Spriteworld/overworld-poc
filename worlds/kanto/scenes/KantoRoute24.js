import { GameMap } from '@Objects';
import KantoRoute24Map from '../maps/route24.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute24',
      map: KantoRoute24Map,
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
