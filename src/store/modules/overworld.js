export default {
  namespaced: true,

  state: () => ({
    collectedItems: [],   // array of Tiled object name strings
  }),

  mutations: {
    COLLECT_ITEM(state, key) {
      if (!state.collectedItems.includes(key)) {
        state.collectedItems.push(key);
      }
    },

    LOAD(state, saved) {
      if (Array.isArray(saved.collectedItems)) {
        state.collectedItems = saved.collectedItems;
      }
    },

    RESET(state) {
      state.collectedItems = [];
    },
  },
};
