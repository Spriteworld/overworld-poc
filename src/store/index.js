import { createStore } from 'vuex';
import player  from './modules/player.js';
import party   from './modules/party.js';
import bag     from './modules/bag.js';
import pokedex from './modules/pokedex.js';

export default createStore({
  modules: { player, party, bag, pokedex },

  actions: {
    saveGame({ state, commit }) {
      commit('player/FLUSH_PLAYTIME');
      localStorage.setItem('spriteworld_save', JSON.stringify({
        // player
        playerName:   state.player.playerName,
        currentMap:   state.player.currentMap,
        gameFlags:    state.player.gameFlags,
        playtime:     state.player.playtime,
        // party / bag / pokedex
        party:   state.party.list,
        bag:     state.bag,
        pokedex: state.pokedex.entries,
        savedAt: Date.now(),
      }));
    },

    loadGame({ commit }) {
      const raw = localStorage.getItem('spriteworld_save');
      if (!raw) return false;
      try {
        const saved = JSON.parse(raw);
        commit('player/LOAD',  saved);
        commit('party/LOAD',   saved);
        commit('bag/LOAD',     saved);
        commit('pokedex/LOAD', saved);
        return true;
      } catch {
        return false;
      }
    },
  },
});
