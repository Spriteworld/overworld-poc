import {GameMap} from '@Objects';
import KantoHeroHouseF1Map from '../maps/hero_house_floor1.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoHeroHouseF1',
      map: KantoHeroHouseF1Map,
      inside: true
    });
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
