import { defaultParty } from '@Data/party.js';
import defaultFlags    from '@Data/gameFlags.js';

const ALL_CAUGHT = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 386 }, (_, i) => [i + 1, { seen: true, caught: true }])
  )
);

function defaultEntries() {
  if (defaultFlags.debug_fill_pokedex) return { ...ALL_CAUGHT };
  const entries = {};
  defaultParty.forEach(p => { entries[p.species] = { seen: true, caught: true }; });
  return entries;
}

export default {
  namespaced: true,

  state: () => ({
    entries: defaultEntries(), // nat_dex_id → { seen: bool, caught: bool }
  }),

  mutations: {
    SEE(state, natDexId) {
      if (!state.entries[natDexId]) {
        state.entries[natDexId] = { seen: true, caught: false };
      } else {
        state.entries[natDexId].seen = true;
      }
    },

    CATCH(state, natDexId) {
      state.entries[natDexId] = { seen: true, caught: true };
    },

    LOAD(state, saved) {
      if (defaultFlags.debug_fill_pokedex) {
        Object.assign(state.entries, ALL_CAUGHT);
      } else if (saved.pokedex) {
        Object.assign(state.entries, saved.pokedex);
      }
    },

    RESET(state) {
      state.entries = defaultEntries();
    },
  },
};
