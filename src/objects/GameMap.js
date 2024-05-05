import Phaser from 'phaser';
import { Player, NPC, PkmnOverworld, ObjectTypes, Tile, Interactables } from '@Objects';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor(config) {
    super({ key: config.mapName });
    this.config = config || {};
    this.config.mapName = config.mapName || '';
    this.config.tilemap = {};
    this.config.playerLocation = {};

    this.tilemaps = {};
    this.characters = [];
    this.npcs = [];
    this.pkmn = [];
    this.totalMon = 151;

    this.ge_init = false;
    this.ge_events_init = false;
    
    this.mapPlugins = new Map();
    this.mapPlugins['player'] = new Interactables.Player(this);
    this.mapPlugins['npc'] = new Interactables.NPC(this);
    this.mapPlugins['pokemon'] = new Interactables.Pokemon(this);
    this.mapPlugins['sign'] = new Interactables.Sign(this);
    this.mapPlugins['warp'] = new Interactables.Warp(this);
    this.mapPlugins['slidetile'] = new Interactables.SlideTile(this);
    this.mapPlugins['spintile'] = new Interactables.SpinTile(this);
    this.mapPlugins['debug'] = new Interactables.Debug(this);
    this.updatePlugins = new Map();
    this.eventPlugins = new Map();
  }

  init(data) {
    this.config = { ...this.config, ...data };
    this.tilemaps = {};
    this.characters = [];
    this.npcs = [];
    this.pkmn = [];

    this.ge_init = false;
    this.ge_events_init = false;

  }

  preloadMap() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);
  }

  loadMap() {
    var tilemap = this.make.tilemap({ key: this.config.mapName });
    this.config.tilemap = tilemap;

    // all the tilesets!
    let tilesets = [
      tilemap.addTilesetImage('gen3_inside'),
      tilemap.addTilesetImage('gen3_outside'),
      tilemap.addTilesetImage('rse_inside'),
      tilemap.addTilesetImage('rse_outside'),
    ];

    // load all the layers!
    tilemap.layers
      .forEach((layer) => {
        // console.log('[GameMap]', layer);

        this.tilemaps[layer.name] = tilemap
          .createLayer(layer.name, tilesets)
          .setName(layer.name)
          .setAlpha(layer.visible ? 1 : 0)
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
    this.characters.push(character);
  }

  createCharacters() {
    this.gridEngine.create(this.config.tilemap, {
      characters: this.characters.map(char => {
        return char.characterDef();
      })
    });
    this.ge_init = true;
  }

  updateCharacters(time, delta) {
    if (this.mapPlugins.player?.loadedPlayer) {
      this.mapPlugins.player.player.update(time, delta);
      if (this.scene.get('Preload').enablePlayerOWPokemon) {
        this.mapPlugins.player.playerMon.update(time, delta);
      }
    }

    if (this.pkmn.length > 0) {
      // this.pkmn.forEach((mon) => mon.update(time, delta));
    }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  
  initGEEvents() {
    Object.entries(this.eventPlugins).forEach(([key, plugin]) => {
      if (Debug.functions.gameMap) {
        console.log(['GameMap::initGEEvents', key]);
      }
      plugin.event();
    });

  }

}
