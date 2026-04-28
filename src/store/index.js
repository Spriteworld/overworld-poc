import { createStore } from 'vuex';
import game     from './modules/game.js';
import party    from './modules/party.js';
import bag      from './modules/bag.js';
import pokedex  from './modules/pokedex.js';
import overworld from './modules/overworld.js';
import { isTestMode } from '@Data/testMode.js';
import { getGameDef, setGameDef } from '@Data/gameDef.js';

export const SLOT_COUNT = 3;
const SLOT_KEYS = ['sw_game', 'sw_party', 'sw_bag', 'sw_pokedex', 'sw_overworld'];
const OPTIONS_KEY = 'sw_options';
const OPTION_FIELDS = ['textSpeed', 'bgmVolume', 'sfxVolume', 'alwaysRun', 'autoSurf', 'uiScale'];

const keyFor = (base, slot) => `${base}_slot${slot}`;

/**
 * One-shot migration from the single-save, unsuffixed key layout
 * (sw_game / sw_party / sw_bag / sw_pokedex / sw_overworld) into the
 * slot-1 key layout. Runs at module import. Leaves the legacy
 * `spriteworld_save` single-JSON blob alone — loadGame()'s fallback
 * still reads it when slot 1 is otherwise empty.
 */
(function migrateLegacySaves() {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(keyFor('sw_game', 1)) !== null) return;
  if (localStorage.getItem('sw_game') === null) return;

  // Before renaming, lift global-option fields out of the legacy sw_game
  // blob so the user's prior textSpeed / volume / alwaysRun picks survive
  // the split-out.
  try {
    const g = JSON.parse(localStorage.getItem('sw_game'));
    if (g && localStorage.getItem(OPTIONS_KEY) === null) {
      const opts = {};
      for (const k of OPTION_FIELDS) if (g[k] !== undefined) opts[k] = g[k];
      if (Object.keys(opts).length) {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
      }
    }
  } catch { /* ignore malformed blob */ }

  for (const base of SLOT_KEYS) {
    const v = localStorage.getItem(base);
    if (v == null) continue;
    localStorage.setItem(keyFor(base, 1), v);
    localStorage.removeItem(base);
  }
  if (localStorage.getItem('sw_active_slot') === null) {
    localStorage.setItem('sw_active_slot', '1');
  }
})();

/**
 * Read saved `sw_game_slot{n}` summaries for all slots without hydrating
 * the Vuex store. Used by TitleScreen to render the slot picker.
 *
 * @returns {Array<{slot:number,empty:boolean,playerName?:string,currentMap?:string,playtime?:number,savedAt?:number}>}
 */
export function listSaves() {
  const out = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    const raw = localStorage.getItem(keyFor('sw_game', slot));
    if (raw == null) { out.push({ slot, empty: true }); continue; }
    try {
      const g = JSON.parse(raw);
      out.push({
        slot,
        empty:       false,
        playerName:  g.playerName,
        currentMap:  g.currentMap,
        playtime:    g.playtime ?? 0,
        savedAt:     g.savedAt,
      });
    } catch {
      out.push({ slot, empty: true });
    }
  }
  return out;
}

/** Read the active slot from localStorage, clamped to [1, SLOT_COUNT]. */
export function getActiveSlot() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('sw_active_slot') : null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= SLOT_COUNT ? n : 1;
}

/** Persist the current in-memory option fields to the global sw_options key. */
export function saveOptions(storeInstance) {
  if (typeof localStorage === 'undefined') return;
  const g = storeInstance.state.game;
  const opts = {};
  for (const k of OPTION_FIELDS) opts[k] = g[k];
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
}

/**
 * Load the global options from localStorage and patch them onto the game
 * module. Called once at store creation below. Safe to call again after a
 * RESET to re-hydrate.
 */
function hydrateOptions(storeInstance) {
  if (typeof localStorage === 'undefined') return;
  const raw = localStorage.getItem(OPTIONS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const patch = {};
    for (const k of OPTION_FIELDS) if (parsed[k] !== undefined) patch[k] = parsed[k];
    storeInstance.commit('game/APPLY_OPTIONS', patch);
  } catch { /* ignore malformed options */ }
}

const store = createStore({
  modules: { game, party, bag, pokedex, overworld },

  actions: {
    saveGame({ state, commit }) {
      // Test-harness scenarios run with synthetic state (random parties, flipped
      // flags). Never let those writes reach localStorage and overwrite a real save.
      if (isTestMode()) return;
      commit('game/FLUSH_PLAYTIME');
      const slot    = state.game.activeSlot;
      const savedAt = Date.now();
      localStorage.setItem(keyFor('sw_game', slot), JSON.stringify({
        seed:         state.game.seed,
        trainerId:    state.game.trainerId,
        playerName:   state.game.playerName,
        playerSprite: state.game.playerSprite,
        onBike:        state.game.onBike,
        onSurf:        state.game.onSurf,
        playerFacing:  state.game.playerFacing,
        currentMap:   state.game.currentMap,
        playerTile:   state.game.playerTile,
        gameFlags:    state.game.gameFlags,
        mapVars:      state.game.mapVars,
        mapVariant:   state.game.mapVariant,
        playtime:     state.game.playtime,
        money:        state.game.money,
        healLocation: state.game.healLocation,
        lastOutdoorLocation: state.game.lastOutdoorLocation,
        // gameDef is per-slot (which ruleset the slot is playing). Options
        // (textSpeed, bgmVolume, sfxVolume, alwaysRun, autoSurf) are global
        // and live in sw_options — they're intentionally omitted here.
        gameDef:      getGameDef(),
        savedAt,
      }));
      localStorage.setItem(keyFor('sw_party',    slot), JSON.stringify(state.party.list));
      localStorage.setItem(keyFor('sw_bag',      slot), JSON.stringify(state.bag));
      localStorage.setItem(keyFor('sw_pokedex',  slot), JSON.stringify(state.pokedex.entries));
      localStorage.setItem(keyFor('sw_overworld',slot), JSON.stringify({ collectedItems: state.overworld.collectedItems }));
      localStorage.setItem('sw_active_slot', String(slot));
    },

    /**
     * Clear one slot (when called with `slot`) or every slot + legacy blobs
     * (when called with no args). Resets the in-memory state either way.
     */
    clearSave({ commit }, slot) {
      if (slot == null) {
        // Scrub everything, including legacy single-key blobs.
        for (let s = 1; s <= SLOT_COUNT; s++) {
          for (const base of SLOT_KEYS) localStorage.removeItem(keyFor(base, s));
        }
        for (const base of SLOT_KEYS) localStorage.removeItem(base);
        localStorage.removeItem('spriteworld_save');
        localStorage.removeItem('sw_active_slot');
      } else {
        for (const base of SLOT_KEYS) localStorage.removeItem(keyFor(base, slot));
      }
      commit('game/RESET');
      commit('party/RESET');
      commit('bag/RESET');
      commit('pokedex/RESET');
      commit('overworld/RESET');
    },

    /**
     * Load save data from `slot` (defaults to whatever sw_active_slot
     * points at, which the migration sets to 1 on first boot). Falls back
     * to the legacy `spriteworld_save` blob when loading slot 1 and slot 1
     * is empty — preserves older installs that pre-date the split-key format.
     *
     * @returns {boolean} true if any save data was loaded into the store.
     */
    loadGame({ commit }, slot) {
      const targetSlot = slot ?? getActiveSlot();

      const gameRaw = localStorage.getItem(keyFor('sw_game', targetSlot));
      if (!gameRaw) {
        // Legacy fallback: only for slot 1, and only when nothing else lives there.
        if (targetSlot === 1) {
          const legacy = localStorage.getItem('spriteworld_save');
          if (!legacy) return false;
          try {
            const saved = JSON.parse(legacy);
            if (saved.gameDef) setGameDef(saved.gameDef);
            commit('game/LOAD', saved);
            commit('party/LOAD', saved);
            commit('bag/LOAD', saved);
            commit('pokedex/LOAD', saved);
            commit('overworld/LOAD', saved);
            commit('game/SET_ACTIVE_SLOT', 1);
            localStorage.setItem('sw_active_slot', '1');
            return true;
          } catch { return false; }
        }
        return false;
      }

      try {
        const parsedGame = JSON.parse(gameRaw);
        if (parsedGame.gameDef) setGameDef(parsedGame.gameDef);
        commit('game/LOAD', parsedGame);
        const partyRaw     = localStorage.getItem(keyFor('sw_party',     targetSlot));
        const bagRaw       = localStorage.getItem(keyFor('sw_bag',       targetSlot));
        const pokedexRaw   = localStorage.getItem(keyFor('sw_pokedex',   targetSlot));
        const overworldRaw = localStorage.getItem(keyFor('sw_overworld', targetSlot));
        if (partyRaw)     commit('party/LOAD',     { party:   JSON.parse(partyRaw) });
        if (bagRaw)       commit('bag/LOAD',       { bag:     JSON.parse(bagRaw) });
        if (pokedexRaw)   commit('pokedex/LOAD',   { pokedex: JSON.parse(pokedexRaw) });
        if (overworldRaw) commit('overworld/LOAD', JSON.parse(overworldRaw));
        commit('game/SET_ACTIVE_SLOT', targetSlot);
        localStorage.setItem('sw_active_slot', String(targetSlot));
        return true;
      } catch { return false; }
    },
  },
});

hydrateOptions(store);

// Auto-persist the global options whenever they're changed — either from
// the TitleScreen Options menu or the in-game PauseMenu OptionScreen. This
// avoids every caller having to remember to call saveOptions() themselves.
const PERSISTING_MUTATIONS = new Set([
  'game/SET_TEXT_SPEED',
  'game/SET_BGM_VOLUME',
  'game/SET_SFX_VOLUME',
  'game/SET_ALWAYS_RUN',
  'game/SET_AUTO_SURF',
  'game/SET_UI_SCALE',
  'game/APPLY_OPTIONS',
]);
store.subscribe((mutation) => {
  if (PERSISTING_MUTATIONS.has(mutation.type)) saveOptions(store);
});

export default store;
