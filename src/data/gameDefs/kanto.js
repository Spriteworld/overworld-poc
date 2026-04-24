import { GAMES } from '@spriteworld/pokemon-data';

/**
 * Default Kanto game definition — standard Gen 1 experience.
 */
export default {
  id:               'kanto',
  name:             'Kanto Classic',

  /**
   * Pokémon-data game identifier. Drives movedex, pokedex, and move pool
   * selection throughout the game. Must be one of the `GAMES` constants
   * exported by `@spriteworld/pokemon-data`.
   */
  game:             GAMES.POKEMON_FIRE_RED,

  /** Overworld scene key launched when no saved game is present. */
  overworldScene:   'KantoWorld',

  /**
   * Wild encounter species pool.
   *   'gen_1'    → nat_dex_id 1–151
   *   'gen_2'    → nat_dex_id 152–251
   *   'gen_3'    → nat_dex_id 252–386
   *   [min, max] → inclusive id range
   *   number[]   → explicit nat_dex_id list
   */
  availablePokemon: 'gen_1',

  /** Experience rate multiplier (1.0 = normal, 2.0 = double, 0.5 = half). */
  expRateMultiplier: 1.0,

  /**
   * Controls when the evolution of a pokemon is triggered during battle.
   *   'true'  — evolution is deferred until the end of the battle, 
   *            allowing the pokemon to continue fighting until the battle concludes.
   *   'false' — evolution occurs immediately when the pokemon reaches the required level, 
   *            interrupting combat to play the evolution sequence.
   */
  deferEvolution:   true,

  /**
   * Game mode.
   *   'vanilla'        — standard rules
   *   'nuzlocke'       — only the first Pokémon caught per zone may be kept;
   *                      Pokéball throws in already-caught zones are blocked
   */
  gameMode:         'vanilla',

  /**
   * Move learnset source for wild Pokémon and trainer Pokémon with no explicit moves.
   *   'vanilla' — FRLG level-up learnset (most recently learned, up to 4)
   *   'random'  — 4 random moves from the full FRLG move pool
   */
  learnsets:        'vanilla',

  /**
   * Encounter table source.
   *   'vanilla' — use the map's encounter-table from Tiled map-settings property
   *   'random'  — seeded-random table generated from availablePokemon pool
   */
  encounterTables:  'vanilla',

  /**
   * Whether visible overworld Pokémon encounters are enabled globally.
   * Individual maps can still opt out via map-settings['ow-encounters'] = false.
   */
  owEncounters:     true,

  /**
   * Starter Pokémon offered to the player (e.g. in Oak's lab).
   * Each entry is a nat_dex_id. Index 1/2/3 maps to pokeball1/2/3.
   * Use the `give_starter` script command with `index` 1, 2, or 3 to award the
   * corresponding Pokémon.
   */
  starterMon:       [1, 7, 4],

  /**
   * Multiplier applied to trainer prize money. Final payout is
   * `highestTeamLevel × 50 × prizeMoneyMultiplier`. 1.0 = standard Gen 1 rate.
   */
  prizeMoneyMultiplier: 1.0,

  /**
   * Entrance randomizer.
   *   'vanilla' — warps go to their authored destinations
   *   'random'  — warp destinations are shuffled (seeded by save seed)
   */
  entranceRandomizer: 'vanilla',

  /**
   * When true, teaching a TM does not consume it (Gen 5+ reusable TMs).
   * When false, TMs are single-use and removed from the bag after teaching.
   */
  infiniteTMs: false,

  /**
   * When true, catching a wild Pokémon awards exp to the active battler
   * (Gen 6+ behavior). When false, captures give no exp (Gen 1–5 behavior).
   */
  catchingGivesExp: false,

  /**
   * When true, every newly generated Pokémon (wild, trainer, starter, gift)
   * is rolled with 31 in all six IV slots. Does not retroactively update
   * Pokémon already in the save — only affects freshly built ones.
   */
  maxIvs: false,
};
