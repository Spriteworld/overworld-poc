import { GameMap } from '@Objects';
import KantoMtMoonBF1BMap from '../maps/mt_moon_bf1_b.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoMtMoonBF1B',
      map: KantoMtMoonBF1BMap,
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
