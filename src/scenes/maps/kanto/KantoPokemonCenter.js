import { GameMap } from '@Objects';
import { KantoPokemonCenterMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoPokemonCenter',
      map: KantoPokemonCenterMap,
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
