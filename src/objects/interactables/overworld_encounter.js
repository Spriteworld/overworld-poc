import { Tile } from '@Objects';
import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves, Items, FRLG_LEARNSETS } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue } from '@Utilities';
import { getGameDef, filterByAvailablePokemon, seededRng } from '@Data/gameDef.js';
import Tileset from '@Tileset';
import store from '../../store/index.js';

/** Default percentage of encounter-zone tiles that spawn a visible OW Pokémon. */
const DEFAULT_DENSITY = 3; // 3 %

/**
 * Manhattan-distance radius (in tiles) within which a pending spawn has its
 * sprite created and texture lazy-loaded.  Keeps textures from being queued
 * all at once at map load; instead each sprite is created only when the player
 * is close enough that it could become visible.
 */
const SPAWN_RADIUS = 10;

const WILD_LEVEL_MIN = 3;
const WILD_LEVEL_MAX = 8;

const STAT_KEYS = [
  STATS.HP, STATS.ATTACK, STATS.DEFENSE,
  STATS.SPECIAL_ATTACK, STATS.SPECIAL_DEFENSE, STATS.SPEED,
];
const NATURE_LIST = Object.values(NATURES);

const ITEM_REGISTRY = {
  'Potion':        Items.Potion,
  'Super Potion':  Items.SuperPotion,
  'Hyper Potion':  Items.HyperPotion,
  'Max Potion':    Items.MaxPotion,
  'Full Restore':  Items.FullRestore,
  'Ether':         Items.Ether,
  'Revive':        Items.Revive,
};

const BALL_REGISTRY = {
  'pokeball':   Items.Pokeball,
  'greatball':  Items.GreatBall,
  'ultraball':  Items.UltraBall,
  'masterball': Items.MasterBall,
};

function normalizeBallName(name) {
  return name.toLowerCase().replace(/[-_\s]/g, '').replace(/[éèê]/g, 'e');
}

function buildBattleInventory() {
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

function buildMovesFromLearnset(speciesName, level, fallbackPool) {
  const learnset = FRLG_LEARNSETS[speciesName.toUpperCase()];
  if (!learnset?.length) {
    return pickUnique(fallbackPool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }));
  }
  const learnable = learnset.filter(([lvl]) => lvl <= level);
  const selected  = learnable.slice(-4);
  const ppByName  = Object.fromEntries(fallbackPool.map(m => [m.name, m.pp]));
  return selected.map(([, name]) => {
    const pp = ppByName[name] ?? 5;
    return { name, pp: { max: pp, current: pp } };
  });
}

/** Ray-cast point-in-polygon test (pixel space). */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** djb2 hash → unsigned 32-bit integer. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Handles visible overworld Pokémon encounters.
 *
 * On init() a small random subset of the map's encounter-zone tiles is chosen
 * (controlled by `ow-encounter-rate` in map-settings, default 3 %) and their
 * battle data is **pre-generated** so the species the player sees matches what
 * they will fight.  No sprites are created yet — they are held in `_pending`.
 *
 * On event(), the plugin subscribes to GridEngine position changes.  Each time
 * the player moves, any pending spawn within SPAWN_RADIUS tiles has its sprite
 * created via `pokemon.addToScene()`, which lazy-loads the texture through
 * Phaser's runtime loader (`scene.load.spritesheet` + `scene.load.start()`).
 * This means no Pokémon textures are queued at map creation time; they are
 * only loaded when the player is close enough to see the sprite.
 *
 * When the player steps onto an active spawn tile the pre-built battle config
 * is emitted via 'battle-start'.  The Pokémon disappears after the battle
 * regardless of outcome.
 *
 * Global toggle: `getGameDef().owEncounters`.
 * Per-map toggle: `map-settings['ow-encounters'] = false` disables on that map.
 * Per-map density: `map-settings['ow-encounter-rate']` (integer %, default 3).
 *
 * Respects the same `game.config.debug.noEncounters` flag as grass encounters.
 */
export default class OverworldEncounter {
  constructor(scene) {
    this.scene     = scene;
    this._pending  = []; // [{ x, y, texture, battleConfig }]      — not yet spawned
    this._active   = []; // [{ x, y, sprite, battleConfig }]       — sprite live
    this._sub      = null; // positionChangeStarted — battle trigger
    this._spawnSub = null; // positionChangeFinished — proximity spawn
    this._movePool = null;
  }

  init() {
    // Global game-definition toggle
    if (!getGameDef().owEncounters) return;

    const mapProps    = this.scene.config?.tilemap?.properties ?? [];
    const mapSettings = getPropertyValue(mapProps, 'map-settings') ?? {};

    // Per-map opt-out
    if (mapSettings['ow-encounters'] === false) return;

    const density = (mapSettings['ow-encounter-rate'] ?? DEFAULT_DENSITY) / 100;

    // Build encounter table (mirrors encounter.js logic)
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

    const mergedTable    = Object.assign({}, ...tableFragments);
    const encounterTable = this._parseEncounterTable(
      Object.keys(mergedTable).length ? mergedTable : null
    );

    const allTiles = this._collectEncounterTiles();
    if (allTiles.length === 0) return;

    this._movePool = buildMovePool();

    for (const tile of allTiles) {
      if (Math.random() >= density) continue;

      const battleConfig = this._buildBattleConfig(tile, encounterTable);
      if (!battleConfig) continue;

      const mon = battleConfig.enemy.team[0];
      const speciesId = String(mon.species).padStart(3, '0');
      const texture   = mon.isShiny ? speciesId + 's' : speciesId;
      this._pending.push({ x: tile.x, y: tile.y, texture, battleConfig });
    }
  }

  update() {}

  event() {
    if (this._pending.length === 0 && this._active.length === 0) return;

    // Spawn anything near the player's starting position before first movement.
    const startPos = this.scene.gridEngine.getPosition('player');
    if (startPos) this._trySpawnNearby(startPos);

    // Battle trigger — positionChangeStarted fires before GE finalises the move,
    // so we only do the battle check here (no addCharacter calls).
    this._sub = this.scene.gridEngine.positionChangeStarted().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') return;
      if (this.scene.game.config.debug.noEncounters) return;

      const spawn = this._active.find(s => s.x === enterTile.x && s.y === enterTile.y);
      if (!spawn) return;

      // Rebuild inventory at trigger time so it reflects current bag contents.
      spawn.battleConfig.player.inventory = buildBattleInventory();

      this.scene.game.events.emit('battle-start', spawn.battleConfig);
      this.scene.game.events.once('battle-complete', () => this._removeSpawn(spawn));
    });

    // Proximity spawning — positionChangeFinished fires after GE completes the
    // move, so addCharacter() calls inside addToScene() are safe here.
    this._spawnSub = this.scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') return;
      this._trySpawnNearby(enterTile);
    });
  }

  destroy() {
    this._sub?.unsubscribe();
    this._spawnSub?.unsubscribe();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Create plain Phaser sprites for any pending spawn within SPAWN_RADIUS tiles
   * of `playerTile`.  Sprites are NOT registered with GridEngine or
   * `scene.characters`, which keeps them invisible to all GE-event subscribers
   * and avoids "Character unknown" errors entirely.
   * @param {{ x:number, y:number }} playerTile
   */
  _trySpawnNearby(playerTile) {
    const toSpawn = this._pending.filter(p =>
      Math.abs(p.x - playerTile.x) + Math.abs(p.y - playerTile.y) <= SPAWN_RADIUS
    );
    for (const entry of toSpawn) {
      const sprite = this._spawnVisualSprite(entry);
      if (!sprite) continue;
      this._active.push({ x: entry.x, y: entry.y, sprite, battleConfig: entry.battleConfig });
    }
    this._pending = this._pending.filter(p =>
      Math.abs(p.x - playerTile.x) + Math.abs(p.y - playerTile.y) > SPAWN_RADIUS
    );
  }

  /**
   * Create a plain `Phaser.GameObjects.Sprite` for a pending OW encounter entry.
   * The sprite is NOT a GridEngine character — no `addCharacter` call, no entry in
   * `scene.characters` — so it is completely invisible to all GE-event subscribers.
   *
   * Texture is lazy-loaded: the sprite starts with a transparent placeholder and
   * swaps to the real Pokémon sprite when the spritesheet finishes loading.
   *
   * @param {{ x:number, y:number, texture:string }} entry
   * @returns {Phaser.GameObjects.Sprite|null}
   */
  _spawnVisualSprite(entry) {
    const { texture } = entry;
    const isShiny    = texture.endsWith('s');
    const pathFactory = isShiny ? Tileset.pokemon_shiny[texture] : Tileset.pokemon[texture];
    const dimSrc     = isShiny ? Tileset.ow_pokemon_shiny_dimensions : Tileset.ow_pokemon_dimensions;
    const dims       = dimSrc.default?.[texture];

    if (!pathFactory || !dims) {
      console.warn('[OverworldEncounter] no sprite data for', texture);
      return null;
    }

    const frameW = Math.floor(dims.width  / 4);
    const frameH = Math.floor(dims.height / 4);
    const px     = entry.x * Tile.WIDTH;
    const py     = entry.y * Tile.HEIGHT;

    // Create the sprite now with an invisible placeholder so it occupies space
    // in the scene without showing the wrong texture first.
    const sprite = this.scene.add.sprite(px, py, '__DEFAULT');
    sprite.setOrigin(0, 0);
    sprite.setDepth(py + frameH); // depth-sort by sprite bottom edge
    sprite.setAlpha(0);           // hidden until real texture loads

    const applyTexture = () => {
      if (!sprite.active) return;
      if (!this.scene.anims.exists(texture + '-spin')) {
        this.scene.anims.create({
          key: texture + '-spin',
          frames: this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
          frameRate: 7,
          repeat: -1,
        });
      }
      sprite.setTexture(texture, 0);
      sprite.setAlpha(1);
    };

    if (this.scene.textures.exists(texture)) {
      applyTexture();
    } else {
      pathFactory().then(path => {
        if (!sprite.active) return;
        this.scene.load.spritesheet(texture, path, { frameWidth: frameW, frameHeight: frameH });
        this.scene.load.once('filecomplete-spritesheet-' + texture, applyTexture);
        this.scene.load.start();
      });
    }

    return sprite;
  }

  /**
   * Remove an active spawn: destroy the visual sprite and drop it from `_active`.
   * No GE cleanup needed because OW encounter sprites are never registered with GE.
   * @param {{ x:number, y:number, sprite:Phaser.GameObjects.Sprite, battleConfig:object }} spawn
   */
  _removeSpawn(spawn) {
    try { spawn.sprite?.destroy(); } catch (_) {}
    this._active = this._active.filter(s => s !== spawn);
  }

  /**
   * Expand all encounter-zone objects on this map into a flat tile list.
   * Handles both rectangle and polygon zone shapes.
   * @returns {{ x:number, y:number, tableId:string|null }[]}
   */
  _collectEncounterTiles() {
    const tiles = [];
    const zones = this.scene.findInteractions('encounters');
    for (const obj of zones) {
      const tableId = this.scene.getPropertyFromTile(obj, 'table-id') || null;
      if (typeof obj.polygon === 'undefined') {
        const w = parseInt(obj.width  / Tile.WIDTH);
        const h = parseInt(obj.height / Tile.HEIGHT);
        for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) {
            tiles.push({ x: obj.x / Tile.WIDTH + x, y: obj.y / Tile.HEIGHT + y, tableId });
          }
        }
      } else {
        const abs  = obj.polygon.map(pt => ({ x: obj.x + pt.x, y: obj.y + pt.y }));
        const minTx = Math.floor(Math.min(...abs.map(p => p.x)) / Tile.WIDTH);
        const maxTx = Math.floor(Math.max(...abs.map(p => p.x)) / Tile.WIDTH);
        const minTy = Math.floor(Math.min(...abs.map(p => p.y)) / Tile.HEIGHT);
        const maxTy = Math.floor(Math.max(...abs.map(p => p.y)) / Tile.HEIGHT);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            const cx = tx * Tile.WIDTH  + Tile.WIDTH  / 2;
            const cy = ty * Tile.HEIGHT + Tile.HEIGHT / 2;
            if (pointInPolygon(cx, cy, abs)) {
              tiles.push({ x: tx, y: ty, tableId });
            }
          }
        }
      }
    }
    return tiles;
  }

  /**
   * Normalise a raw `encounterTable` class value from map-settings.
   * @param {object|null} raw
   * @returns {Record<string, object[]>|null}
   */
  _parseEncounterTable(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const result = {};
    for (const [key, list] of Object.entries(raw)) {
      if (!Array.isArray(list) || list.length === 0) continue;
      const entries = list.map(e => e.value ?? e).filter(e => e.species);
      if (entries.length > 0) result[key] = entries;
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Pre-generate a complete wild battle config for a single tile.
   * Species, level, moves, IVs, shiny, and Pokérus are all determined here so
   * the sprite the player sees matches the Pokémon they will fight.
   *
   * @param {{ tableId:string|null }} tile
   * @param {Record<string, object[]>|null} encounterTable
   * @returns {object|null} Battle config, or null if no species could be resolved.
   */
  _buildBattleConfig(tile, encounterTable) {
    const def     = getGameDef();
    const dex     = new Pokedex(GAMES.POKEMON_FIRE_RED);
    const allSpec = Object.values(dex.pokedex);
    const pool    = filterByAvailablePokemon(allSpec);
    if (!pool.length) return null;

    let entry, levelMin, levelMax;

    if (def.encounterTables === 'random') {
      const seed = ((store.state.game.seed ?? 0) + hashStr(tile.tableId ?? '')) >>> 0;
      const rng  = seededRng(seed);
      const picks = pool.slice().sort(() => rng() - 0.5).slice(0, Math.min(5, pool.length));
      entry    = picks[Math.floor(rng() * picks.length)];
      levelMin = WILD_LEVEL_MIN;
      levelMax = WILD_LEVEL_MAX;
    } else {
      const entries = tile.tableId ? encounterTable?.[tile.tableId] : null;
      if (entries?.length > 0) {
        const picked = pickWeighted(entries);
        const name   = picked.species?.toLowerCase();
        entry        = allSpec.find(p => p.species?.toLowerCase() === name);
        if (!entry) {
          console.warn(`[OverworldEncounter] unknown species '${name}', falling back to random`);
          entry = pick(pool);
        }
        levelMin = picked['level-range-min'] ?? WILD_LEVEL_MIN;
        levelMax = picked['level-range-max'] ?? levelMin;
      } else {
        return null; // no table entry for this zone — skip OW encounter
      }
    }

    // Mark as seen in the Pokédex at spawn time.
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
      deferEvolution: def.deferEvolution,
      nuzlocke: def.gameMode === 'nuzlocke' ? {
        zone:       tile.tableId ?? null,
        zoneCaught: tile.tableId
          ? !!store.state.game.gameFlags[`nuzlocke_caught_${tile.tableId}`]
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
