/** Item names that are treated as key items: no quantity, cannot be used up. */
export const KEY_ITEMS = new Set(['Bicycle']);

export default {
  namespaced: true,

  state: () => ({
    items:          [],
    pokeballs:      [],
    tms:            [],
    keyItems:       [],
    registeredItem: null,
  }),

  mutations: {
    PICKUP(state, payload) {
      const name = typeof payload === 'string' ? payload : payload.name;
      const qty  = typeof payload === 'string' ? 1 : (payload.qty ?? 1);

      if (KEY_ITEMS.has(name)) {
        if (!state.keyItems.some(e => e.name === name)) {
          state.keyItems.push({ name });
        }
        return;
      }

      const isBall = /ball$/i.test(name);
      const isTm   = /^(TM|HM)\d/i.test(name);
      const list   = isBall ? state.pokeballs : isTm ? state.tms : state.items;
      const entry  = list.find(e => e.name === name);
      if (entry) {
        entry.quantity += qty;
      } else {
        list.push({ name, quantity: qty });
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

    REGISTER_ITEM(state, name) {
      state.registeredItem = (state.registeredItem === name) ? null : name;
    },

    LOAD(state, saved) {
      if (saved.bag) {
        if (Array.isArray(saved.bag.items)) {
          state.items = saved.bag.items;
        }
        if (Array.isArray(saved.bag.pokeballs)) {
          state.pokeballs = saved.bag.pokeballs;
        }
        if (Array.isArray(saved.bag.tms)) {
          state.tms = saved.bag.tms;
        }
        if (Array.isArray(saved.bag.keyItems)) {
          state.keyItems = saved.bag.keyItems;
        }
        if (saved.bag.registeredItem !== undefined) {
          state.registeredItem = saved.bag.registeredItem;
        }
      }
    },

    /**
     * Decrement the quantity of a named item from the items list.
     * Removes the entry when it reaches zero. Key items are ignored.
     */
    USE_ITEM(state, itemName) {
      if (KEY_ITEMS.has(itemName)) return;
      const idx = state.items.findIndex(e => e.name === itemName);
      if (idx === -1) return;
      state.items[idx].quantity--;
      if (state.items[idx].quantity <= 0) {
        state.items.splice(idx, 1);
      }
    },

    /**
     * Sync item quantities back from the battle engine after a fight ends.
     * @param {Array<{ item: { getName(): string }, quantity: number }>} battleItems
     *   The battle inventory items array — same objects mutated during the fight.
     */
    RESET(state) {
      state.items          = [];
      state.pokeballs      = [];
      state.tms            = [];
      state.keyItems       = [];
      state.registeredItem = null;
    },

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
