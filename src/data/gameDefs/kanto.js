/**
 * Default Kanto game definition — standard Gen 1 experience.
 */
export default {
  id:               'kanto',
  name:             'Kanto Classic',

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
  expRate:          1.0,

  /**
   * Game mode.
   *   'vanilla'        — standard rules
   *   'nuzlocke'       — only the first Pokémon caught per zone may be kept;
   *                      Pokéball throws in already-caught zones are blocked
   *   'map_randomizer' — encounter tables are generated from the available pool
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
};
