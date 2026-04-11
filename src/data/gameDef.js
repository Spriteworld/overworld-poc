import defaultDef from './gameDefs/kanto.js';

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
