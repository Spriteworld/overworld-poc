import { GameMap, Direction } from '@Objects';
import KantoPalletTownMap from '../maps/pallet.json';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'KantoPalletTown',
      map: KantoPalletTownMap,
      bgm: 'pallet',
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
