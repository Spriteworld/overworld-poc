import { GameMap } from '@Objects';
import { GavWorldMap } from '@Maps';
import { Tile, Direction } from '@Objects';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavWorld',
      map: GavWorldMap,
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
