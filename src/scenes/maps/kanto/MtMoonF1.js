import { GameMap } from '@Objects';
import { MtMoonF1Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'MtMoonF1',
      map: MtMoonF1Map,
      inside: true,
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
