import { GameMap } from '@Objects';
import KantoPokeMartMap from '../maps/poke_mart.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoPokeMart',
      map: KantoPokeMartMap,
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
