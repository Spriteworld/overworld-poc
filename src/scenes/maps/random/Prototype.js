import Phaser from 'phaser';
import { SkylandMap } from '@Maps';
import { Interactables, Tile, Player, NPC } from '@Objects';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor(config) {
    super({ key: 'Prototype' });

    this.config = config || {};
    this.config.mapName = 'Skyland';
    this.config.map = SkylandMap;
    this.config.tilemap = {};
    this.config.playerLocation = {};

    this.tilemaps = {};
    this.characters = new Map();
    this.player = {};

    this.ge_init = false;
    this.ge_events_init = false;

    this.mapPlugins = new Map();
    this.mapPlugins['player'] = new Interactables.Player(this);
  }

  preload() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);
  }

  create () {
    var tilemap = this.make.tilemap({ key: this.config.mapName });
    this.config.tilemap = tilemap;
    // console.log(['GameMap::loadMap', tilemap]);

    // all the tilesets!
    let tilesets = [];
    tilemap.tilesets.forEach((tileset) => {
      tilesets.push(tilemap.addTilesetImage(tileset.name));
    });

    // load all the layers!
    tilemap.layers
      .forEach((layer) => {
        console.log('[GameMap]', layer);

        let alpha = 1;
        if (layer.visible === false) {
          alpha = 0;
        }
        if (layer.alpha) {
          alpha = layer.alpha;
        }

        this.tilemaps[layer.name] = tilemap
          .createLayer(layer.name, tilesets)
          .setName(layer.name)
          .setAlpha(alpha)
        ;
      });

    // loop and init the plugins
    Object.entries(this.mapPlugins).forEach(([key, plugin]) => {
      if (Debug.functions.gameMap) {
        console.log(['GameMap::loadMap', key]);
      }
      plugin.init(this);
    });

    this.animatedTiles.init(tilemap);
    this.createCharacters();

    let spawn = this.findInteractions('playerSpawn');
    this.player = new Player({
      id: 'player',
      texture: 'red',
      x: spawn[0].x / Tile.WIDTH,
      y: spawn[0].y / Tile.HEIGHT,
      scene: this,
      'seen-radius': 3,
    });

  }

  update(time, delta) {
    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
    console.log('Prototype::update');
    // this.player.update();
    // this.gridEngine.move('player', 'up');

    // Object.entries(this.mapPlugins)
    //     .filter(([_, plugin]) => typeof plugin.update === 'function')
    //     .map(([_, plugin]) => plugin.update(time, delta));

  }

  findInteractions(type) {
    return this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === type && obj.visible
    );
  }

  addCharacter(character) {
    this.characters.set(character);
  }
  
  createCharacters() {
    let chars = [];
    this.characters.forEach((_, char) => {
      chars.push(char.characterDef());
    });

    this.gridEngine.create(this.config.tilemap, {
      characters: chars
    });
    this.ge_init = true;
  }

  initGEEvents() {
    if (Debug.functions.gameMap) {
      console.log(['GameMap::initGEEvents']);
    }
    // Object.entries(this.mapPlugins)
    //     .filter(([_, plugin]) => typeof plugin.event === 'function')
    //     .map(([_, plugin]) => plugin.event());
  }
}
