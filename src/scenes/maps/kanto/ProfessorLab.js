import {GameMap} from '@Objects';
import {ProfessorLabMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'ProfessorLab',
      map: ProfessorLabMap,
      active: false,
      visible: false,
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
