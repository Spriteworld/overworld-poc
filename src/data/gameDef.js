import defaultDef from './gameDefs/kanto.js';

/**
 * @typedef {object} GameDef
 * @property {string}                id               - Unique identifier for this preset.
 * @property {string}                name             - Human-readable display name.
 * @property {string}                overworldScene   - Phaser scene key launched when no save is present.
 * @property {'gen_1'|'gen_2'|'gen_3'|[number,number]|number[]} availablePokemon
 *   Species pool used for wild encounters and random learnset fallbacks.
 *   String shorthands map to nat_dex_id ranges; a two-element array is an
 *   inclusive [min, max] range; an arbitrary number array is an explicit id list.
 * @property {number}                expRate          - Experience multiplier applied to all gains (1.0 = normal).
 * @property {boolean}               deferEvolution
 *   When true, level-up evolutions are held until the battle ends.
 *   When false, the evolution sequence interrupts combat immediately.
 *   Item-triggered evolutions (Rare Candy, Evolution Stones) are always deferred
 *   regardless of this setting.
 * @property {'vanilla'|'nuzlocke'|'map_randomizer'} gameMode
 *   Controls ruleset enforcement.
 *   'vanilla'        — standard rules, no restrictions.
 *   'nuzlocke'       — only the first Pokémon caught per zone may be kept;
 *                      subsequent Pokéball throws in that zone are blocked.
 *   'map_randomizer' — encounter tables are seeded-randomly generated.
 * @property {'vanilla'|'random'}    learnsets
 *   Move source for wild and trainer Pokémon with no explicit moveset.
 *   'vanilla' — most recently learnable moves from the FRLG level-up learnset.
 *   'random'  — 4 random moves from the full FRLG move pool.
 * @property {'vanilla'|'random'}    encounterTables
 *   'vanilla' — use the encounter table embedded in the Tiled map properties.
 *   'random'  — seeded-random table generated from the availablePokemon pool.
 * @property {number[]}               [starterMon]
 *   Ordered list of nat_dex_ids offered as starter Pokémon (e.g. in Oak's lab).
 *   Index 0/1/2 maps to pokeball1/2/3. Referenced via the `give_starter` script command.
 * @property {boolean}               owEncounters
 *   When true, visible overworld Pokémon are spawned on encounter-zone tiles.
 *   Individual maps can still opt out via map-settings['ow-encounters'] = false.
 */

let _active = defaultDef;

/** Generation nat_dex_id ranges (inclusive). */
export const GEN_RANGES = {
  gen_1: [1,   151],
  gen_2: [152, 251],
  gen_3: [252, 386],
};

/** Returns the currently active game definition. */
export function getGameDef() { return _active; }

/**
 * Replaces the active game definition.  Merges over the default kanto preset
 * so partial overrides are safe.
 * @param {object} def
 */
export function setGameDef(def) { _active = { ...defaultDef, ...def }; }

/**
 * Filters a full species array to only those allowed by the definition's
 * availablePokemon spec.
 *
 * @param {object[]} allSpecies - Full Pokédex entry array (objects with nat_dex_id).
 * @param {string|number[]} [spec]  - Defaults to _active.availablePokemon.
 * @returns {object[]}
 */
export function filterByAvailablePokemon(allSpecies, spec = _active.availablePokemon) {
  if (typeof spec === 'string' && GEN_RANGES[spec]) {
    const [min, max] = GEN_RANGES[spec];
    return allSpecies.filter(p => p.nat_dex_id >= min && p.nat_dex_id <= max);
  }
  if (Array.isArray(spec) && spec.length === 2 && typeof spec[0] === 'number' && typeof spec[1] === 'number') {
    const [min, max] = spec;
    return allSpecies.filter(p => p.nat_dex_id >= min && p.nat_dex_id <= max);
  }
  if (Array.isArray(spec)) {
    const ids = new Set(spec);
    return allSpecies.filter(p => ids.has(p.nat_dex_id));
  }
  return allSpecies;
}

/**
 * Lightweight seeded LCG PRNG.  The same seed always produces the same sequence.
 * @param {number} seed
 * @returns {() => number}  Values in [0, 1).
 */
export function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
