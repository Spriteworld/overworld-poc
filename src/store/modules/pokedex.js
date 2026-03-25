import { defaultParty } from '@Data/party.js';

// Seed party members as seen + caught by default
function defaultEntries() {
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
      if (saved.pokedex) Object.assign(state.entries, saved.pokedex);
    },
  },
};
