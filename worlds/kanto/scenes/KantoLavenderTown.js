import { GameMap } from '@Objects';
import KantoLavenderTownMap from '../maps/lavender_town.json';

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
