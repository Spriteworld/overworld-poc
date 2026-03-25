export default {
  namespaced: true,

  state: () => ({
    items:     [],
    pokeballs: [],
    tms:       [],
  }),

  mutations: {
    ADD_ITEM(state, item) {
      state.items.push(item);
    },

    ADD_POKEBALL(state, ball) {
      state.pokeballs.push(ball);
    },

    ADD_TM(state, tm) {
      state.tms.push(tm);
    },

    LOAD(state, saved) {
      if (saved.bag) {
        if (Array.isArray(saved.bag.items))     state.items     = saved.bag.items;
        if (Array.isArray(saved.bag.pokeballs)) state.pokeballs = saved.bag.pokeballs;
        if (Array.isArray(saved.bag.tms))       state.tms       = saved.bag.tms;
      }
    },
  },
};
