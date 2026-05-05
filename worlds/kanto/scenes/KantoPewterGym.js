import { GameMap } from '@Objects';
import KantoPewterGymMap from '../maps/pewter_gym.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoPewterGym',
      map: KantoPewterGymMap,
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
