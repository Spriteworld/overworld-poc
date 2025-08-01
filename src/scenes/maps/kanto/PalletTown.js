import { GameMap, Direction } from '@Objects';
import { PalletTownMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'PalletTown',
      map: PalletTownMap,
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

    // this.mapPlugins['player'].player.handleMove(Direction.DOWN);
  }
}
