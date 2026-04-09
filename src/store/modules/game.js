import defaultFlags from '@Data/gameFlags.js';

export default {
  namespaced: true,

  state: () => ({
    seed:         Math.floor(Math.random() * 0x100000000) >>> 0,
    playerName:   'Red',
    playerSprite: 'red',
    onBike:        false,
    playerFacing:  'down',
    currentMap:   'HeroHouseF2',
    playerTile:   { x: 2, y: 6, charLayer: 'ground' },
    gameFlags:    { ...defaultFlags },
    playtime:     0,           // accumulated seconds from previous sessions
    sessionStart: Date.now(),
    money:        3000,
    healLocation: null,        // { map, x, y, charLayer } — set when player heals at a Pokémon Center
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

    SET_PLAYER_SPRITE(state, sprite) {
      state.playerSprite = sprite;
    },

    SET_ON_BIKE(state, value) {
      state.onBike = value;
    },

    SET_PLAYER_FACING(state, direction) {
      state.playerFacing = direction;
    },

    PATCH_FLAGS(state, overrides) {
      Object.assign(state.gameFlags, overrides);
    },

    ADD_MONEY(state, amount) {
      state.money = Math.max(0, state.money + amount);
    },

    SET_HEAL_LOCATION(state, location) {
      state.healLocation = location; // { map, x, y, charLayer }
    },

    LOAD(state, saved) {
      if (saved.seed        != null) state.seed        = saved.seed;
      if (saved.playerName   != null) state.playerName   = saved.playerName;
      if (saved.playerSprite != null) state.playerSprite = saved.playerSprite;
      if (saved.onBike        != null) state.onBike        = saved.onBike;
      if (saved.playerFacing  != null) state.playerFacing  = saved.playerFacing;
      if (saved.currentMap  != null) state.currentMap  = saved.currentMap;
      if (saved.playerTile  != null) state.playerTile  = saved.playerTile;
      if (saved.gameFlags   != null) state.gameFlags   = saved.gameFlags;
      if (saved.playtime     != null) state.playtime     = saved.playtime;
      if (saved.money        != null) state.money        = saved.money;
      if (saved.healLocation != null) state.healLocation = saved.healLocation;
      state.sessionStart = Date.now();
    },
  },
};
