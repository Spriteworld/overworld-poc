import {GameMap} from '@Objects';
import {KantoProfessorLabMap} from '@Maps';

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
