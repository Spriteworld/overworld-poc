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
      const savedAt = Date.now();
      localStorage.setItem('sw_game',     JSON.stringify({
        seed:         state.game.seed,
        playerName:   state.game.playerName,
        playerSprite: state.game.playerSprite,
        onBike:        state.game.onBike,
        playerFacing:  state.game.playerFacing,
        currentMap:   state.game.currentMap,
        playerTile:   state.game.playerTile,
        gameFlags:    state.game.gameFlags,
        playtime:     state.game.playtime,
        money:        state.game.money,
        healLocation: state.game.healLocation,
        savedAt,
      }));
      localStorage.setItem('sw_party',    JSON.stringify(state.party.list));
      localStorage.setItem('sw_bag',      JSON.stringify(state.bag));
      localStorage.setItem('sw_pokedex',  JSON.stringify(state.pokedex.entries));
      localStorage.setItem('sw_overworld',JSON.stringify({ collectedItems: state.overworld.collectedItems }));
    },

    loadGame({ commit }) {
      const gameRaw = localStorage.getItem('sw_game');
      // Fall back to the old single-key format if new keys aren't present.
      if (!gameRaw) {
        const legacy = localStorage.getItem('spriteworld_save');
        if (!legacy) return false;
        try {
          const saved = JSON.parse(legacy);
          commit('game/LOAD', saved);
          commit('party/LOAD', saved);
          commit('bag/LOAD', saved);
          commit('pokedex/LOAD', saved);
          commit('overworld/LOAD', saved);
          return true;
        } catch { return false; }
      }
      try {
        commit('game/LOAD',     JSON.parse(gameRaw));
        const partyRaw     = localStorage.getItem('sw_party');
        const bagRaw       = localStorage.getItem('sw_bag');
        const pokedexRaw   = localStorage.getItem('sw_pokedex');
        const overworldRaw = localStorage.getItem('sw_overworld');
        if (partyRaw)     commit('party/LOAD',    { party:    JSON.parse(partyRaw) });
        if (bagRaw)       commit('bag/LOAD',       { bag: JSON.parse(bagRaw) });
        if (pokedexRaw)   commit('pokedex/LOAD',   { pokedex:  JSON.parse(pokedexRaw) });
        if (overworldRaw) commit('overworld/LOAD', JSON.parse(overworldRaw));
        return true;
      } catch { return false; }
    },
  },
});
