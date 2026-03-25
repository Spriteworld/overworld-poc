import { defaultParty } from '@Data/party.js';

function cloneParty(source) {
  return source.map(p => ({
    ...p,
    moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
    ivs:   { ...p.ivs },
    evs:   { ...p.evs },
  }));
}

export default {
  namespaced: true,

  state: () => ({
    list: cloneParty(defaultParty),
  }),

  mutations: {
    LOAD(state, saved) {
      if (Array.isArray(saved.party)) state.list = saved.party;
    },
  },
};
