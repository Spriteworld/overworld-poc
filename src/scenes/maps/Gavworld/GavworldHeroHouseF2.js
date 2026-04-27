import { GameMap } from '@Objects';
import { GavworldHeroHouseF2Map } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldHeroHouseF2',
      map: GavworldHeroHouseF2Map,
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
