import {
  resolveItemId, getItemLabel, getItemCategory, isKeyItem, getBagListKey,
} from '../../data/itemDefs.js';

export default {
  namespaced: true,

  state: () => ({
    items:          [],
    medicine:       [],
    pokeballs:      [],
    tms:            [],
    keyItems:       [],
    registeredItem: null,
  }),

  mutations: {
    PICKUP(state, payload) {
      const raw  = typeof payload === 'string' ? payload : (payload.name ?? payload.id);
      const qty  = typeof payload === 'string' ? 1 : (payload.qty ?? 1);
      const id   = resolveItemId(raw);

      if (id == null) {
        console.warn(`[bag/PICKUP] unknown item "${raw}"`);
        return;
      }

      const label   = getItemLabel(id);
      const listKey = getBagListKey(id);

      if (listKey === 'keyItems') {
        if (!state.keyItems.some(e => e.id === id)) {
          state.keyItems.push({ id, label });
        }
        return;
      }

      const list  = state[listKey];
      const entry = list.find(e => e.id === id);
      if (entry) {
        entry.quantity += qty;
      } else {
        list.push({ id, label, quantity: qty });
      }
    },

    REGISTER_ITEM(state, idOrName) {
      const id = resolveItemId(idOrName);
      state.registeredItem = (state.registeredItem === id) ? null : id;
    },

    LOAD(state, saved) {
      if (!saved.bag) return;
      for (const key of ['items', 'medicine', 'pokeballs', 'tms', 'keyItems']) {
        if (!Array.isArray(saved.bag[key])) continue;
        state[key] = saved.bag[key].map(e => {
          if (e.id != null) return e;
          const id = resolveItemId(e.name);
          if (id == null) return null;
          const label = getItemLabel(id);
          return e.quantity != null ? { id, label, quantity: e.quantity } : { id, label };
        }).filter(Boolean);
      }
      if (saved.bag.registeredItem !== undefined) {
        const ri = saved.bag.registeredItem;
        state.registeredItem = typeof ri === 'number' ? ri : resolveItemId(ri);
      }
    },

    USE_ITEM(state, idOrName) {
      const id = resolveItemId(idOrName);
      if (id == null || isKeyItem(id)) return;
      for (const key of ['items', 'medicine', 'pokeballs', 'tms']) {
        const idx = state[key].findIndex(e => e.id === id);
        if (idx === -1) continue;
        state[key][idx].quantity--;
        if (state[key][idx].quantity <= 0) state[key].splice(idx, 1);
        return;
      }
    },

    RESET(state) {
      state.items          = [];
      state.medicine       = [];
      state.pokeballs      = [];
      state.tms            = [];
      state.keyItems       = [];
      state.registeredItem = null;
    },

    SYNC_AFTER_BATTLE(state, battleItems) {
      for (const { item, quantity } of battleItems) {
        const id = resolveItemId(item.getName());
        if (id == null) continue;
        const entry = [...state.items, ...state.medicine, ...state.pokeballs].find(e => e.id === id);
        if (entry) entry.quantity = quantity;
      }
      state.items     = state.items.filter(e => e.quantity > 0);
      state.medicine  = state.medicine.filter(e => e.quantity > 0);
      state.pokeballs = state.pokeballs.filter(e => e.quantity > 0);
    },
  },
};
