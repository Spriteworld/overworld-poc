import {GameMap} from '@Objects';
import KantoProfessorLabMap from '../maps/prof_lab.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoProfessorLab',
      map: KantoProfessorLabMap,
      inside: true,
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
