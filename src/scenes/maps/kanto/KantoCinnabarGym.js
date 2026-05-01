import { GameMap } from '@Objects';
import { KantoCinnabarGymMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoCinnabarGym',
      map: KantoCinnabarGymMap,
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
