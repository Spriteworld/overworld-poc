import { GameMap } from '@Objects';
import KantoMap from '../master/maps/kanto.json';
import { Tile, Direction } from '@Objects';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Kanto',
      map: KantoMap,
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
