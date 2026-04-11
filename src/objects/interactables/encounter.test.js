// Mock @spriteworld/pokemon-data before any imports that depend on it
jest.mock('@spriteworld/pokemon-data', () => {
  const STATS = {
    HP: 'hp', ATTACK: 'attack', DEFENSE: 'defense',
    SPECIAL_ATTACK: 'special_attack', SPECIAL_DEFENSE: 'special_defense', SPEED: 'speed',
  };
  return {
    GAMES:   { POKEMON_FIRE_RED: 'firered' },
    NATURES: {
      HARDY:   { name: 'hardy'   },
      ADAMANT: { name: 'adamant' },
    },
    GENDERS: { MALE: 'male', FEMALE: 'female' },
    STATS,
    /**
     * FRLG learnsets used by buildMovesFromLearnset.
     * Keys are uppercase species names.
     * Bulbasaur: 4 moves across levels 1–13 (tests full learnset path).
     * Charmander: 2 early moves (tests fewer than 4 learnable moves).
     * Squirtle is absent — triggers the fallback-to-random-pool path.
     */
    FRLG_LEARNSETS: {
      BULBASAUR: [
        [1,  'tackle'   ],
        [3,  'growl'    ],
        [7,  'vine whip'],
        [13, 'synthesis'],
      ],
      CHARMANDER: [
        [1, 'scratch'],
        [4, 'growl'  ],
      ],
    },
    Pokedex: class {
      constructor() {
        this.pokedex = {
          1: { nat_dex_id: 1, species: 'Bulbasaur'  },
          4: { nat_dex_id: 4, species: 'Charmander' },
          7: { nat_dex_id: 7, species: 'Squirtle'   },
        };
      }
    },
    Moves: {
      getMovesByGameId: () => [
        { name: 'tackle',    pp: 35, power: 40,   category: 'PHYSICAL' },
        { name: 'growl',     pp: 40, power: null,  category: 'STATUS'   },
        { name: 'vine whip', pp: 10, power: 45,   category: 'PHYSICAL' },
        { name: 'synthesis', pp: 5,  power: null,  category: 'STATUS'   },
        { name: 'scratch',   pp: 35, power: 40,   category: 'PHYSICAL' },
      ],
      MOVE_CATEGORIES: { STATUS: 'STATUS' },
    },
    // Items stubs — only need to be non-undefined so the module-level ITEM_REGISTRY
    // objects in encounter.js and trainer.js can be evaluated without throwing.
    Items: {
      Potion:      class {},
      SuperPotion: class {},
      HyperPotion: class {},
      MaxPotion:   class {},
      FullRestore: class {},
      Ether:       class {},
      Revive:      class {},
    },
  };
});

import Encounter from './encounter.js';
import store from '../../store/index.js';

// ─── Test party fixture (used in place of a real defaultParty) ────────────────

const TEST_PARTY = [
  {
    game: 'firered', pid: 1, species: 1, level: 15,
    nature: 'hardy', gender: 'male',
    ability: { name: 'Overgrow' },
    moves: [{ name: 'tackle', pp: { max: 35, current: 35 } }],
    ivs:  { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
    evs:  { hp: 0,  attack: 0,  defense: 0,  special_attack: 0,  special_defense: 0,  speed: 0  },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEncounter() {
  return new Encounter({ game: { config: { debug: { console: { interactableShout: false } } } } });
}

/**
 * Creates an Encounter with a pre-parsed encounter table injected directly,
 * bypassing init() — entries use the Tiled encounter-pokemon shape:
 *   { species, rarity, 'level-range-min', 'level-range-max' }
 * @param {object} tables - Map of tableId → encounter entry array.
 */
function makeEncounterWithTable(tables) {
  const enc = new Encounter({ game: { config: { debug: { console: { interactableShout: false } } } } });
  enc._encounterTable = tables;
  return enc;
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Encounter rate from map properties ──────────────────────────────────────

function makeInitScene(properties = [], locationObjects = []) {
  return {
    game: { config: { debug: { console: { interactableShout: false } } } },
    findInteractions: jest.fn(() => []),
    config: {
      tilemap: {
        properties,
        filterObjects: jest.fn((layer, fn) =>
          layer === 'maps' ? locationObjects.filter(fn) : []
        ),
      },
    },
  };
}

describe('encounter table from maps-layer location objects', () => {
  test('merges encounter tables from location objects into _encounterTable', () => {
    const locationObjects = [
      {
        type: 'location',
        name: 'Route1',
        properties: [{
          name: 'map-settings', type: 'class',
          value: {
            'encounter-table': {
              ROUTE_1: [
                { propertytype: 'encounter-pokemon', type: 'class',
                  value: { species: 'pidgey', rarity: 50, 'level-range-min': 2, 'level-range-max': 5 } },
              ],
            },
          },
        }],
      },
      {
        type: 'location',
        name: 'Route2',
        properties: [{
          name: 'map-settings', type: 'class',
          value: {
            'encounter-table': {
              ROUTE_2: [
                { propertytype: 'encounter-pokemon', type: 'class',
                  value: { species: 'rattata', rarity: 50, 'level-range-min': 3, 'level-range-max': 5 } },
              ],
            },
          },
        }],
      },
    ];
    const enc = new Encounter(makeInitScene([], locationObjects));
    enc.init();
    expect(enc._encounterTable).toHaveProperty('ROUTE_1');
    expect(enc._encounterTable).toHaveProperty('ROUTE_2');
    expect(enc._encounterTable.ROUTE_1[0].species).toBe('pidgey');
    expect(enc._encounterTable.ROUTE_2[0].species).toBe('rattata');
  });

  test('top-level encounter-table and location-object tables are merged', () => {
    const enc = new Encounter(makeInitScene(
      [{ name: 'map-settings', type: 'class', value: {
        'encounter-table': {
          ZONE_A: [{ propertytype: 'encounter-pokemon', type: 'class',
            value: { species: 'bulbasaur', rarity: 10, 'level-range-min': 5, 'level-range-max': 5 } }],
        },
      }}],
      [{
        type: 'location', name: 'Area',
        properties: [{ name: 'map-settings', type: 'class', value: {
          'encounter-table': {
            ZONE_B: [{ propertytype: 'encounter-pokemon', type: 'class',
              value: { species: 'charmander', rarity: 10, 'level-range-min': 5, 'level-range-max': 5 } }],
          },
        }}],
      }],
    ));
    enc.init();
    expect(enc._encounterTable).toHaveProperty('ZONE_A');
    expect(enc._encounterTable).toHaveProperty('ZONE_B');
  });
});

describe('encounter rate from map properties', () => {
  test('defaults to 10% when no encounter-rate map property is set', () => {
    const enc = new Encounter(makeInitScene());
    enc.init();
    expect(enc._encounterRate).toBe(0.1);
  });

  test('uses encounter-rate map property when set (25 → 0.25)', () => {
    const enc = new Encounter(makeInitScene([
      { name: 'encounter-rate', type: 'int', value: 25 },
    ]));
    enc.init();
    expect(enc._encounterRate).toBe(0.25);
  });

  test('reads encounter-rate from map-settings when present', () => {
    const enc = new Encounter(makeInitScene([
      { name: 'map-settings', type: 'class', value: { 'encounter-rate': 15 } },
    ]));
    enc.init();
    expect(enc._encounterRate).toBe(0.15);
  });
});

// ─── Deep-clone guard ─────────────────────────────────────────────────────────

describe('encounter _buildWildBattle party isolation', () => {
  beforeEach(() => {
    store.state.party.list = TEST_PARTY.map(p => ({
      ...p,
      moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
      ivs: { ...p.ivs },
      evs: { ...p.evs },
    }));
  });

  test('returned player.team is a different array from the store party', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.player.team).not.toBe(store.state.party.list);
  });

  test('returned pokemon config objects are copies, not the originals', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.player.team[0]).not.toBe(store.state.party.list[0]);
  });

  test('returned pp objects are copies — mutating them does not affect the store party', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalCurrent = store.state.party.list[0].moves[0].pp.current;

    battle.player.team[0].moves[0].pp.current = 0;

    expect(store.state.party.list[0].moves[0].pp.current).toBe(originalCurrent);
  });

  test('returned ivs are copies — mutating them does not affect the store party', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalHP = store.state.party.list[0].ivs.hp;

    battle.player.team[0].ivs.hp = 0;

    expect(store.state.party.list[0].ivs.hp).toBe(originalHP);
  });

  test('returned evs are copies — mutating them does not affect the store party', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalHP = store.state.party.list[0].evs.hp;

    battle.player.team[0].evs.hp = 99;

    expect(store.state.party.list[0].evs.hp).toBe(originalHP);
  });

  test('multiple battles each get independent copies', () => {
    const enc = makeEncounter();
    const battle1 = enc._buildWildBattle();
    const battle2 = enc._buildWildBattle();

    battle1.player.team[0].moves[0].pp.current = 0;

    expect(battle2.player.team[0].moves[0].pp.current).toBe(
      store.state.party.list[0].moves[0].pp.current
    );
  });
});

// ─── Wild Pokémon shiny / Pokérus ─────────────────────────────────────────────

describe('_buildWildBattle wild pokemon fields — isShiny and pokerus', () => {
  test('enemy pokemon has isShiny field of type boolean', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(typeof battle.enemy.team[0].isShiny).toBe('boolean');
  });

  test('isShiny is true when Math.random returns below the 1/8192 threshold', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.enemy.team[0].isShiny).toBe(true);
  });

  test('isShiny is false when Math.random returns above the 1/8192 threshold', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.enemy.team[0].isShiny).toBe(false);
  });

  test('enemy pokemon has pokerus field of type boolean', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(typeof battle.enemy.team[0].pokerus).toBe('boolean');
  });

  test('pokerus is true when Math.random returns below the 3/65536 threshold', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.enemy.team[0].pokerus).toBe(true);
  });

  test('pokerus is false when Math.random returns above the 3/65536 threshold', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.enemy.team[0].pokerus).toBe(false);
  });
});

// ─── Battle config fields ─────────────────────────────────────────────────────

describe('_buildWildBattle battle config', () => {
  test('textSpeed is present in the returned config', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.textSpeed).toBeDefined();
  });

  test('textSpeed matches the store default of "normal"', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.textSpeed).toBe('normal');
  });
});

// ─── Encounter table level ranges ─────────────────────────────────────────────

describe('encounter table level ranges', () => {
  test('equal min/max always produces exactly that level', () => {
    const enc = makeEncounterWithTable({
      zone: [{ species: 'bulbasaur', rarity: 1, 'level-range-min': 5, 'level-range-max': 5 }],
    });
    for (let i = 0; i < 20; i++) {
      expect(enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].level).toBe(5);
    }
  });

  test('min/max range produces a level within [min, max]', () => {
    const enc = makeEncounterWithTable({
      zone: [{ species: 'bulbasaur', rarity: 1, 'level-range-min': 3, 'level-range-max': 8 }],
    });
    for (let i = 0; i < 30; i++) {
      const level = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].level;
      expect(level).toBeGreaterThanOrEqual(3);
      expect(level).toBeLessThanOrEqual(8);
    }
  });
});

// ─── buildMovesFromLearnset ───────────────────────────────────────────────────

describe('buildMovesFromLearnset', () => {
  test('includes only moves learnable at or below the pokemon level', () => {
    // Bulbasaur learnset: tackle@1, growl@3, vine whip@7, synthesis@13
    // At level 10: tackle, growl, vine whip learnable; synthesis is not yet
    const enc = makeEncounterWithTable({
      zone: [{ species: 'bulbasaur', rarity: 1, 'level-range-min': 10, 'level-range-max': 10 }],
    });
    const moves = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].moves.map(m => m.name);
    expect(moves).toContain('vine whip');
    expect(moves).not.toContain('synthesis');
  });

  test('selects the most recently learned moves when learnable count exceeds 4', () => {
    // At level 15 all 4 Bulbasaur learnset moves are available; synthesis (level 13)
    // is the most recent and must be included
    const enc = makeEncounterWithTable({
      zone: [{ species: 'bulbasaur', rarity: 1, 'level-range-min': 15, 'level-range-max': 15 }],
    });
    const moves = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].moves.map(m => m.name);
    expect(moves).toContain('synthesis');
  });

  test('correctly assigns pp values from the move pool', () => {
    // vine whip has pp: 10 in the mock pool
    const enc = makeEncounterWithTable({
      zone: [{ species: 'bulbasaur', rarity: 1, 'level-range-min': 10, 'level-range-max': 10 }],
    });
    const moves = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].moves;
    const vineWhip = moves.find(m => m.name === 'vine whip');
    expect(vineWhip).toBeDefined();
    expect(vineWhip.pp).toEqual({ max: 10, current: 10 });
  });

  test('returns fewer than 4 moves when the learnset has fewer than 4 learnable entries', () => {
    // Charmander learnset has only 2 entries; at level 5 both are learnable
    const enc = makeEncounterWithTable({
      zone: [{ species: 'charmander', rarity: 1, 'level-range-min': 5, 'level-range-max': 5 }],
    });
    const moves = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].moves;
    expect(moves.length).toBeLessThanOrEqual(2);
  });

  test('falls back to 4 random pool moves when no learnset entry exists', () => {
    // Squirtle has no FRLG_LEARNSETS entry
    const enc = makeEncounterWithTable({
      zone: [{ species: 'squirtle', rarity: 1, 'level-range-min': 10, 'level-range-max': 10 }],
    });
    const moves = enc._buildWildBattle({ tableId: 'zone' }).enemy.team[0].moves;
    expect(moves).toHaveLength(4);
    moves.forEach(m => {
      expect(m.pp).toHaveProperty('max');
      expect(m.pp).toHaveProperty('current');
    });
  });
});
