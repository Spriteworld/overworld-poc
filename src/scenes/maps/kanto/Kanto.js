import { GameMap } from '@Objects';
import { KantoMap } from '@Maps';
import { Tile, Direction } from '@Objects';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Kanto',
      map: KantoMap,
      active: false,
      visible: false,
    });

    this.rect = [];

    this.items = [
      {
        x: 110,
        y: 203,
        item: 'Potion',
      }
    ]
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.createCharacters();

    if (this.game.config.gameFlags.has_pokemon === false) {
      this.rect = [ [117, 279], [118, 279] ];
      this.rect.forEach((point) => {
        this.add
          .rectangle(point[0] * Tile.WIDTH, point[1] * Tile.HEIGHT, Tile.WIDTH, Tile.HEIGHT)
          .setFillStyle(0xB81D15, 1)
          .setAlpha(0.5)
          .setOrigin(0)
          .setDepth(100);
      });
    }
  }

  update(time, delta) {
    this.updateCharacters(time, delta);

    if (this.game.config.gameFlags.has_pokemon === false) {
      let player = this.mapPlugins['player'].player;
      let isInside = this.rect.some((point) => parseInt(player.x / Tile.WIDTH) === point[0] && parseInt(player.y / Tile.HEIGHT) === point[1]);
      if (isInside) {
        console.log('You need to get the Pokedex from Professor Oak!');
        player.move('down');
      }
    }
  }
}
