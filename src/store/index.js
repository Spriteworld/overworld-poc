import { createStore } from 'vuex';
import game     from './modules/game.js';
import party    from './modules/party.js';
import bag      from './modules/bag.js';
import pokedex  from './modules/pokedex.js';
import overworld from './modules/overworld.js';

export default createStore({
  modules: { game, party, bag, pokedex, overworld },

  actions: {
    saveGame({ state, commit }) {
      commit('game/FLUSH_PLAYTIME');
      localStorage.setItem('spriteworld_save', JSON.stringify({
        // player
        seed: state.game.seed,
        playerName: state.game.playerName,
        currentMap: state.game.currentMap,
        playerTile: state.game.playerTile,
        gameFlags: state.game.gameFlags,
        playtime: state.game.playtime,
        // party / bag / pokedex
        party: state.party.list,
        bag: state.bag,
        pokedex: state.pokedex.entries,
        collectedItems: state.overworld.collectedItems,
        savedAt: Date.now(),
      }));
    },

    loadGame({ commit }) {
      const raw = localStorage.getItem('spriteworld_save');
      if (!raw) return false;
      try {
        const saved = JSON.parse(raw);
        commit('game/LOAD', saved);
        commit('party/LOAD', saved);
        commit('bag/LOAD', saved);
        commit('pokedex/LOAD', saved);
        commit('overworld/LOAD', saved);
        return true;
      } catch {
        return false;
      }
    },
  },
});
