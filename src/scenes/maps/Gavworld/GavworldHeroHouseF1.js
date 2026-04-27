import { GameMap } from '@Objects';
import { GavworldHeroHouseF1Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldHeroHouseF1',
      map: GavworldHeroHouseF1Map,
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
