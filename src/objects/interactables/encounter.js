import { Tile } from '@Objects';
import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves } from '@spriteworld/pokemon-data';
import { defaultParty } from '@Data/party.js';

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
      console.log('Interactables::encounter');
    }

    const encounterZones = this.scene.findInteractions('encounters');
    if (encounterZones.length === 0) { return; }

    encounterZones.forEach(obj => {
      if (typeof obj.polygon === 'undefined') {
        const width  = parseInt(obj.width  / Tile.WIDTH);
        const height = parseInt(obj.height / Tile.HEIGHT);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            this.encounterTiles.push({
              x: (obj.x / Tile.WIDTH) + x,
              y: (obj.y / Tile.HEIGHT) + y,
            });
          }
        }
      } else {
        obj.polygon.forEach(point => {
          this.encounterTiles.push({
            x: (obj.x + point.x) / Tile.WIDTH,
            y: (obj.y + point.y) / Tile.HEIGHT,
          });
        });
      }
    });

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::encounter::tiles', this.encounterTiles.length);
    }
  }

  update() {}

  event() {
    if (this.encounterTiles.length === 0) { return; }

    this.scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') { return; }

      const onEncounterTile = this.encounterTiles.some(
        t => t.x === enterTile.x && t.y === enterTile.y
      );
      if (!onEncounterTile) { return; }
      if (Math.random() > ENCOUNTER_RATE) { return; }

      this.scene.game.events.emit('battle-start', this._buildWildBattle());
    });
  }

  _buildWildBattle() {
    if (!this._movePool) {
      this._movePool = buildMovePool();
    }

    const dex        = new Pokedex(GAMES.POKEMON_FIRE_RED);
    const allSpecies = Object.values(dex.pokedex).filter(p => p.nat_dex_id <= 151);
    const entry      = pick(allSpecies);
    const level      = WILD_LEVEL_MIN + Math.floor(Math.random() * (WILD_LEVEL_MAX - WILD_LEVEL_MIN + 1));
    const moves      = pickUnique(this._movePool, 4).map(m => ({
      name: m.name,
      pp: { max: m.pp, current: m.pp },
    }));
    const ivs = Object.fromEntries(STAT_KEYS.map(s => [s, 31]));
    const evs = Object.fromEntries(STAT_KEYS.map(s => [s, 0]));

    return {
      field: { weather: null, terrain: 'normal' },
      player: {
        name: 'Red',
        team: defaultParty,
        inventory: { items: [], pokeballs: [], tms: [] },
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
