import Phaser from 'phaser';
import { Interactables, Items, Tile } from '@Objects';
import { getValue, EventBus } from '@Utilities';
import Tileset from '@Tileset';
import { MAP_REGISTRY } from '@Maps';

/**
 * Maps the tileset name (derived from the map JSON source filename) to the
 * Vite-processed image URL and frame dimensions for lazy loading.
 */
const TILESET_REGISTRY = {
  'gen3_inside':        { url: Tileset.gen3inside,    frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'gen3_outside':       { url: Tileset.gen3outside,   frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'rse_inside':         { url: Tileset.rse_inside,    frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'rse_outside':        { url: Tileset.rse_outside,   frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'kanto':              { url: Tileset.kanto_map,     frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'pallet_town_inside': { url: Tileset.pallet_inside, frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
};

export default class extends Phaser.Scene {
  /**
   * @param {object} config - Scene configuration.
   * @param {string} config.mapName - Phaser scene key and tilemap key for this map.
   * @param {object} [config.map] - Tilemap JSON asset or URL.
   */
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
  
  /**
   * Instantiate all map interactable plugins and store them in `this.mapPlugins`.
   * Called during `loadMap()` after the tilemap layers are created.
   */
  initPlugins() {
    this.mapPlugins['debug'] = new Interactables.Debug(this);
    this.mapPlugins['sign'] = new Interactables.Sign(this);
    this.mapPlugins['warp'] = new Interactables.Warp(this);
    this.mapPlugins['slidetile'] = new Interactables.SlideTile(this);
    this.mapPlugins['spintile'] = new Interactables.SpinTile(this);
    this.mapPlugins['light'] = new Interactables.Light(this);
    this.mapPlugins['ledge'] = new Interactables.Ledge(this);
    this.mapPlugins['encounter'] = new Interactables.Encounter(this);
    this.mapPlugins['npc'] = new Interactables.NPC(this);
    this.mapPlugins['pokemon'] = new Interactables.Pokemon(this);
    this.mapPlugins['player'] = new Interactables.Player(this);   // always created; .init() bails in adjacent mode
    this.mapPlugins['cuttree'] = new Interactables.CutTree(this);
    this.mapPlugins['item'] = new Interactables.Item(this);
    this.mapPlugins['strengthboulder'] = new Interactables.StrengthBoulder(this);
  }

  /**
   * Phaser scene lifecycle hook — receives scene init data and resets per-scene state.
   * @param {object} data - Data passed from the previous scene (e.g. playerLocation).
   */
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

  /**
   * Queue the tilemap JSON for loading during the Phaser preload phase.
   * Call this from the subclass `preload()` hook.
   */
  preloadMap() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);

    const tilesets = this.config.map?.tilesets ?? [];
    tilesets.forEach(ts => {
      const source = ts.source ?? '';
      const name   = source.split('/').pop().replace('.json', '');
      if (!name || this.textures.exists(name)) return;
      const entry = TILESET_REGISTRY[name];
      if (entry) {
        this.load.spritesheet(name, entry.url, {
          frameWidth:  entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      } else {
        console.warn(`[GameMap] No registry entry for tileset '${name}' — add it to TILESET_REGISTRY in GameMap.js`);
      }
    });
  }

  /**
   * Create the tilemap, add all tilesets, render every layer, initialise all
   * interactable plugins, and emit `current-scene-ready` on the EventBus.
   * Call this from the subclass `create()` hook after assets are loaded.
   */
  loadMap() {
    this.registry.set('player_input', true);
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
    this.game.events.emit('map-enter', this.config.mapName);
    this.preloadConnectedMaps();

    // Clean up all plugin event listeners when this scene shuts down.
    this.events.once('shutdown', () => {
      Object.values(this.mapPlugins).forEach(plugin => {
        if (typeof plugin.destroy === 'function') plugin.destroy();
      });
    });
  }

  /**
   * Returns an encounter table for the given table ID, or null to use defaults.
   * Override in individual map scenes to define wild Pokémon pools.
   *
   * @returns {Record<string, Array<{pokemon: string, level: [number,number], rarity: number}>> | null}
   */
  encounterTable() {
    return null;
  }

  /**
   * Filter the Tiled `interactions` object layer for visible objects of the given type.
   * @param {string} type - The Tiled object type string to match (e.g. `'warp'`, `'sign'`).
   * @returns {object[]} Array of matching Tiled objects.
   */
  findInteractions(type) {
    return this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === type && obj.visible
    );
  }

  /**
   * Register a Tiled object as an interactable tile in the scene registry
   * and optionally render a debug outline.
   * @param {*} map - Unused; kept for API compatibility.
   * @param {object} obj - The Tiled object with `x`, `y`, and `id` properties.
   * @param {number} color - Debug rectangle fill colour (hex).
   */
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

  /**
   * Remove an interactable object from the registry by its Tiled object ID.
   * @param {number|string} id - The `id` of the Tiled object to remove.
   */
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

  /**
   * Collect all tile properties from every visible layer at the given tile coordinates.
   * Boolean properties are OR-merged so that any `true` value wins.
   * @param {number} x - Tile x coordinate.
   * @param {number} y - Tile y coordinate.
   * @returns {Map<string,*>} Merged property map.
   */
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

  /**
   * Extract all custom properties from a single Phaser tile object into a Map.
   * @param {Phaser.Tilemaps.Tile} tile - The tile to read properties from.
   * @returns {Map<string,*>} Property name → value map.
   */
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

  /**
   * Look up a single named property on a tile.
   * @param {Phaser.Tilemaps.Tile} tile - The tile to inspect.
   * @param {string} property - The property name to find.
   * @returns {*} The property value, or null if not found.
   */
  getPropertyFromTile(tile, property) {
    if (!tile || !tile.properties) {
      return null;
    }

    let props = this.getPropertiesFromTile(tile);
    let findProp = props.values().find((value) => value.name === property);

    return findProp ? findProp.value : null;
  }

  /**
   * Push a new property entry onto a tile's properties array.
   * @param {Phaser.Tilemaps.Tile|object} tile - The tile to mutate.
   * @param {string} property - Property name.
   * @param {*} value - Property value.
   * @returns {Array} The updated properties array, or an empty array if the tile is invalid.
   */
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

  /**
   * Return the [x, y] coordinates of every tile across all layers that has
   * the specified property set to a truthy value.
   * @param {string} property - The tile property name to search for.
   * @returns {Array<[number, number]>} Array of `[tileX, tileY]` pairs.
   */
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
  
  /**
   * Returns true if any non-player character currently occupies the given tile.
   * @param {number} x - Tile x coordinate.
   * @param {number} y - Tile y coordinate.
   * @returns {boolean}
   */
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

  /**
   * Register a character instance in the scene's character map, keyed by name.
   * @param {import('./characters/Character').default} character - The character to register.
   */
  addCharacter(character) {
    this.characters.set(character.name, character);
  }

  /**
   * Build GridEngine character definitions for all registered characters and
   * items, then initialise GridEngine with them.
   */
  createCharacters() {
    if (this.ge_init) return;

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

  /**
   * Per-frame update hook. Runs all plugin `update()` callbacks, updates the
   * player character, and triggers GridEngine event binding once on the first
   * frame after GridEngine is initialised.
   * @param {number} time - Current game time in ms.
   * @param {number} delta - Time since last frame in ms.
   */
  updateCharacters(time, delta) {
    // console.log(['GameMap::updateCharacters', this.characters]);
    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.update === 'function')
        .map(([_, plugin]) => plugin.update(time, delta));

    if (this.mapPlugins.player?.loadedPlayer) {
      
      this.mapPlugins['player'].player.update(time, delta);
    }

    // if (this.pkmn.length > 0) {
    //   this.pkmn.forEach((mon) => mon.update(time, delta));
    // }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  
  /**
   * Proactively fetch tileset images for every map the player can warp to
   * from the current map, so destination scenes find assets already cached.
   * Destinations are auto-derived from warp objects in the map JSON plus any
   * keys listed in `this.config.connections`.
   */
  preloadConnectedMaps() {
    const destinations = new Set();

    // Connections from warp objects (hero house, prof lab, etc.)
    (this.config.map?.layers ?? []).forEach(layer => {
      if (layer.type !== 'objectgroup') return;
      (layer.objects ?? []).forEach(obj => {
        const warpProp = (obj.properties ?? []).find(p => p.name === 'warp');
        if (warpProp?.value) destinations.add(warpProp.value);
      });
    });

    // Explicit connections declared in scene config
    (this.config.connections ?? []).forEach(key => destinations.add(key));

    destinations.forEach(destKey => {
      const mapData = MAP_REGISTRY[destKey];
      if (!mapData) return;

      // Register tilemap JSON in cache (no network cost)
      if (!this.cache.tilemap.has(destKey)) {
        this.cache.tilemap.add(destKey, {
          data:   mapData,
          format: Phaser.Tilemaps.Formats.TILED_JSON,
        });
      }

      // Queue any tileset images not yet loaded
      (mapData.tilesets ?? []).forEach(ts => {
        const name = (ts.source ?? '').split('/').pop().replace('.json', '');
        if (!name || this.textures.exists(name)) return;
        const entry = TILESET_REGISTRY[name];
        if (entry) {
          this.load.spritesheet(name, entry.url, {
            frameWidth:  entry.frameWidth,
            frameHeight: entry.frameHeight,
          });
        } else {
          console.warn(`[GameMap] preloadConnectedMaps: no registry entry for tileset '${name}'`);
        }
      });
    });

    if (this.load.totalToLoad > 0) {
      this.load.start();
    }
  }

  /**
   * Call the `event()` method on every plugin that exposes one.
   * Runs once after GridEngine has been fully initialised.
   */
  initGEEvents() {
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::initGEEvents']);
    }
    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.event === 'function')
        .map(([_, plugin]) => plugin.event());
  }

}
