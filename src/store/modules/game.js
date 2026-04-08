import defaultFlags from '@Data/gameFlags.js';

export default {
  namespaced: true,

  state: () => ({
    seed:         Math.floor(Math.random() * 0x100000000) >>> 0,
    playerName:   'Red',
    currentMap:   'Test',
    playerTile:   { x: 0, y: 0, charLayer: 'ground' },
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

    SET_PLAYER_TILE(state, tile) {
      state.playerTile = tile;
    },

    FLUSH_PLAYTIME(state) {
      state.playtime     += (Date.now() - state.sessionStart) / 1000;
      state.sessionStart  = Date.now();
    },

    PATCH_FLAGS(state, overrides) {
      Object.assign(state.gameFlags, overrides);
    },

    LOAD(state, saved) {
      if (saved.seed        != null) state.seed        = saved.seed;
      if (saved.playerName  != null) state.playerName  = saved.playerName;
      if (saved.currentMap  != null) state.currentMap  = saved.currentMap;
      if (saved.playerTile  != null) state.playerTile  = saved.playerTile;
      if (saved.gameFlags   != null) state.gameFlags   = saved.gameFlags;
      if (saved.playtime    != null) state.playtime    = saved.playtime;
      state.sessionStart = Date.now();
    },
  },
};
