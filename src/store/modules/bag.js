export default {
  namespaced: true,

  state: () => ({
    items:     [],
    pokeballs: [],
    tms:       [],
  }),

  mutations: {
    PICKUP(state, name) {
      const isBall = /ball$/i.test(name);
      const isTm   = /^(TM|HM)\d/i.test(name);
      const list   = isBall ? state.pokeballs : isTm ? state.tms : state.items;
      const entry  = list.find(e => e.name === name);
      if (entry) {
        entry.quantity++;
      } else {
        list.push({ name, quantity: 1 });
      }
    },

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

    /**
     * Sync item quantities back from the battle engine after a fight ends.
     * @param {Array<{ item: { getName(): string }, quantity: number }>} battleItems
     *   The battle inventory items array — same objects mutated during the fight.
     */
    SYNC_AFTER_BATTLE(state, battleItems) {
      for (const { item, quantity } of battleItems) {
        const entry = state.items.find(e => e.name === item.getName());
        if (entry) entry.quantity = quantity;
      }
      // Remove items that were fully used up during the battle.
      state.items = state.items.filter(e => e.quantity > 0);
    },
  },
};
