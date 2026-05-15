import { GameMap } from '@Objects';
import KantoIndigoPlateau_ExteriorMap from '../maps/indigo_plateau_exterior.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoIndigoPlateau_Exterior',
      map: KantoIndigoPlateau_ExteriorMap,
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
