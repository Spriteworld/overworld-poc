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

    SWAP(state, { a, b }) {
      const tmp = state.list[a];
      state.list[a] = state.list[b];
      state.list[b] = tmp;
      // Remove trailing nulls/undefineds
      while (state.list.length && !state.list[state.list.length - 1]) {
        state.list.pop();
      }
    },

    SYNC_AFTER_BATTLE(state, team) {
      team.forEach(snapshot => {
        const entry = state.list.find(p => p.pid === snapshot.pid);
        if (!entry) return;
        entry.currentHp = snapshot.currentHp;
        if (snapshot.exp                          != null) entry.exp                 = snapshot.exp;
        if (snapshot.level                        != null) entry.level               = snapshot.level;
        if (snapshot.readyToEvolve                != null) entry.readyToEvolve       = snapshot.readyToEvolve;
        if (snapshot.pendingMovesToLearn?.length)          entry.pendingMovesToLearn = snapshot.pendingMovesToLearn;
        // Sync moves: update PP for existing slots, append any newly learned moves
        snapshot.moves.forEach((mSnap, i) => {
          if (entry.moves[i]) {
            entry.moves[i].pp.current = mSnap.pp.current;
          } else {
            entry.moves.push({ name: mSnap.name, pp: { max: mSnap.pp.max, current: mSnap.pp.current } });
          }
        });
      });
    },
  },
};
