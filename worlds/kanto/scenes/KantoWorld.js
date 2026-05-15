import { GameMap, Tile } from '@Objects';
import { lazyLoadBgm } from '@Utilities/AudioManager.js';
import { MAP_REGISTRY, WORLD_MAP_KEYS, TILESET_JSON_REGISTRY } from '@/worlds/registry.js';
import { gameState } from '@Data/gameState.js';
import KantoMap from '../master/maps/kanto.json';
import kantoWorldRaw from '../maps/kanto.world?raw';
import kantoOutsideJson from '../tilesets/kanto_outside.json';
import Tileset from '@Tileset';

const WORLD_FILE = JSON.parse(kantoWorldRaw);
import RainFx, { RAIN_VARIANTS } from '@Objects/RainFx.js';
import FogFx, { FOG_VARIANTS } from '@Objects/FogFx.js';
import SandstormFx, { SANDSTORM_VARIANTS } from '@Objects/SandstormFx.js';
import SnowFx, { SNOW_VARIANTS } from '@Objects/SnowFx.js';
import SunlightFx, { SUNLIGHT_VARIANTS } from '@Objects/SunlightFx.js';

/**
 * Pixel offset between kanto.json coordinates and world-file coordinates.
 * kanto_pixel = world_pixel + KANTO_OFFSET_*
 */
const KANTO_OFFSET_X = 2592;
const KANTO_OFFSET_Y = 7616;

const TILESET_BY_NAME = {
  ...TILESET_JSON_REGISTRY,
  'kanto_outside': kantoOutsideJson,
};

/** Scene keys for maps that are part of the outdoor world (movement is seamless). */
const WORLD_SCENE_KEYS = new Set(Object.values(WORLD_MAP_KEYS));

export default class KantoWorld extends GameMap {
  constructor() {
    super({ mapName: 'KantoWorld', map: null });
  }

  preload() {
    this.config.map = this._buildWorldTilemap();
    this.preloadMap();
    if (!this.textures.exists('animated_grass')) {
      this.load.spritesheet('animated_grass', Tileset.animated_grass, { frameWidth: 32, frameHeight: 32 });
    }
    if (!this.textures.exists('animation')) {
      this.load.spritesheet('animation', Tileset.animation_sheet, { frameWidth: 32, frameHeight: 32 });
    }
  }

  create() {
    this.loadMap();
    this._initLocationZones();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }

  /**
   * Build location zone rectangles (in merged-world tile space) from the
   * "maps" objectgroup in kanto.json.  Called once in create().
   */
  _initLocationZones() {
    const maps = WORLD_FILE.maps;
    const minX  = Math.min(...maps.map(m => m.x));
    const minY  = Math.min(...maps.map(m => m.y));

    const layer = KantoMap.layers.find(l => l.name === 'maps' && l.type === 'objectgroup');
    this._locationZones = (layer?.objects ?? []).map(obj => {
      const mapSettings = obj.properties?.find(p => p.name === 'map-settings')?.value;
      return {
        name: obj.name,
        bgm:  mapSettings?.bgm ?? null,
        weather: mapSettings?.weather_type ?? 'none',
        // Convert kanto.json pixel origin → merged-world tile coords.
        x: (obj.x - KANTO_OFFSET_X - minX) / Tile.WIDTH,
        y: (obj.y - KANTO_OFFSET_Y - minY) / Tile.HEIGHT,
        w: obj.width  / Tile.WIDTH,
        h: obj.height / Tile.HEIGHT,
      };
    });
    this._currentLocation    = null;
    this._currentBgmKey      = null;
    this._currentWeatherType = 'none';
  }

  /**
   * Subscribe to GridEngine position events to detect location zone changes.
   * Overrides GameMap.initGEEvents() — called on the first frame after GE init.
   */
  initGEEvents() {
    super.initGEEvents();

    // Check the player's spawn tile immediately (replaces the generic 'map-enter' toast).
    this._checkLocation(this.gridEngine.getPosition('player'));
    this._checkForBGM();
    this._checkForWeather();

    this._locationSub = this.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, enterTile }) => {
        if (charId !== 'player') return;
        this._checkLocation(enterTile);
        this._checkForBGM();
        this._checkForWeather();
      });

    this.events.once('shutdown', () => this._locationSub?.unsubscribe());
  }

  /**
   * Test whether the given tile falls inside a different location zone than
   * the current one and, if so, fire a toast with the new location name.
   * @param {{x:number, y:number}} tilePos
   */
  _checkLocation(tilePos) {
    const zone = this._locationZones.find(z =>
      tilePos.x >= z.x && tilePos.x < z.x + z.w &&
      tilePos.y >= z.y && tilePos.y < z.y + z.h
    );
    const name = zone?.name ?? null;
    if (name === this._currentLocation) return;

    this._currentLocation = name;
    if (!name) return;

    const display = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2');
    this.game.events.emit('toast', display);
  }

  /**
   * If the current location zone has a BGM key that differs from the one
   * already playing, start loading and playing it.
   */
  _checkForBGM() {
    const zone   = this._locationZones.find(z => z.name === this._currentLocation);
    const bgmKey = zone?.bgm ?? null;
    if (!bgmKey || bgmKey === this._currentBgmKey) return;
    this._currentBgmKey = bgmKey;
    lazyLoadBgm(this, bgmKey);
  }

  /**
   * Swap weather effects when the player crosses into a zone whose
   * `weather_type` differs from the current one. Variants are resolved
   * through RAIN_VARIANTS (`light_rain` / `heavy_rain` for now); any
   * other value (or leaving a weather zone) destroys the active effect.
   * Debug-flag-driven rain (force-on for testing) is left alone — it's
   * instantiated by GameMap.loadMap and never managed here.
   */
  _checkForWeather() {
    if (this.game.config.debug?.rain) return;  // global override owns rainFx

    // forceWeatherType (test harness) ignores zone weather and pins the map
    // to a single variant — once set the zone changes are ignored.
    const force = this.game.config.debug?.forceWeatherType;
    const zone = this._locationZones.find(z => z.name === this._currentLocation);
    const next = force ?? zone?.weather ?? 'none';
    if (next === this._currentWeatherType) return;
    this._currentWeatherType = next;

    // Tear down whichever weather effect was previously running, then spin
    // up the one matching the new zone (the variant tables are disjoint so
    // at most one fires per zone).
    if (this.rainFx)      { this.rainFx.destroy();      this.rainFx      = null; }
    if (this.fogFx)       { this.fogFx.destroy();       this.fogFx       = null; }
    if (this.sandstormFx) { this.sandstormFx.destroy(); this.sandstormFx = null; }
    if (this.snowFx)      { this.snowFx.destroy();      this.snowFx      = null; }
    if (this.sunlightFx)  { this.sunlightFx.destroy();  this.sunlightFx  = null; }

    const rainCfg = RAIN_VARIANTS[next];
    if (rainCfg) this.rainFx = new RainFx(this, rainCfg);

    const fogCfg = FOG_VARIANTS[next];
    if (fogCfg) this.fogFx = new FogFx(this, fogCfg);

    const sandCfg = SANDSTORM_VARIANTS[next];
    if (sandCfg) this.sandstormFx = new SandstormFx(this, sandCfg);

    const snowCfg = SNOW_VARIANTS[next];
    if (snowCfg) this.snowFx = new SnowFx(this, snowCfg);

    const sunCfg = SUNLIGHT_VARIANTS[next];
    if (sunCfg) this.sunlightFx = new SunlightFx(this, sunCfg);
  }

  /**
   * Merge all maps listed in kanto.world into a single Tiled-JSON-compatible
   * object that GameMap / GridEngine can consume as one tilemap.
   *
   * Layer strategy:
   *  - Visual layers (floor, ground, middle, top) are merged by name.
   *  - Each map marks a different layer with ge_charLayer:"ground" for collision;
   *    those are all merged into a hidden "_collision_ground" layer so GridEngine
   *    sees one consistent charLayer across the whole world.
   *  - The "top" charLayer is consistent (all maps use the top layer), so the
   *    merged top layer keeps ge_charLayer:"top" directly.
   *  - Inter-world warps are dropped; only warps to indoor/external scenes remain.
   *  - Only one playerSpawn is kept.
   */
  _buildWorldTilemap() {
    const maps = WORLD_FILE.maps;

    // ── World bounds in pixels ───────────────────────────────────────────────
    const minX = Math.min(...maps.map(m => m.x));
    const minY = Math.min(...maps.map(m => m.y));
    const maxX = Math.max(...maps.map(m => m.x + m.width));
    const maxY = Math.max(...maps.map(m => m.y + m.height));

    const worldW = (maxX - minX) / Tile.WIDTH;
    const worldH = (maxY - minY) / Tile.HEIGHT;

    // ── Merged tileset list + per-map GID remapper ───────────────────────────
    // Source maps may use different tilesets (kanto vs gen3_outside). We assign
    // non-overlapping firstgids in the merged world and remap GIDs accordingly.
    // kanto tileset (firstgid=1 in all source maps) stays at firstgid=1.
    // Additional tilesets (gen3_outside, firstgid=1 locally) are placed after.
    // seenSources: source path → merged firstgid assigned in this world.
    // allTilesets: full inline tileset objects (no source refs) so Phaser's
    //   ParseTilesets can read tile properties without fetching external files.
    const seenNames = new Map();
    const allTilesets = [];
    let nextFirstgid = 1;

    const tsNameFromSource = (source) => source.split('/').pop().replace('.json', '');

    maps.forEach(entry => {
      const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
      if (!mapData) return;
      const localTilesets = mapData.tilesets ?? [];
      localTilesets.forEach(ts => {
        const tsName = tsNameFromSource(ts.source);
        if (seenNames.has(tsName)) return;
        seenNames.set(tsName, nextFirstgid);
        const tsData = TILESET_BY_NAME[tsName] ?? {};
        allTilesets.push({ ...tsData, firstgid: nextFirstgid });
        nextFirstgid += tsData.tilecount ?? 8192;
      });
    });

    // Highest valid GID in the merged world — any remapped GID above this means
    // the source layer references a tileset that isn't in the merged world (e.g.
    // route21/22 water/collision layers that still carry gen3_outside GIDs while
    // only kanto is declared).  Those tiles are clamped to 0 (empty).
    const maxMergedGid = allTilesets.reduce(
      (max, ts) => Math.max(max, ts.firstgid + (ts.tilecount ?? 0) - 1), 0
    );

    // Returns a GID remapper for a specific source map.
    const makeGidRemap = (mapData) => {
      const localTs = mapData.tilesets ?? [];
      if (localTs.length === 0) return gid => gid;
      return (gid) => {
        if (gid === 0) return 0;
        let ownerTs = localTs[0];
        for (const ts of localTs) {
          if (ts.firstgid <= gid) ownerTs = ts;
          else break;
        }
        const localOffset = gid - ownerTs.firstgid;
        const worldGid = (seenNames.get(tsNameFromSource(ownerTs.source)) ?? ownerTs.firstgid) + localOffset;
        // Clamp GIDs that exceed the merged tileset range to 0 (empty tile).
        return worldGid <= maxMergedGid ? worldGid : 0;
      };
    };

    // ── Identify charLayer sources (ge_charLayer property per source layer) ──
    // charLayerSources: { "ground": [{entry, layerName}], "top": [...] }
    const charLayerSources = {};
    maps.forEach(entry => {
      const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
      if (!mapData) return;
      mapData.layers.forEach(l => {
        if (l.type !== 'tilelayer') return;
        const clProp = (l.properties ?? []).find(p => p.name === 'ge_charLayer');
        if (!clProp) return;
        const val = clProp.value;
        if (!charLayerSources[val]) charLayerSources[val] = [];
        charLayerSources[val].push({ entry, layerName: l.name });
      });
    });

    // ── Collect all unique visual tile-layer names ───────────────────────────
    // Layers with ge_charLayer:"top" must be collected last so they render on
    // top of all other layers (tree canopies, building roofs, etc.) regardless
    // of which map introduces them first.
    const topCharLayerNames = new Set(
      (charLayerSources['top'] ?? []).map(s => s.layerName)
    );
    const visualLayerNames = [];
    const topLayerNames = [];
    const seenLayerNames = new Set();
    maps.forEach(entry => {
      const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
      if (!mapData) return;
      mapData.layers.forEach(l => {
        if (l.type !== 'tilelayer') return;
        if (seenLayerNames.has(l.name)) return;
        seenLayerNames.add(l.name);
        if (topCharLayerNames.has(l.name)) {
          topLayerNames.push(l.name);
        } else {
          visualLayerNames.push(l.name);
        }
      });
    });
    visualLayerNames.push(...topLayerNames);

    // Helper: fill a worldW×worldH flat data array from a set of source layers.
    // GIDs are remapped from each source map's local tileset space to the merged
    // world's tileset space so all layers share consistent GID addressing.
    const buildDataArray = (sources) => {
      const data = new Array(worldW * worldH).fill(0);
      sources.forEach(({ entry, layerName }) => {
        const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
        if (!mapData) return;
        const subLayer = mapData.layers.find(l => l.name === layerName && l.type === 'tilelayer');
        if (!subLayer?.data) return;
        const remapGid = makeGidRemap(mapData);
        const tileOffX = (entry.x - minX) / Tile.WIDTH;
        const tileOffY = (entry.y - minY) / Tile.HEIGHT;
        for (let row = 0; row < mapData.height; row++) {
          for (let col = 0; col < mapData.width; col++) {
            const tile = subLayer.data[row * mapData.width + col];
            if (tile !== 0) {
              data[(tileOffY + row) * worldW + (tileOffX + col)] = remapGid(tile);
            }
          }
        }
      });
      return data;
    };

    // ── Build visual layers ──────────────────────────────────────────────────
    // Each source map may name its ge_charLayer differently (PalletTown → "ground",
    // Route1 → "collision", Viridian → "middle"). We pick ONE canonical layer name
    // per charLayer value and mark only that layer with ge_charLayer.
    //
    // GridEngine checks ge_collide on ALL tile layers (not just the charLayer), so
    // the visual "collision" layer from Route1 already provides correct blocking — we
    // do NOT overlay its tiles into "ground". Doing so would overwrite ground tiles
    // with semi-transparent collision tiles causing transparency artefacts.
    const charLayerCanonical = {}; // { "ground": "ground", "top": "top" }
    Object.entries(charLayerSources).forEach(([val, srcs]) => {
      const exact = srcs.find(s => s.layerName === val);
      charLayerCanonical[val] = exact ? val : srcs[0].layerName;
    });

    const mergedLayers = visualLayerNames.map(layerName => {
      const sources = maps
        .filter(entry => {
          const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
          return mapData?.layers.some(l => l.name === layerName && l.type === 'tilelayer');
        })
        .map(entry => ({ entry, layerName }));

      const data = buildDataArray(sources);

      // Tag only the canonical layer for each charLayer value.
      const charLayerValueForThisName = Object.entries(charLayerCanonical)
        .find(([, canonName]) => canonName === layerName)?.[0];

      const properties = charLayerValueForThisName
        ? [{ name: 'ge_charLayer', type: 'string', value: charLayerValueForThisName }]
        : [];

      return {
        data, width: worldW, height: worldH,
        name: layerName, type: 'tilelayer',
        visible: true, opacity: 1, x: 0, y: 0,
        ...(properties.length ? { properties } : {}),
      };
    });

    // ── Merge interaction objects ────────────────────────────────────────────
    const allObjects = [];
    let playerSpawnKept = false;

    maps.forEach(entry => {
      const mapData = MAP_REGISTRY[WORLD_MAP_KEYS[entry.fileName]];
      if (!mapData) return;

      const pixOffX = entry.x - minX;
      const pixOffY = entry.y - minY;

      const interLayer = mapData.layers.find(
        l => l.name === 'interactions' && l.type === 'objectgroup'
      );
      if (!interLayer) return;

      interLayer.objects.forEach(obj => {
        // Keep only one playerSpawn.
        if (obj.type === 'playerSpawn') {
          if (playerSpawnKept) return;
          playerSpawnKept = true;
        }

        // Drop inter-world warps — those areas are now seamless.
        if (obj.type === 'warp') {
          const warpProp = (obj.properties ?? []).find(p => p.name === 'warp');
          if (warpProp && WORLD_SCENE_KEYS.has(warpProp.value)) return;
        }

        allObjects.push({
          ...obj,
          x: obj.x + pixOffX,
          y: obj.y + pixOffY,
        });
      });
    });

    mergedLayers.push({
      name: 'interactions', type: 'objectgroup',
      objects: allObjects, visible: true, opacity: 1, x: 0, y: 0,
    });

    // ── Merge the `maps` objectgroup from kanto.json ─────────────────────────
    // Each location carries a map-settings property (encounter-table, bgm, …)
    // that the encounter plugin reads to build per-zone encounter tables.
    // Translate coordinates from kanto.json space to merged-world space.
    const kantoMapsLayer = KantoMap.layers.find(
      l => l.name === 'maps' && l.type === 'objectgroup'
    );
    if (kantoMapsLayer) {
      const mapObjects = kantoMapsLayer.objects.map(obj => ({
        ...obj,
        x: obj.x - KANTO_OFFSET_X - minX,
        y: obj.y - KANTO_OFFSET_Y - minY,
      }));
      mergedLayers.push({
        name: 'maps', type: 'objectgroup',
        objects: mapObjects, visible: false, opacity: 1, x: 0, y: 0,
      });
    }

    return {
      width: worldW,
      height: worldH,
      tilewidth: Tile.WIDTH,
      tileheight: Tile.HEIGHT,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      type: 'map',
      version: '1.10',
      tilesets: allTilesets,
      layers: mergedLayers,
    };
  }
}
