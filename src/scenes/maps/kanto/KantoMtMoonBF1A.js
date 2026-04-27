import { GameMap } from '@Objects';
import { KantoMtMoonBF1AMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoMtMoonBF1A',
      map: KantoMtMoonBF1AMap,
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
