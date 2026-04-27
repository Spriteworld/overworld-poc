import { GameMap } from '@Objects';
import { GavworldRoute1Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldRoute1',
      map: GavworldRoute1Map,
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
