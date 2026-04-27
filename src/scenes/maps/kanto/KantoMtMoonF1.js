import { GameMap } from '@Objects';
import { KantoMtMoonF1Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoMtMoonF1',
      map: KantoMtMoonF1Map,
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
