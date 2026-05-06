import { GameMap } from '@Objects';
import KantoCeladonGymMap from '../maps/celadon_gym.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCeladonGym',
      map: KantoCeladonGymMap,
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
