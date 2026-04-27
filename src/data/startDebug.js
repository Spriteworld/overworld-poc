/**
 * Debug-flag overrides supplied by the test harness when launching a scenario.
 * Deep-merged into game.config.debug in Preload after loadGame, so a scenario
 * can flip a debug visual on (e.g. `tests.timeOverlay = true`) without
 * permanently changing src/data/debug.js.
 */
let _debug = null;

export function getStartDebug() { return _debug; }
export function setStartDebug(debug) { _debug = debug ? deepClone(debug) : null; }
export function clearStartDebug() { _debug = null; }

function deepClone(o) {
  if (o === null || typeof o !== 'object') return o;
  const out = Array.isArray(o) ? [] : {};
  for (const k in o) out[k] = deepClone(o[k]);
  return out;
}
