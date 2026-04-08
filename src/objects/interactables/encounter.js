import { Tile } from '@Objects';
import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves, Items } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue } from '@Utilities';
import store from '../../store/index.js';

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

export default class {
  constructor(scene) {
    this.scene = scene;
    this.encounterTiles = [];
    this._movePool = null;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
    }

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
        obj.polygon.forEach(point => {
          this.encounterTiles.push({
            x: (obj.x + point.x) / Tile.WIDTH,
            y: (obj.y + point.y) / Tile.HEIGHT,
            tableId,
          });
        });
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
      if (Math.random() > ENCOUNTER_RATE) { return; }

      this.scene.game.events.emit('battle-start', this._buildWildBattle(tile.tableId));
    });
  }

  destroy() {
    this._sub?.unsubscribe();
  }

  _buildWildBattle(tableId = null) {
    if (!this._movePool) {
      this._movePool = buildMovePool();
    }

    const dex     = new Pokedex(GAMES.POKEMON_FIRE_RED);
    const allSpec = Object.values(dex.pokedex);
    const tables  = tableId ? this.scene.encounterTable() : null;
    const entries = tables?.[tableId];
    let entry, levelMin, levelMax;
    if (entries?.length > 0) {
      const picked  = pickWeighted(entries);
      const name    = picked.pokemon.toLowerCase();
      entry         = allSpec.find(p => p.species?.toLowerCase() === name);
      if (entry == null) {
        console.warn(`Encounter::buildWildBattle::noEntryFound for '${name}'`);
        entry = pick(allSpec.filter(p => p.nat_dex_id <= 151));
      }
      [levelMin, levelMax] = picked.level;
    } else {
      entry    = pick(allSpec.filter(p => p.nat_dex_id <= 151));
      levelMin = WILD_LEVEL_MIN;
      levelMax = WILD_LEVEL_MAX;
    }

    // Mark the wild Pokémon as seen in the Pokédex
    store.commit('pokedex/SEE', entry.nat_dex_id);
    const level = levelMin + Math.floor(Math.random() * (levelMax - levelMin + 1));
    // const pid = 
    const moves = pickUnique(this._movePool, 4).map(m => ({
      name: m.name,
      pp: { max: m.pp, current: m.pp },
    }));
    const ivs = Object.fromEntries(STAT_KEYS.map(s => [s, 31]));
    const evs = Object.fromEntries(STAT_KEYS.map(s => [s, 0]));

    return {
      tilesetBaseUrl: '/',
      field: { weather: null, terrain: 'normal' },
      player: {
        name: 'Red',
        team: gameState.party.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
          ivs: { ...p.ivs },
          evs: { ...p.evs },
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
        }],
      },
    };
  }
}
