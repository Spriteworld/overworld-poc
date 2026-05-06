import { GameMap } from '@Objects';
import KantoRoute17Map from '../maps/route17.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRoute17',
      map: KantoRoute17Map,
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
