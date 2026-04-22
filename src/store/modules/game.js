import defaultFlags from '@Data/gameFlags.js';
import { generateTid } from '@Utilities';

export default {
  namespaced: true,

  state: () => ({
    seed:         Math.floor(Math.random() * 0x100000000) >>> 0,
    trainerId:    generateTid(),
    playerName:   'Red',
    rivalName:    'Blue',
    playerSprite: 'red',
    onBike:        false,
    playerFacing:  'down',
    currentMap:   'HeroHouseF2',
    playerTile:   { x: 2, y: 6, charLayer: 'ground' },
    gameFlags:    { ...defaultFlags },
    mapVars:      {},          // per-scene temporary variables: { [sceneName]: { [key]: value } }
    mapVariant:   null,        // variant string of the current map (passed via warp-variant)
    playtime:     0,           // accumulated seconds from previous sessions
    sessionStart: Date.now(),
    money:        3000,
    healLocation:        null,  // { map, x, y, charLayer } — set when player heals at a Pokémon Center
    lastOutdoorLocation: null, // { map, x, y, charLayer } — updated on every step on outdoor maps
    textSpeed:    'normal',    // 'normal' | 'fast' | 'instant'
    bgmVolume:    10,          // 0–20 (each step = 5%)
    sfxVolume:    10,          // 0–20 (each step = 5%)
    alwaysRun:    false,       // move at run speed without holding B (requires Running Shoes)
    activeSlot:   1,           // transient — which save slot is currently loaded; not persisted
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
    SET_TEXT_SPEED(state, speed) {
      state.textSpeed = speed;
    },
    SET_BGM_VOLUME(state, v) {
      state.bgmVolume = v;
    },
    SET_SFX_VOLUME(state, v) {
      state.sfxVolume = v;
    },
    SET_ALWAYS_RUN(state, v) {
      state.alwaysRun = !!v;
    },

    SET_ON_BIKE(state, value) {
      state.onBike = value;
    },

    SET_ACTIVE_SLOT(state, slot) {
      state.activeSlot = slot;
    },

    /**
     * Patch the global option fields (textSpeed, bgmVolume, sfxVolume,
     * alwaysRun). Called from the options loader at store init and from the
     * Options screen on change. These fields live globally — they are
     * intentionally NOT touched by per-slot LOAD / RESET.
     */
    APPLY_OPTIONS(state, opts) {
      if (opts == null) return;
      if (opts.textSpeed != null) state.textSpeed = opts.textSpeed;
      if (opts.bgmVolume != null) state.bgmVolume = opts.bgmVolume;
      if (opts.sfxVolume != null) state.sfxVolume = opts.sfxVolume;
      if (opts.alwaysRun != null) state.alwaysRun = !!opts.alwaysRun;
    },

    SET_PLAYER_FACING(state, direction) {
      state.playerFacing = direction;
    },

    PATCH_FLAGS(state, overrides) {
      Object.assign(state.gameFlags, overrides);
    },

    SET_MAP_VAR(state, { map, key, value }) {
      if (!state.mapVars[map]) state.mapVars[map] = {};
      state.mapVars[map][key] = value;
    },

    SET_MAP_VARIANT(state, variant) {
      state.mapVariant = variant ?? null;
    },

    ADD_MONEY(state, amount) {
      state.money = Math.max(0, state.money + amount);
    },

    SET_HEAL_LOCATION(state, location) {
      state.healLocation = location; // { map, x, y, charLayer }
    },

    SET_LAST_OUTDOOR_LOCATION(state, location) {
      state.lastOutdoorLocation = location; // { map, x, y, charLayer }
    },

    LOAD(state, saved) {
      if (saved.seed        != null) state.seed        = saved.seed;
      // Pre-TID saves won't carry a trainerId — generate one on first load
      // and it'll get persisted on the next saveGame().
      state.trainerId = saved.trainerId ?? generateTid();
      if (saved.playerName   != null) state.playerName   = saved.playerName;
      if (saved.playerSprite != null) state.playerSprite = saved.playerSprite;
      if (saved.onBike        != null) state.onBike        = saved.onBike;
      if (saved.playerFacing  != null) state.playerFacing  = saved.playerFacing;
      if (saved.currentMap  != null) state.currentMap  = saved.currentMap;
      if (saved.playerTile  != null) state.playerTile  = saved.playerTile;
      if (saved.gameFlags   != null) state.gameFlags   = saved.gameFlags;
      if (saved.mapVars     != null) state.mapVars     = saved.mapVars;
      if (saved.mapVariant  !== undefined) state.mapVariant = saved.mapVariant ?? null;
      if (saved.playtime     != null) state.playtime     = saved.playtime;
      if (saved.money        != null) state.money        = saved.money;
      if (saved.healLocation != null) state.healLocation = saved.healLocation;
      if (saved.lastOutdoorLocation != null) state.lastOutdoorLocation = saved.lastOutdoorLocation;
      // textSpeed / bgmVolume / sfxVolume / alwaysRun are global options,
      // not per-slot — loaded from sw_options at store init and preserved
      // across per-slot LOAD / RESET.
      state.sessionStart = Date.now();
    },

    RESET(state) {
      state.seed                = Math.floor(Math.random() * 0x100000000) >>> 0;
      state.trainerId           = generateTid();
      state.playerName          = 'Red';
      state.rivalName           = 'Blue';
      state.playerSprite        = 'red';
      state.onBike              = false;
      state.playerFacing        = 'down';
      state.currentMap          = 'HeroHouseF2';
      state.playerTile          = { x: 2, y: 6, charLayer: 'ground' };
      state.gameFlags           = { ...defaultFlags };
      state.mapVars             = {};
      state.mapVariant          = null;
      state.playtime            = 0;
      state.sessionStart        = Date.now();
      state.money               = 3000;
      state.healLocation        = null;
      state.lastOutdoorLocation = null;
      // textSpeed / bgmVolume / sfxVolume / alwaysRun are global options
      // and intentionally NOT reset here. They persist across new-game and
      // slot switches.
    },
  },
};
