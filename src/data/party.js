import { GAMES, NATURES, GENDERS, STATS } from '@spriteworld/pokemon-data';

const STAT_KEYS = [
  STATS.HP, STATS.ATTACK, STATS.DEFENSE,
  STATS.SPECIAL_ATTACK, STATS.SPECIAL_DEFENSE, STATS.SPEED,
];
const ivMax  = Object.fromEntries(STAT_KEYS.map(s => [s, 31]));
const evZero = Object.fromEntries(STAT_KEYS.map(s => [s, 0]));

/**
 * Default player party used until persistent party management is implemented.
 * Each entry is a plain config accepted by BattlePokemon / BasePokemon.
 */
export const defaultParty = [
  {
    game:    GAMES.POKEMON_FIRE_RED,
    pid:     1,
    species: 1, // Bulbasaur
    level:   10,
    nature:  NATURES.HARDY.name,
    gender:  GENDERS.MALE,
    ability: { name: 'Overgrow' },
    moves: [
      { name: 'tackle',     pp: { max: 35, current: 35 } },
      { name: 'growl',      pp: { max: 40, current: 40 } },
      { name: 'vine whip',  pp: { max: 10, current: 10 } },
      { name: 'synthesis',  pp: { max: 15, current: 15 } },
    ],
    ivs: ivMax,
    evs: evZero,
  },
  {
    game:    GAMES.POKEMON_FIRE_RED,
    pid:     2,
    species: 4, // Charmander
    level:   8,
    nature:  NATURES.ADAMANT.name,
    gender:  GENDERS.MALE,
    ability: { name: 'Blaze' },
    moves: [
      { name: 'scratch',   pp: { max: 35, current: 35 } },
      { name: 'growl',     pp: { max: 40, current: 40 } },
      { name: 'ember',     pp: { max: 25, current: 25 } },
    ],
    ivs: ivMax,
    evs: evZero,
  },
];
