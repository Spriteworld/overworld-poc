import { GameMap } from '@Objects';
import KantoMtMoonBF1CMap from '../maps/mt_moon_bf1_c.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoMtMoonBF1C',
      map: KantoMtMoonBF1CMap,
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
