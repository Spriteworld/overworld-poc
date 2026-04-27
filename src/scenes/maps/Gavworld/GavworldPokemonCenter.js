import { GameMap } from '@Objects';
import { GavworldPokemonCenterMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldPokemonCenter',
      map: GavworldPokemonCenterMap,
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
