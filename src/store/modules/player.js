import defaultFlags from '@Data/gameFlags.js';

export default {
  namespaced: true,

  state: () => ({
    playerName:   'Red',
    currentMap:   'Test',
    gameFlags:    { ...defaultFlags },
    playtime:     0,           // accumulated seconds from previous sessions
    sessionStart: Date.now(),
  }),

  getters: {
    playtime: (state) =>
      state.playtime + (Date.now() - state.sessionStart) / 1000,
  },

  mutations: {
    SET_MAP(state, map) {
      state.currentMap = map;
    },

    FLUSH_PLAYTIME(state) {
      state.playtime     += (Date.now() - state.sessionStart) / 1000;
      state.sessionStart  = Date.now();
    },

    LOAD(state, saved) {
      if (saved.playerName  != null) state.playerName  = saved.playerName;
      if (saved.currentMap  != null) state.currentMap  = saved.currentMap;
      if (saved.gameFlags   != null) state.gameFlags   = saved.gameFlags;
      if (saved.playtime    != null) state.playtime    = saved.playtime;
      state.sessionStart = Date.now();
    },
  },
};
