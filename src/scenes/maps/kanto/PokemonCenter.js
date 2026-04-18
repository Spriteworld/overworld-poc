import { GameMap } from '@Objects';
import { PokemonCenterMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'PokemonCenter',
      map: PokemonCenterMap,
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
