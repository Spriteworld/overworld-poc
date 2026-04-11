import { Tile } from '@Objects';
import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves, Items, FRLG_LEARNSETS } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue } from '@Utilities';
import { getGameDef, filterByAvailablePokemon, seededRng } from '@Data/gameDef.js';
import store from '../../store/index.js';

/** Ray-casting point-in-polygon test (pixel space). */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** djb2 string hash → unsigned 32-bit integer. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Maps item names (as stored in the bag) to their battle item constructors.
 * Only items that have a corresponding battle class are included; unknown
 * entries are silently skipped when building the battle inventory.
 */
const ITEM_REGISTRY = {
  'Potion':        Items.Potion,
  'Super Potion':  Items.SuperPotion,
  'Hyper Potion':  Items.HyperPotion,
  'Max Potion':    Items.MaxPotion,
  'Full Restore':  Items.FullRestore,
  'Ether':         Items.Ether,
  'Revive':        Items.Revive,
};

function buildBattleInventory() {
  const { items } = store.state.bag;
  return {
    items: items
      .filter(e => ITEM_REGISTRY[e.name] && e.quantity > 0)
      .map(e => ({ item: new ITEM_REGISTRY[e.name](), quantity: e.quantity })),
    pokeballs: [],
    tms: [],
  };
}

const ENCOUNTER_RATE = 0.1; // 10% chance per tile step
const WILD_LEVEL_MIN = 3;
const WILD_LEVEL_MAX = 8;

const STAT_KEYS = [
  STATS.HP, STATS.ATTACK, STATS.DEFENSE,
  STATS.SPECIAL_ATTACK, STATS.SPECIAL_DEFENSE, STATS.SPEED,
];
const NATURE_LIST = Object.values(NATURES);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(entries) {
  const total = entries.reduce((sum, e) => sum + e.rarity, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.rarity;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

function pickUnique(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}

function buildMovePool() {
  return Moves.getMovesByGameId(GAMES.POKEMON_FIRE_RED).filter(
    m => m.pp > 0 && (m.power !== null || m.category === Moves.MOVE_CATEGORIES.STATUS)
  );
}

/**
 * Build a move list for a wild Pokémon using its FRLG level-up learnset.
 * Selects up to four moves learnable at or below `level`, preferring the
 * most recently learned ones (highest level first).  Falls back to four
 * random moves from `fallbackPool` when no learnset entry exists.
 *
 * @param {string}   speciesName  - Species name (any case, e.g. 'Pidgey').
 * @param {number}   level        - The wild Pokémon's level.
 * @param {object[]} fallbackPool - Full move pool for fallback selection.
 * @returns {{ name: string, pp: { max: number, current: number } }[]}
 */
function buildMovesFromLearnset(speciesName, level, fallbackPool) {
  const learnset = FRLG_LEARNSETS[speciesName.toUpperCase()];
  if (!learnset?.length) {
    return pickUnique(fallbackPool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }));
  }

  // All moves learnable at or below this level, most-recently-learned last.
  const learnable = learnset.filter(([lvl]) => lvl <= level);
  // Take the last 4 (the newest moves a Pokémon would have at this level).
  const selected  = learnable.slice(-4);

  // Build a name → PP lookup so we can fill in PP values.
  const ppByName = Object.fromEntries(fallbackPool.map(m => [m.name, m.pp]));

  return selected.map(([, name]) => {
    const pp = ppByName[name] ?? 5;
    return { name, pp: { max: pp, current: pp } };
  });
}

/**
 * Handles wild Pokémon encounter zones for a map scene.
 *
 * On init(), scans the scene's 'encounters' object layer and records every
 * tile that belongs to an encounter zone (rectangle or polygon), along with
 * its optional table-id property.
 *
 * On event(), subscribes to GridEngine's positionChangeStarted stream.
 * Each time the player steps onto an encounter tile, a 10 % roll is made.
 * On success, a full battle config is emitted via the 'battle-start' event.
 *
 * Encounter tables are defined as a `map-settings` Tiled map property.  The
 * `encounter-table` sub-property is an `encounterTable` class whose fields
 * (`grass`, `surf`, `good-rod`, etc.) are lists of `encounter-pokemon` entries:
 *   { species: string, rarity: int, level-range-min: int, level-range-max: int }
 *
 * Each encounter zone object carries a `table-id` property that names which
 * sub-table to use (e.g. `grass`, `surf`).
 *
 * Respects the active game definition (see src/data/gameDef.js):
 *   availablePokemon  – filters the species pool for fallbacks and random tables
 *   encounterTables   – 'vanilla' uses the map's encounter-table; 'random' generates seeded tables
 *   learnsets         – 'vanilla' uses FRLG learnset; 'random' picks 4 random moves
 *   expRate           – passed through to the battle config
 *   gameMode          – 'nuzlocke' records first-catch-per-zone flags
 */
export default class {
  constructor(scene) {
    this.scene = scene;
    this.encounterTiles = [];
    this._movePool = null;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
    }

    const mapProps    = this.scene.config?.tilemap?.properties ?? [];
    const mapSettings = getPropertyValue(mapProps, 'map-settings') ?? {};
    const ratePct     = mapSettings['encounter-rate']
      || getPropertyValue(mapProps, 'encounter-rate', ENCOUNTER_RATE * 100);
    this._encounterRate = ratePct / 100;

    // Collect encounter table fragments: top-level map-settings first, then
    // each location object in the 'maps' layer that carries its own map-settings.
    const tableFragments = [];
    if (mapSettings['encounter-table']) {
      tableFragments.push(mapSettings['encounter-table']);
    }
    try {
      const locationObjs = this.scene.config.tilemap.filterObjects(
        'maps', obj => obj.type === 'location'
      ) ?? [];
      for (const obj of locationObjs) {
        const objSettings = getPropertyValue(obj.properties ?? [], 'map-settings');
        if (objSettings?.['encounter-table']) {
          tableFragments.push(objSettings['encounter-table']);
        }
      }
    } catch { /* 'maps' layer may not exist on this map */ }

    const merged = Object.assign({}, ...tableFragments);
    this._encounterTable = this._parseEncounterTable(
      Object.keys(merged).length ? merged : null
    );

    const encounterZones = this.scene.findInteractions('encounters');
    if (encounterZones.length === 0) { return; }

    encounterZones.forEach(obj => {
      const tableId = this.scene.getPropertyFromTile(obj, 'table-id') || null;

      if (typeof obj.polygon === 'undefined') {
        const width  = parseInt(obj.width  / Tile.WIDTH);
        const height = parseInt(obj.height / Tile.HEIGHT);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            this.encounterTiles.push({
              x: (obj.x / Tile.WIDTH) + x,
              y: (obj.y / Tile.HEIGHT) + y,
              tableId,
            });
          }
        }
      } else {
        const abs = obj.polygon.map(pt => ({ x: obj.x + pt.x, y: obj.y + pt.y }));
        const minTx = Math.floor(Math.min(...abs.map(p => p.x)) / Tile.WIDTH);
        const maxTx = Math.floor(Math.max(...abs.map(p => p.x)) / Tile.WIDTH);
        const minTy = Math.floor(Math.min(...abs.map(p => p.y)) / Tile.HEIGHT);
        const maxTy = Math.floor(Math.max(...abs.map(p => p.y)) / Tile.HEIGHT);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            const cx = tx * Tile.WIDTH  + Tile.WIDTH  / 2;
            const cy = ty * Tile.HEIGHT + Tile.HEIGHT / 2;
            if (pointInPolygon(cx, cy, abs)) {
              this.encounterTiles.push({ x: tx, y: ty, tableId });
            }
          }
        }
      }
    });

    if (this.scene.game.config.debug.console.interactableShout) {
    }
  }

  update() {}

  event() {
    if (this.encounterTiles.length === 0) { return; }

    this._sub = this.scene.gridEngine.positionChangeStarted().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') { return; }

      if (this.scene.game.config.debug.noEncounters) { return; }
      const tile = this.encounterTiles.find(
        t => t.x === enterTile.x && t.y === enterTile.y
      );
      if (!tile) { return; }
      if (Math.random() > this._encounterRate) { return; }

      const battleConfig = this._buildWildBattle(tile);
      this.scene.game.events.emit('battle-start', battleConfig);

      // Nuzlocke: record the first catch in this zone.
      if (getGameDef().gameMode === 'nuzlocke' && tile.tableId) {
        this.scene.game.events.once('battle-complete', ({ result }) => {
          if (result === 'caught') {
            store.commit('game/PATCH_FLAGS', { [`nuzlocke_caught_${tile.tableId}`]: true });
          }
        });
      }
    });
  }

  destroy() {
    this._sub?.unsubscribe();
  }

  /**
   * Normalises a raw `encounterTable` class value from Tiled map-settings into
   * a keyed object of entry arrays ready for `pickWeighted`.
   * Each Tiled list entry is unwrapped from its `{ propertytype, type, value }`
   * wrapper and filtered to only those with a non-empty `species` field.
   *
   * @param {object|null} raw - The `encounter-table` value from map-settings.
   * @returns {Record<string, object[]>|null}
   */
  _parseEncounterTable(raw) {
    if (!raw || typeof raw !== 'object') { return null; }
    const result = {};
    for (const [key, list] of Object.entries(raw)) {
      if (!Array.isArray(list) || list.length === 0) { continue; }
      const entries = list
        .map(e => e.value ?? e)
        .filter(e => e.species);
      if (entries.length > 0) { result[key] = entries; }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Constructs a battle config object for a wild encounter.
   *
   * Species selection respects the game definition:
   *   - encounterTables 'random' → seeded-random pick from availablePokemon pool
   *   - encounterTables 'vanilla' → weighted pick from the map's encounter table,
   *     falling back to a random pick from the available pool when no table exists
   *
   * Learnsets respects the game definition:
   *   - learnsets 'vanilla' → FRLG level-up learnset
   *   - learnsets 'random'  → 4 random moves from the FRLG move pool
   *
   * Rolls for shiny (1 / 8192) and Pokérus (3 / 65536) independently.
   *
   * @param {{ tableId: string|null }} tile - Encounter tile object.
   * @returns {object} Battle config accepted by BattleScene2 init data.
   */
  _buildWildBattle(tile) {
    const tableId = tile?.tableId ?? null;

    if (!this._movePool) {
      this._movePool = buildMovePool();
    }

    const def      = getGameDef();
    const dex      = new Pokedex(GAMES.POKEMON_FIRE_RED);
    const allSpec  = Object.values(dex.pokedex);
    const pool     = filterByAvailablePokemon(allSpec);

    let entry, levelMin, levelMax;

    if (def.encounterTables === 'random') {
      // Seeded-random: same game seed + zone always produces the same Pokémon pool.
      const seed = ((store.state.game.seed ?? 0) + hashStr(tableId ?? '')) >>> 0;
      const rng  = seededRng(seed);
      const picks = pool.slice().sort(() => rng() - 0.5).slice(0, Math.min(5, pool.length));
      entry    = picks[Math.floor(rng() * picks.length)];
      levelMin = WILD_LEVEL_MIN;
      levelMax = WILD_LEVEL_MAX;
    } else {
      // Vanilla: use the map's encounter-table from map-settings.
      const entries = tableId ? this._encounterTable?.[tableId] : null;
      if (entries?.length > 0) {
        const picked = pickWeighted(entries);
        const name   = picked.species?.toLowerCase();
        entry        = allSpec.find(p => p.species?.toLowerCase() === name);
        if (entry == null) {
          console.warn(`Encounter::buildWildBattle::noEntryFound for '${name}'`);
          entry = pick(pool);
        }
        levelMin = picked['level-range-min'] ?? WILD_LEVEL_MIN;
        levelMax = picked['level-range-max'] ?? levelMin;
      } else {
        entry    = pick(pool);
        levelMin = WILD_LEVEL_MIN;
        levelMax = WILD_LEVEL_MAX;
      }
    }

    // Mark the wild Pokémon as seen in the Pokédex.
    store.commit('pokedex/SEE', entry.nat_dex_id);

    const level = levelMin + Math.floor(Math.random() * (levelMax - levelMin + 1));
    const moves = def.learnsets === 'random'
      ? pickUnique(this._movePool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }))
      : buildMovesFromLearnset(entry.species, level, this._movePool);

    const ivs     = Object.fromEntries(STAT_KEYS.map(s => [s, 31]));
    const evs     = Object.fromEntries(STAT_KEYS.map(s => [s, 0]));
    const isShiny = Math.random() < 1 / 8192;
    const pokerus = Math.random() < 3 / 65536;

    return {
      tilesetBaseUrl: '/',
      textSpeed:      store.state.game.textSpeed ?? 'normal',
      expRate:        def.expRate,
      nuzlocke: def.gameMode === 'nuzlocke' ? {
        zone:       tableId ?? null,
        zoneCaught: tableId
          ? !!store.state.game.gameFlags[`nuzlocke_caught_${tableId}`]
          : false,
      } : null,
      field:  { weather: null, terrain: 'normal' },
      player: {
        name: 'Red',
        team: gameState.party.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
          ivs:   { ...p.ivs },
          evs:   { ...p.evs },
        })),
        inventory: buildBattleInventory(),
      },
      enemy: {
        isTrainer: false,
        name:      'Wild',
        team: [{
          game:    GAMES.POKEMON_FIRE_RED,
          pid:     1,
          species: entry.nat_dex_id,
          level,
          nature:  pick(NATURE_LIST).name,
          gender:  pick([GENDERS.MALE, GENDERS.FEMALE]),
          ability: { name: 'none' },
          moves,
          ivs,
          evs,
          isShiny,
          pokerus,
        }],
      },
    };
  }
}
