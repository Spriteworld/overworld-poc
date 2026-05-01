import { GameMap } from '@Objects';
import { KantoFushsiaGymMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoFushsiaGym',
      map: KantoFushsiaGymMap,
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
