import {GameMap} from '@Objects';
import {KantoHeroHouseF1Map} from '@Maps';

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
