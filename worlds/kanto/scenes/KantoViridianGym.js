import { GameMap } from '@Objects';
import KantoViridianGymMap from '../maps/viridian_gym.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoViridianGym',
      map: KantoViridianGymMap,
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
