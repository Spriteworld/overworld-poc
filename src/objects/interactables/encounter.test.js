// Mock @spriteworld/pokemon-data before any imports that depend on it
jest.mock('@spriteworld/pokemon-data', () => {
  const STATS = {
    HP: 'hp', ATTACK: 'attack', DEFENSE: 'defense',
    SPECIAL_ATTACK: 'special_attack', SPECIAL_DEFENSE: 'special_defense', SPEED: 'speed',
  };
  return {
    GAMES:   { POKEMON_FIRE_RED: 'firered' },
    NATURES: { HARDY: { name: 'hardy' } },
    GENDERS: { MALE: 'male', FEMALE: 'female' },
    STATS,
    Pokedex: class {
      constructor() {
        this.pokedex = {
          1: { nat_dex_id: 1 },
          4: { nat_dex_id: 4 },
          7: { nat_dex_id: 7 },
        };
      }
    },
    Moves: {
      getMovesByGameId: () => [
        { name: 'tackle',    pp: 35, power: 40,   category: 'PHYSICAL' },
        { name: 'growl',     pp: 40, power: null,  category: 'STATUS'   },
        { name: 'vine whip', pp: 10, power: 45,   category: 'PHYSICAL' },
        { name: 'synthesis', pp: 5,  power: null,  category: 'STATUS'   },
      ],
      MOVE_CATEGORIES: { STATUS: 'STATUS' },
    },
  };
});

import Encounter from './encounter.js';
import { defaultParty } from '@Data/party.js';

// ─── Deep-clone guard ─────────────────────────────────────────────────────────

describe('encounter _buildWildBattle party isolation', () => {
  function makeEncounter() {
    return new Encounter({ game: { config: { debug: { console: { interactableShout: false } } } } });
  }

  test('returned player.team is a different array from defaultParty', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.player.team).not.toBe(defaultParty);
  });

  test('returned pokemon config objects are copies, not the originals', () => {
    const battle = makeEncounter()._buildWildBattle();
    expect(battle.player.team[0]).not.toBe(defaultParty[0]);
  });

  test('returned pp objects are copies — mutating them does not affect defaultParty', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalCurrent = defaultParty[0].moves[0].pp.current;

    battle.player.team[0].moves[0].pp.current = 0;

    expect(defaultParty[0].moves[0].pp.current).toBe(originalCurrent);
  });

  test('returned ivs are copies — mutating them does not affect defaultParty', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalHP = defaultParty[0].ivs.hp;

    battle.player.team[0].ivs.hp = 0;

    expect(defaultParty[0].ivs.hp).toBe(originalHP);
  });

  test('returned evs are copies — mutating them does not affect defaultParty', () => {
    const battle = makeEncounter()._buildWildBattle();
    const originalHP = defaultParty[0].evs.hp;

    battle.player.team[0].evs.hp = 99;

    expect(defaultParty[0].evs.hp).toBe(originalHP);
  });

  test('multiple battles each get independent copies', () => {
    const enc = makeEncounter();
    const battle1 = enc._buildWildBattle();
    const battle2 = enc._buildWildBattle();

    battle1.player.team[0].moves[0].pp.current = 0;

    expect(battle2.player.team[0].moves[0].pp.current).toBe(
      defaultParty[0].moves[0].pp.current
    );
  });
});
