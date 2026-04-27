import { GameMap } from '@Objects';
import { GavworldProfessorLabMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'GavworldProfessorLab',
      map: GavworldProfessorLabMap,
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
