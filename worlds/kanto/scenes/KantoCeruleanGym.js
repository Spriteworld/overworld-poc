import { GameMap } from '@Objects';
import KantoCeruleanGymMap from '../maps/cerulean_gym.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCeruleanGym',
      map: KantoCeruleanGymMap,
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
