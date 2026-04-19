import Phaser from 'phaser';
import ScriptRunner from '@Utilities/ScriptRunner.js';
import { playBgm, lazyLoadBgm, preloadSe } from '@Utilities/AudioManager.js';
import Interactables from '@Objects/interactables/index.js';
import Items from '@Objects/items/index.js';
import * as Tile from '@Objects/Tile.js';
import { getValue, EventBus, getPropertyValue } from '@Utilities';
import { gameState } from '@Data/gameState.js';
import store from '../store/index.js';
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
  'kanto_common':       { url: Tileset.kanto_common,  frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'kanto_outside':      { url: Tileset.kanto_outside, frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
  'kanto_inside':       { url: Tileset.kanto_inside,  frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT },
};

/**
 * Maps tileset source name to its bundled JSON data.
 * Used to inline external tileset references before passing to Phaser.
 */
const TILESET_JSON_REGISTRY = {
  'gen3_inside':   Tileset.gen3inside_json,
  'gen3_outside':  Tileset.gen3outside_json,
  'rse_inside':    Tileset.rse_inside_json,
  'rse_outside':   Tileset.rse_outside_json,
  'kanto_common':   Tileset.kanto_common_json,
  'kanto_outside':  Tileset.kanto_outside_json,
  'kanto_inside':   Tileset.kanto_inside_json,
};

/**
 * Resolves external tileset references in a Tiled map JSON object,
 * returning a new map object with all tilesets inlined.
 */
function resolveExternalTilesets(mapData) {
  if (!mapData?.tilesets?.some(ts => ts.source)) return mapData;
  return {
    ...mapData,
    tilesets: mapData.tilesets.map(ts => {
      if (!ts.source) return ts;
      const name = ts.source.split('/').pop().replace('.json', '');
      const json  = TILESET_JSON_REGISTRY[name];
      if (!json) return ts;
      return { ...ts, ...json, firstgid: ts.firstgid, source: undefined };
    }),
  };
}

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
    this.mapPlugins['computer'] = new Interactables.Computer(this);
    this.mapPlugins['debug'] = new Interactables.Debug(this);
    this.mapPlugins['sign'] = new Interactables.Sign(this);
    this.mapPlugins['warp'] = new Interactables.Warp(this);
    this.mapPlugins['slidetile'] = new Interactables.SlideTile(this);
    this.mapPlugins['spintile'] = new Interactables.SpinTile(this);
    this.mapPlugins['light'] = new Interactables.Light(this);
    this.mapPlugins['ledge'] = new Interactables.Ledge(this);
    this.mapPlugins['encounter'] = new Interactables.Encounter(this);
    this.mapPlugins['grass'] = new Interactables.Grass(this);
    this.mapPlugins['npc'] = new Interactables.NPC(this);
    this.mapPlugins['pokemon'] = new Interactables.Pokemon(this);
    this.mapPlugins['player'] = new Interactables.Player(this);   // always created; .init() bails in adjacent mode
    this.mapPlugins['cuttree'] = new Interactables.CutTree(this);
    this.mapPlugins['item'] = new Interactables.Item(this);
    this.mapPlugins['strengthboulder'] = new Interactables.StrengthBoulder(this);
    this.mapPlugins['trainer']            = new Interactables.Trainer(this);
    this.mapPlugins['script']             = new Interactables.Script(this);
    // must be after 'pokemon' so addToScene() is available during init()
    this.mapPlugins['overworld_encounter'] = new Interactables.OverworldEncounter(this);

    // Cache the subset of plugins that actually define update() so the
    // per-frame loop doesn't re-filter every tick.
    this._updatablePlugins = Object.values(this.mapPlugins)
      .filter(p => typeof p?.update === 'function');
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

    // Restore persisted map variables for this scene (written by set_var commands).
    const sceneKey = this.sys.settings.key;
    this.mapVars = Object.assign({}, store.state.game.mapVars[sceneKey] ?? {});

    // Persist the current map's variant so it survives a save/load cycle.
    store.commit('game/SET_MAP_VARIANT', this.config.variant ?? null);

    this.ge_init = false;
    this.ge_events_init = false;

    // Sequence counters bumped on GridEngine position changes. NPCs compare
    // against their last-checked value to skip re-running sight / tracking
    // work when nothing on the map moved this frame.
    this._tileSeq       = 0;  // any character changed tiles
    this._playerTileSeq = 0;  // the player specifically changed tiles

    // Tile index for O(1) `isCharacterOnTile` checks. Excludes the player.
    // Kept in sync by initGEEvents's position subscription and by
    // _indexCharacter / _unindexCharacter on dynamic spawn/remove.
    this._charTileIndex = new Map();  // "x,y" → Set<charId>
    this._charLastTile  = new Map();  // charId → "x,y"
  }

  /**
   * Queue the tilemap JSON for loading during the Phaser preload phase.
   * Call this from the subclass `preload()` hook.
   */
  preloadMap() {
    this.cache.tilemap.add(this.config.mapName, {
      data:   resolveExternalTilesets(this.config.map),
      format: Phaser.Tilemaps.Formats.TILED_JSON,
    });

    preloadSe(this);

    const tilesets = this.config.map?.tilesets ?? [];
    tilesets.forEach(ts => {
      const source = ts.source ?? '';
      // Derive name from source path (external tileset) or ts.name (embedded tileset).
      const name = source ? source.split('/').pop().replace('.json', '') : (ts.name ?? '');
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

    // all the tilesets!
    let tilesets = [];
    tilemap.tilesets.forEach((tileset) => {
      const ts = tilemap.addTilesetImage(tileset.name);
      if (!ts) console.warn('[GameMap] addTilesetImage failed for', tileset.name, '— texture exists:', this.textures.exists(tileset.name));
      tilesets.push(ts);
    });
    
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

    // The phaser-animated-tiles plugin uses findIndex to set currentFrame; if the
    // animated tile's own ID is not among its animation frames, findIndex returns -1
    // (e.g. gen3_outside tile 7662 starts on frame 7694).  frames[-1] is undefined
    // and crashes on the first animation tick.  Clamp any -1 result to frame 0.
    const mapAnimDataArr = this.animatedTiles.animatedTiles;
    if (mapAnimDataArr.length > 0) {
      mapAnimDataArr[mapAnimDataArr.length - 1].animatedTiles.forEach(tile => {
        if (tile.currentFrame < 0) { tile.currentFrame = 0; }
      });
    }

    this.initPlugins();

    // loop and init the plugins
    Object.entries(this.mapPlugins).forEach(([key, plugin]) => {
      if (this.game.config.debug.console.gameMap) {
        console.log(['GameMap::loadMap', key]);
      }
      plugin.init(this);
    });

    // When arriving via a warp the previous scene already faded to black.
    // Start a camera fade-in here so the screen stays dark until map_enter
    // scripts have had a chance to run (they fire in the first update tick,
    // before the first render).
    if (this.config.warpLocationName || Object.keys(this.config.playerLocation ?? {}).length > 0) {
      this.cameras.main.fadeIn(500, 0, 0, 0);
    }

    EventBus.emit('current-scene-ready', this);
    this.game.events.emit('map-enter', this.config.mapName);
    this.preloadConnectedMaps();

    if (this.game.config.debug.console.mapDebug) {
      this._logMapDebug();
    }

    const mapSettings = this.config.map?.properties?.find(p => p.name === 'map-settings')?.value;
    const bgmKey = this.config.bgm
      ?? mapSettings?.bgm
      ?? this.config.map?.properties?.find(p => p.name === 'bgm')?.value;
    if (bgmKey) lazyLoadBgm(this, bgmKey);

    // Clean up all plugin event listeners when this scene shuts down.
    this.events.once('shutdown', () => {
      Object.values(this.mapPlugins).forEach(plugin => {
        if (typeof plugin.destroy === 'function') plugin.destroy();
      });
    });
  }

  /**
   * Returns an encounter table for the given table ID, or null to use defaults.
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

    // Cache is scoped to the current tilemap (static within a scene run).
    // Clear it if the tilemap reference ever changes.
    if (this._tilePropsCacheMap !== this.config.tilemap) {
      this._tilePropsCacheMap = this.config.tilemap;
      this._tilePropsCache    = new Map();
    }
    const key = x + ',' + y;
    const cached = this._tilePropsCache.get(key);
    if (cached) return cached;

    const props = new Map();
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      layer = this.config.tilemap.getLayer(layer);
      if (!layer.visible) return;

      const layerTiles = this.config.tilemap.getTilesWithin(x, y, 1, 1, {}, layer.name);
      if (!layerTiles || layerTiles.length === 0) return;

      for (const layerTile of layerTiles) {
        this.getPropertiesFromTile(layerTile)
          .forEach((value, k) => { props.set(k, value); });
      }
    });

    this._tilePropsCache.set(key, props);
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
    const set = this._charTileIndex.get(x + ',' + y);
    return !!(set && set.size);
  }

  /**
   * Upsert a non-player character into the tile index. Called when the
   * character is added to GridEngine (initial map load or dynamic spawn).
   * Safe to call repeatedly; idempotent.
   * @param {string} charId - GridEngine character id.
   */
  _indexCharacter(charId) {
    if (charId === 'player') return;
    const ge = this.gridEngine;
    if (!ge?.hasCharacter?.(charId)) return;
    const pos = ge.getPosition(charId);
    if (!pos) return;
    this._updateCharTileIndex(charId, pos.x + ',' + pos.y);
  }

  /**
   * Remove a non-player character from the tile index. Called from
   * MovableSprite.remove() after the character is deregistered from GE.
   * @param {string} charId
   */
  _unindexCharacter(charId) {
    this._updateCharTileIndex(charId, null);
  }

  /**
   * Internal: move a character from its last indexed tile to a new one, or
   * remove it entirely if `newKey` is null. Maintains both `_charTileIndex`
   * and `_charLastTile` in sync.
   * @param {string} charId
   * @param {string|null} newKey - "x,y" or null to remove.
   */
  _updateCharTileIndex(charId, newKey) {
    const prev = this._charLastTile.get(charId);
    if (prev === newKey) return;
    if (prev) {
      const oldSet = this._charTileIndex.get(prev);
      if (oldSet) {
        oldSet.delete(charId);
        if (oldSet.size === 0) this._charTileIndex.delete(prev);
      }
    }
    if (newKey) {
      let set = this._charTileIndex.get(newKey);
      if (!set) {
        set = new Set();
        this._charTileIndex.set(newKey, set);
      }
      set.add(charId);
      this._charLastTile.set(charId, newKey);
    } else {
      this._charLastTile.delete(charId);
    }
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
    const scaledDelta = delta * (this.game.registry.get('gameSpeed') ?? 1);
    const plugins = this._updatablePlugins;
    if (plugins) {
      for (let i = 0; i < plugins.length; i++) plugins[i].update(time, scaledDelta);
    }

    if (this.mapPlugins.player?.loadedPlayer) {
      this.mapPlugins['player'].player.update(time, scaledDelta);
    }

    // Tick NPCs / trainers / overworld Pokémon ourselves (runChildUpdate is
    // disabled on their groups) so we can cull off-screen children cheaply.
    this._updateCulledGroups(time, scaledDelta);

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  /**
   * Walk the npcs / trainers / pkmn Phaser Groups and call update() only on
   * children whose pixel position falls inside the camera's worldView
   * expanded by a small buffer. Off-screen characters skip their per-frame
   * sight / tracking / auto-move work entirely.
   * @param {number} time
   * @param {number} scaledDelta
   */
  _updateCulledGroups(time, scaledDelta) {
    const view = this.cameras?.main?.worldView;
    if (!view) return;
    const buffer = Tile.WIDTH * 4;
    const minX = view.x - buffer;
    const minY = view.y - buffer;
    const maxX = view.x + view.width  + buffer;
    const maxY = view.y + view.height + buffer;

    const tick = (group) => {
      if (!group?.getChildren) return;
      const children = group.getChildren();
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (!c.active || !c.update) continue;
        if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
        c.update(time, scaledDelta);
      }
    };
    tick(this.npcs);
    tick(this.trainers);
    tick(this.pkmn);
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
          data:   resolveExternalTilesets(mapData),
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
   * Dump a summary of everything interesting about this map to the console.
   * Gated by `debug.console.mapDebug`; fires once per map load (including warps
   * and teleports) right after plugins have run their `init()`.
   *
   * Logs: merged encounter tables, NPCs/trainers/pkmn, pre-generated OW mon
   * spawns, and warp destinations.
   */
  _logMapDebug() {
    const mapName   = this.config.mapName ?? this.config.map?.properties?.find(p => p.name === 'name')?.value ?? '(unknown)';
    const mapProps  = this.config.tilemap?.properties ?? [];
    const settings  = getPropertyValue(mapProps, 'map-settings') ?? {};

    // ── Encounter tables: top-level + every location-object fragment ──
    const fragments = [];
    if (settings['encounter-table']) fragments.push({ src: 'map-settings', table: settings['encounter-table'] });
    if (this.config.tilemap?.getObjectLayer?.('maps')) {
      const locs = this.config.tilemap.filterObjects('maps', o => o.type === 'location') ?? [];
      for (const loc of locs) {
        const ls = getPropertyValue(loc.properties ?? [], 'map-settings');
        if (ls?.['encounter-table']) fragments.push({ src: loc.name ?? 'location', table: ls['encounter-table'] });
      }
    }

    // ── NPCs / trainers / pkmn ──
    const npcs     = this.findInteractions('npc');
    const trainers = this.findInteractions('trainer');
    const pkmn     = this.findInteractions('pkmn');

    // ── OW encounter spawns (pending from the plugin) ──
    const owPlugin  = this.mapPlugins?.['overworld_encounter'];
    const owPending = owPlugin?._pending ?? [];

    // ── Warps ──
    const warps = this.findInteractions('warp');

    console.groupCollapsed(`[mapDebug] ${mapName}`);

    if (fragments.length === 0) {
      console.log('encounter-tables: (none)');
    } else {
      console.groupCollapsed(`encounter-tables (${fragments.length} fragment${fragments.length === 1 ? '' : 's'})`);
      for (const { src, table } of fragments) {
        console.groupCollapsed(src);
        for (const [key, list] of Object.entries(table ?? {})) {
          const rows = (Array.isArray(list) ? list : [])
            .map(e => e?.value ?? e)
            .filter(e => e?.species)
            .map(e => ({
              species:  e.species,
              rarity:   e.rarity ?? null,
              levelMin: e['level-range-min'] ?? null,
              levelMax: e['level-range-max'] ?? null,
            }));
          if (rows.length === 0) continue;
          console.groupCollapsed(`${key} (${rows.length})`);
          console.table(rows);
          console.groupEnd();
        }
        console.groupEnd();
      }
      console.groupEnd();
    }

    const npcRows = npcs.map(o => ({
      name:    o.name,
      type:    o.type,
      tileX:   Math.floor(o.x / Tile.WIDTH),
      tileY:   Math.floor(o.y / Tile.HEIGHT),
      texture: getPropertyValue(o.properties ?? [], 'overworld-texture') ?? '',
    }));
    if (npcRows.length > 0) {
      console.groupCollapsed(`npcs (${npcRows.length})`);
      console.table(npcRows);
      console.groupEnd();
    }

    const trainerRows = trainers.map(o => {
      const team = getPropertyValue(o.properties ?? [], 'trainer-pokemon');
      const teamSummary = Array.isArray(team)
        ? team.map(e => {
            const v = e?.value ?? e;
            return `${v?.species ?? '?'}(L${v?.level ?? '?'})`;
          }).join(', ')
        : (typeof team === 'string' ? team.slice(0, 120) : '');
      return {
        name:    o.name,
        tileX:   Math.floor(o.x / Tile.WIDTH),
        tileY:   Math.floor(o.y / Tile.HEIGHT),
        texture: getPropertyValue(o.properties ?? [], 'overworld-texture') ?? '',
        team:    teamSummary,
      };
    });
    if (trainerRows.length > 0) {
      console.groupCollapsed(`trainers (${trainerRows.length})`);
      console.table(trainerRows);
      console.groupEnd();
    }

    const pkmnRows = pkmn.map(o => ({
      name:    o.name,
      tileX:   Math.floor(o.x / Tile.WIDTH),
      tileY:   Math.floor(o.y / Tile.HEIGHT),
      texture: getPropertyValue(o.properties ?? [], 'overworld-texture') ?? '',
    }));
    if (pkmnRows.length > 0) {
      console.groupCollapsed(`pkmn objects (${pkmnRows.length})`);
      console.table(pkmnRows);
      console.groupEnd();
    }

    if (owPending.length > 0) {
      const rows = owPending.map(p => {
        const mon = p.battleConfig?.enemy?.team?.[0];
        return {
          tileX:   p.x,
          tileY:   p.y,
          species: mon?.species ?? '?',
          level:   mon?.level ?? '?',
          shiny:   !!mon?.isShiny,
          texture: p.texture ?? '',
        };
      });
      console.groupCollapsed(`ow-encounter spawns (${rows.length})`);
      console.table(rows);
      console.groupEnd();
    }

    const warpRows = warps.map(o => ({
      name:        o.name ?? '',
      tileX:       Math.floor(o.x / Tile.WIDTH),
      tileY:       Math.floor(o.y / Tile.HEIGHT),
      destination: getPropertyValue(o.properties ?? [], 'warp')          ?? '',
      anchor:      getPropertyValue(o.properties ?? [], 'warp-location') ?? '',
    }));
    if (warpRows.length > 0) {
      console.groupCollapsed(`warps (${warpRows.length})`);
      console.table(warpRows);
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * Call the `event()` method on every plugin that exposes one.
   * Runs once after GridEngine has been fully initialised.
   */
  initGEEvents() {
    if (this.game.config.debug.console.gameMap) {
      console.log(['GameMap::initGEEvents']);
    }
    if (this.config._pendingScript?.length) {
      const queue = [...this.config._pendingScript];
      delete this.config._pendingScript;
      new ScriptRunner(this, queue).run();
    }

    Object.entries(this.mapPlugins)
        .filter(([_, plugin]) => typeof plugin.event === 'function')
        .map(([_, plugin]) => plugin.event());

    // Seed the store with the player's initial position on this map.
    const spawn = this.gridEngine.getPosition('player');
    gameState.playerTile = {
      x: spawn.x,
      y: spawn.y,
      charLayer: this.gridEngine.getCharLayer('player'),
    };

    // Seed the tile index with every non-player character's starting tile.
    for (const [charId, character] of this.characters) {
      if (character.config.type !== 'player') this._indexCharacter(charId);
    }

    // Keep playerTile current as the player moves, and bump the seq counters
    // that NPC sight / tracking checks read to decide whether to re-evaluate.
    this._playerTileSub = this.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, enterTile }) => {
        this._tileSeq++;
        if (charId === 'player') {
          this._playerTileSeq++;
          gameState.playerTile = {
            x: enterTile.x,
            y: enterTile.y,
            charLayer: this.gridEngine.getCharLayer('player'),
          };
          if (!this.config?.inside) {
            store.commit('game/SET_LAST_OUTDOOR_LOCATION', {
              map:       this.config.mapName,
              x:         enterTile.x,
              y:         enterTile.y,
              charLayer: this.gridEngine.getCharLayer('player'),
            });
          }
        } else {
          // NPC moved — mark its own tracking pyramid stale (the pyramid is
          // anchored at the NPC's tile, so it must regenerate on arrival).
          const npc = this.characters.get(charId);
          if (npc) npc._trackingCoordsStale = true;
          // Keep the tile index in sync with the character's new position.
          this._updateCharTileIndex(charId, enterTile.x + ',' + enterTile.y);
        }
      });

    this.events.once('shutdown', () => this._playerTileSub?.unsubscribe());
  }

}
