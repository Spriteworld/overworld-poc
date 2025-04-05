import Phaser from 'phaser';
import { Interactables } from '@Objects';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor(config) {
    super({ key: config.mapName });
    this.config = config || {};
    this.config.mapName = config.mapName || '';
    this.config.tilemap = {};
    this.config.playerLocation = {};

    this.tilemaps = {};
    this.characters = new Map();
    this.npcs = new Map();
    this.pkmn = new Map();
    this.totalMon = 151;

    this.ge_init = false;
    this.ge_events_init = false;
    
    this.mapPlugins = new Map();
    this.mapPlugins['player'] = new Interactables.Player(this);
    // this.mapPlugins['npc'] = new Interactables.NPC(this);
    // this.mapPlugins['pokemon'] = new Interactables.Pokemon(this);
    // this.mapPlugins['sign'] = new Interactables.Sign(this);
    // this.mapPlugins['warp'] = new Interactables.Warp(this);
    // this.mapPlugins['slidetile'] = new Interactables.SlideTile(this);
    // this.mapPlugins['spintile'] = new Interactables.SpinTile(this);
    // this.mapPlugins['debug'] = new Interactables.Debug(this);
  }

  init(data) {
    this.config = { ...this.config, ...data };
    this.tilemaps = {};
    this.characters = new Map();
    this.npcs = new Map();
    this.pkmn = new Map();

    this.ge_init = false;
    this.ge_events_init = false;

  }

  preloadMap() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);
  }

  loadMap() {
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
        // console.log('[GameMap]', layer);
        let alpha = 1;
        if (layer.alpha !== 1) {
          alpha = layer.alpha;
        }
        if (layer.visible === false) {
          alpha = 0;
        }

        this.tilemaps[layer.name] = tilemap
          .createLayer(layer.name, tilesets)
          .setName(layer.name)
          .setAlpha(alpha)
        ;
      });

    this.registry.set('interactions', []);

    // loop and init the plugins
    Object.entries(this.mapPlugins).forEach(([key, plugin]) => {
      if (Debug.functions.gameMap) {
        console.log(['GameMap::loadMap', key]);
      }
      plugin.init(this);
    });

    // init the animated tiles
    this.animatedTiles.init(tilemap);
  }

  findInteractions(type) {
    return this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === type && obj.visible
    );
  }

  interactTile(map, obj, color) {
    this.registry.get('interactions').push({
      x: obj.x,
      y: obj.y,
      obj: obj
    });
  }

  getTileProperties(x, y) {
    var props = new Map();
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      layer = this.config.tilemap.getLayer(layer);
      if (!layer.visible) {
        return; // skip invisible layers
      }

      let layerTiles = this.config.tilemap.getTilesWithin(x, y, 1, 1, {}, layer);
      if (layerTiles === null || layerTiles.length === 0) {
        return;
      }

      layerTiles.forEach(layerTile => {
        if (!layerTile || !layerTile.properties) {
          return;
        }

        Object.entries(layerTile.properties).forEach(([prop, value]) => {
          // if we dont have it, add it
          if (typeof props[prop] === 'undefined') {
            props[prop] = value;
          }
          // if we already have it and its a bool
          if (typeof props[prop] === 'boolean') {
            // make it true
            if (value === true) {
              props[prop] = value;
            }
            // dont care about falses
          }
        });
      });
    });

    return props;
  }

  addCharacter(character) {
    this.characters.set(character);
  }

  createCharacters() {
    let chars = [];
    this.characters.forEach((_, char) => {
      chars.push(char.characterDef());
    });
    console.log(['GameMap::createCharacters', chars]);
    this.gridEngine.create(this.config.tilemap, {
      characters: chars
    });
    this.ge_init = true;
  }

  updateCharacters(time, delta) {
    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }

    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.update === 'function')
        .map(([_, plugin]) => plugin.update(time, delta));

    // if (this.mapPlugins.player?.loadedPlayer) {
    //   this.mapPlugins.player.player.update(time, delta);
    //   // if (this.scene.get('Preload').enablePlayerOWPokemon) {
    //   //   this.mapPlugins.player.playerMon.update(time, delta);
    //   // }
    // }

    // if (this.pkmn.length > 0) {
    //   // this.pkmn.forEach((mon) => mon.update(time, delta));
    // }

  }

  
  initGEEvents() {
    if (Debug.functions.gameMap) {
      console.log(['GameMap::initGEEvents']);
    }
    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.event === 'function')
        .map(([_, plugin]) => plugin.event());
  }

}
