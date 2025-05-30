import Phaser from 'phaser';
import { Interactables, Items } from '@Objects';
import { getValue, EventBus } from '@Utilities';

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
    this.items = [];
  }
  
  initPlugins() {
    this.mapPlugins['debug'] = new Interactables.Debug(this);
    this.mapPlugins['sign'] = new Interactables.Sign(this);
    this.mapPlugins['warp'] = new Interactables.Warp(this);
    this.mapPlugins['slidetile'] = new Interactables.SlideTile(this);
    this.mapPlugins['spintile'] = new Interactables.SpinTile(this);
    this.mapPlugins['light'] = new Interactables.Light(this);
    this.mapPlugins['ledge'] = new Interactables.Ledge(this);
    // this.mapPlugins['encounter'] = new Interactables.Encounter(this);
    this.mapPlugins['npc'] = new Interactables.NPC(this);
    this.mapPlugins['pokemon'] = new Interactables.Pokemon(this);
    this.mapPlugins['player'] = new Interactables.Player(this);
    this.mapPlugins['cuttree'] = new Interactables.CutTree(this);
    this.mapPlugins['item'] = new Interactables.Item(this);
    this.mapPlugins['strengthboulder'] = new Interactables.StrengthBoulder(this);
  }

  init(data) {
    this.config = { ...this.config, ...data };
    this.registry.set('map', this.config.mapName);

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
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::loadMap', this.config.mapName]);
      console.log(['GameMap::loadMap::tilesets', tilemap.tilesets]);
      console.log(['GameMap::loadMap::layers', tilemap.layers]);
    }
    
    // all the tilesets!
    let tilesets = [];
    tilemap.tilesets.forEach((tileset) => {
      tilesets.push(tilemap.addTilesetImage(tileset.name));
    });
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::loadMap::tilesets', tilesets]);
    }
    
    // load all the layers!
    tilemap.layers
      .forEach((layer) => {
        this.tilemaps[layer.name] = tilemap
          .createLayer(layer.name, tilesets)
          .setName(layer.name)
          .setAlpha(layer.visible 
            ? layer.alpha || 1 
            : 0
          )
        ;
      });

    this.registry.set('interactions', []);

    // init the animated tiles
    this.animatedTiles.init(tilemap);
    this.initPlugins();

    // loop and init the plugins
    Object.entries(this.mapPlugins).forEach(([key, plugin]) => {
      if (this.game.config.debug.console.gameMap) {
        console.log(['GameMap::loadMap', key]);
      }
      plugin.init(this);
    });

    EventBus.emit('current-scene-ready', this);
  }

  findInteractions(type) {
    return this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === type && obj.visible
    );
  }

  interactTile(map, obj, color) {
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::interactTile', map, obj, color]);
    }
    this.registry.get('interactions').push({
      x: obj.x,
      y: obj.y,
      obj: obj
    });
    if (this.game.config.debug.tests.rectOutlines) {
      this.mapPlugins.debug.debugObject(obj, obj.id);
    }
  }

  removeInteraction(id) {
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::removeInteraction', id]);
    }
    let interactions = this.registry.get('interactions');
    let idx = interactions.findIndex((obj) => obj.obj.id === id);
    if (idx !== -1) {
      interactions.splice(idx, 1);
      if (this.game.config.debug.console.gameMap) {
        console.log(['GameMap::removeInteraction', 'removing the interaction', id, idx]);
        console.log(['GameMap::removeInteraction', interactions]);
      }
      this.registry.set('interactions', interactions);
    }
  }

  getTileProperties(x, y) {
    x = parseInt(x);
    y = parseInt(y);
    
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::getTileProperties', x, y]);
    }
    var props = new Map();
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      layer = this.config.tilemap.getLayer(layer);
      if (!layer.visible) {
        return; // skip invisible layers
      }

      let layerTiles = this.config.tilemap.getTilesWithin(x, y, 1, 1, {}, layer.name);
      if (layerTiles === null || layerTiles.length === 0) {
        return;
      }

      layerTiles.forEach(layerTile => {
        this.getPropertiesFromTile(layerTile)
          .forEach((value, key) => {
            props.set(key, value);
          })
        ;
      });
    });

    return props;
  }

  getPropertiesFromTile(tile) {
    var props = new Map();
    if (!tile || !tile.properties) {
      return props;
    }
    
    Object.entries(tile.properties).forEach(([prop, value]) => {
      // if we dont have it, add it
      if (typeof props.get(prop) === 'undefined') {
        props.set(prop, value);
      }
      // if we already have it and its a bool
      if (typeof props.get(prop) === 'boolean') {
        // make it true
        if (value === true) {
          props.set(prop, value);
        }
        // dont care about falses
      }
    });
    
    return props;
  }

  getPropertyFromTile(tile, property) {
    if (!tile || !tile.properties) {
      return null;
    }

    let props = this.getPropertiesFromTile(tile);
    let findProp = props.values().find((value) => value.name === property);

    return findProp ? findProp.value : null;
  }

  addPropertyToTile(tile, property, value) {
    if (!tile || !tile.properties) {
      return [];
    }
    
    if (typeof tile.properties === 'undefined') {
      tile.properties = [];
    }

    tile.properties.push({
      name: property,
      type: typeof value,
      value: value
    });

    return tile.properties;
  }

  getTilesWithProperty(property) {
    var tiles = []
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      let layerTiles = this.config.tilemap.getTilesWithin(
        0,
        0,
        this.config.tilemap.width,
        this.config.tilemap.height,
        {},
        layer
      );

      layerTiles.forEach(layerTile => {
        if (layerTile && getValue(layerTile.properties, property, false)) {
          tiles.push([layerTile.x, layerTile.y]);
          return;
        }
      });
    });

    return tiles;
  }
  
  isCharacterOnTile(x, y) {
    let isOnTile = false;
    this.characters.forEach((character) => {
      if (character.config.type === 'player') {
        return;
      }

      let bounds = character.getPosition();
      let xCheck = parseInt(bounds.x);
      let yCheck = parseInt(bounds.y);

      if (xCheck === x && yCheck === y) {
        isOnTile = true;
        return;
      }
    });

    return isOnTile;
  }

  addCharacter(character) {
    this.characters.set(character.name, character);
  }

  createCharacters() {
    let chars = [];
    this.characters.forEach((char, key) => {
      chars.push(char.characterDef());
    });

    if (this.items.length > 0) {
      
      this.items.forEach((item) => {
        chars.push(new Items.Pokeball({
          scene: this,
          ...item,
        }).characterDef());
      });
    }

    this.gridEngine.create(this.config.tilemap, {
      characters: chars
    });
    this.ge_init = true;
  }

  updateCharacters(time, delta) {
    // console.log(['GameMap::updateCharacters', this.characters]);
    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.update === 'function')
        .map(([_, plugin]) => plugin.update(time, delta));

    if (this.mapPlugins.player?.loadedPlayer) {
      
      this.mapPlugins['player'].player.update(time, delta);
      // if (this.scene.get('Preload').enablePlayerOWPokemon) {
      //   this.mapPlugins.player.playerMon.update(time, delta);
      // }
    }

    // if (this.pkmn.length > 0) {
    //   this.pkmn.forEach((mon) => mon.update(time, delta));
    // }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  
  initGEEvents() {
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::initGEEvents']);
    }
    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.event === 'function')
        .map(([_, plugin]) => plugin.event());
  }

}
