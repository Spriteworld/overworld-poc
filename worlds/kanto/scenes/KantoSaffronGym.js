import { GameMap } from '@Objects';
import KantoSaffronGymMap from '../maps/saffron_gym.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoSaffronGym',
      map: KantoSaffronGymMap,
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
