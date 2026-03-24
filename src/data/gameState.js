import { defaultParty } from './party.js';
import defaultFlags from './gameFlags.js';

/**
 * Mutable runtime game state — single source of truth for party, bag, flags, and persistence.
 * Loaded from localStorage on boot (Preload.create); saved explicitly via saveGame().
 */
export const gameState = {
  playerName: 'Red',
  party: defaultParty.map(p => ({
    ...p,
    moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
    ivs: { ...p.ivs },
    evs: { ...p.evs },
  })),
  bag: { items: [], pokeballs: [], tms: [] },
  gameFlags: { ...defaultFlags },
  currentMap: 'Test',
  playtime: 0,          // accumulated seconds from saved sessions
  sessionStart: Date.now(),
};

/** Total playtime in seconds, including unsaved current session. */
export function getPlaytime() {
  return gameState.playtime + (Date.now() - gameState.sessionStart) / 1000;
}

/** Flush session time and write state to localStorage. */
export function saveGame() {
  gameState.playtime = getPlaytime();
  gameState.sessionStart = Date.now();
  localStorage.setItem('spriteworld_save', JSON.stringify({
    ...gameState,
    savedAt: Date.now(),
  }));
}

/**
 * Load state from localStorage into gameState.
 * @returns {boolean} true if a save was found and applied.
 */
export function loadGame() {
  const raw = localStorage.getItem('spriteworld_save');
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    Object.assign(gameState, saved);
    gameState.sessionStart = Date.now(); // start a fresh session timer
    return true;
  } catch {
    return false;
  }
}
