import { Tile } from '@Objects';
import { Pokedex, Items, buildMon } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue } from '@Utilities';
import { getGameDef, filterByAvailablePokemon, seededRng } from '@Data/gameDef.js';
import store from '../../store/index.js';
import { rng } from '@Utilities/rng.js';

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

/**
 * Maps normalised ball names to their battle item constructors.
 * Normalisation: lowercase, remove spaces/hyphens/underscores, replace accented e.
 */
const BALL_REGISTRY = {
  'pokeball':   Items.Pokeball,
  'greatball':  Items.GreatBall,
  'ultraball':  Items.UltraBall,
  'masterball': Items.MasterBall,
};

function normalizeBallName(name) {
  return name.toLowerCase().replace(/[-_\s]/g, '').replace(/[éèê]/g, 'e');
}

export function buildBattleInventory() {
  const { items, pokeballs } = store.state.bag;

  const battleItems = items
    .filter(e => ITEM_REGISTRY[e.name] && e.quantity > 0)
    .map(e => ({ item: new ITEM_REGISTRY[e.name](), quantity: e.quantity }));

  const battleBalls = pokeballs
    .filter(e => e.quantity > 0)
    .map(e => {
      const Cls = BALL_REGISTRY[normalizeBallName(e.name)];
      return Cls ? { item: new Cls(), quantity: e.quantity } : null;
    })
    .filter(Boolean);

  return {
    items: [...battleItems, ...battleBalls],
    pokeballs: [],
    tms: [],
  };
}

const ENCOUNTER_RATE = 0.1; // 10% chance per tile step
const WILD_LEVEL_MIN = 3;
const WILD_LEVEL_MAX = 8;

function pickWeighted(entries) {
  const total = entries.reduce((sum, e) => sum + e.rarity, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.rarity;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
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
 *   expRateMultiplier – passed through to the battle config
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
    if (this.scene.config.tilemap.getObjectLayer('maps')) {
      const locationObjs = this.scene.config.tilemap.filterObjects(
        'maps', obj => obj.type === 'location'
      ) ?? [];
      for (const obj of locationObjs) {
        const objSettings = getPropertyValue(obj.properties ?? [], 'map-settings');
        if (objSettings?.['encounter-table']) {
          tableFragments.push(objSettings['encounter-table']);
        }
      }
    }

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
      if (rng() > this._encounterRate) { return; }

      const battleConfig = this._buildWildBattle(tile);
      if (!battleConfig) { return; }
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

    const def      = getGameDef();
    const dex      = new Pokedex(def.game);
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
      if (!entries?.length) {
        console.warn(`Encounter::buildWildBattle::noTableFound for tableId='${tableId}' — skipping encounter`);
        return null;
      }
      const picked = pickWeighted(entries);
      const name   = picked.species?.toLowerCase();
      entry        = allSpec.find(p => p.species?.toLowerCase() === name);
      if (entry == null) {
        console.warn(`Encounter::buildWildBattle::noEntryFound for '${name}' — skipping encounter`);
        return null;
      }
      levelMin = picked['level-range-min'] ?? WILD_LEVEL_MIN;
      levelMax = picked['level-range-max'] ?? levelMin;
    }

    // Mark the wild Pokémon as seen in the Pokédex.
    store.commit('pokedex/SEE', entry.nat_dex_id);

    const level = levelMin + Math.floor(rng() * (levelMax - levelMin + 1));
    const wildMon = buildMon(entry.nat_dex_id, level, {
      rng,
      game:      def.game,
      movesMode: def.learnsets,
    });

    return {
      tilesetBaseUrl:  '/',
      textSpeed:       store.state.game.textSpeed ?? 'normal',
      expRate:         def.expRateMultiplier,
      deferEvolution:  def.deferEvolution,
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
        team:      [wildMon],
      },
    };
  }
}
