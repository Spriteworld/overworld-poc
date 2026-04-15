/**
 * Global Gen 3-compatible LCG PRNG singleton.
 *
 * Initialise once (via initRng) from the saved game seed after loadGame() or
 * after clearSave() / RESET.  All game-meaningful randomness should go through
 * rng() rather than Math.random() so that a given seed produces a reproducible
 * playthrough.
 *
 * LCG parameters match the Pokémon Gen 3 RNG:
 *   s = (1664525 * s + 1013904223) mod 2^32
 */

let _s = (Math.random() * 0x100000000) >>> 0; // safe fallback before initRng is called

/**
 * Seed (or re-seed) the global RNG.
 * Call this immediately after loadGame() restores store.state.game.seed
 * and again whenever a new seed is generated (new game / RESET).
 * @param {number} seed - 32-bit unsigned integer seed from the game store.
 */
export function initRng(seed) {
  _s = seed >>> 0;
}

/**
 * Advance the LCG one step and return a value in [0, 1).
 * Drop-in replacement for Math.random() in game logic.
 * @returns {number}
 */
export function rng() {
  _s = (Math.imul(1664525, _s) + 1013904223) >>> 0;
  return _s / 0x100000000;
}
