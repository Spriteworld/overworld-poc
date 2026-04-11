import { GameMap } from '@Objects';
import { KantoMap } from '@Maps';
import { Tile, Direction } from '@Objects';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Kanto',
      map: KantoMap,
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
      this.rect = [ [117, 280], [118, 280] ];
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
      if (isInside && !this._blockedMessageShown) {
        this._blockedMessageShown = true;
        this.game.events.emit('textbox-changedata', [
          'Its unsafe!', 
          'Wild Pokémon live in tall grass.', 
          'Get a your own Pokémon from Professor Oak!'
        ]);
        player.move(Direction.DOWN);
      } else if (!isInside) {
        this._blockedMessageShown = false;
      }
    }
  }

}
