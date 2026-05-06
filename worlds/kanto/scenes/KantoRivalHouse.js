import { GameMap } from '@Objects';
import KantoRivalHouseMap from '../maps/rival_house.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoRivalHouse',
      map: KantoRivalHouseMap,
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
