import { GameMap } from '@Objects';
import { SpriteworldMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Spriteworld',
      map: SpriteworldMap,
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
