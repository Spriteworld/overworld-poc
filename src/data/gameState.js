/**
 * Compatibility shim for Phaser code.
 *
 * All game state now lives in Vuex modules (src/store/modules/).
 * This shim re-exposes the relevant slices under a flat `gameState` object
 * so existing Phaser imports need no changes.
 *
 *   import { gameState } from '@Data/gameState.js'
 *   gameState.party      → store.state.party.list   (same array reference)
 *   gameState.pokedex    → store.state.pokedex.entries
 *   gameState.currentMap → store.state.player.currentMap  (writable)
 *   etc.
 */
import store from '../store/index.js';

export const gameState = Object.defineProperties({}, {
  game: {
    get: () => store.state.game,
    enumerable: true,
  },
  currentMap:  {
    get: () => store.state.player.currentMap,
    set: (v) => { store.state.player.currentMap = v; },
    enumerable: true,
  },
  gameFlags: { 
    get: () => store.state.player.gameFlags, 
    enumerable: true 
  },
  party: { 
    get: () => store.state.party.list, 
    enumerable: true 
  },
  bag: { 
    get: () => store.state.bag, 
    enumerable: true 
  },
  pokedex: { 
    get: () => store.state.pokedex.entries,  
    enumerable: true 
  },
});

/** Total playtime in seconds including the current unsaved session. */
export function getPlaytime() {
  return store.getters['player/playtime'];
}

/** Persist current state to localStorage. */
export function saveGame() {
  return store.dispatch('saveGame');
}

/** Load state from localStorage into the store. */
export function loadGame() {
  return store.dispatch('loadGame');
}
