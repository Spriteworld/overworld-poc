import { GameMap } from '@Objects';
import { KantoLavenderTownMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoLavenderTown',
      map: KantoLavenderTownMap,
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
