import { GameMap } from '@Objects';
import { KantoVermilionGymMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoVermilionGym',
      map: KantoVermilionGymMap,
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
