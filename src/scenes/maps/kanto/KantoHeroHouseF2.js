import {GameMap} from '@Objects';
import {KantoHeroHouseF2Map} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoHeroHouseF2',
      map: KantoHeroHouseF2Map,
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
