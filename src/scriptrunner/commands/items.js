import store from '../../store/index.js';
import { resolveItemId, getItemLabel } from '../../data/itemDefs.js';

function resolveItemField(field) {
  if (typeof field === 'string') return field;
  if (field && typeof field === 'object') return field.item ?? field.name ?? '';
  return '';
}

export default {
  give_item(runner, cmd) {
    const raw = resolveItemField(cmd.item);
    store.commit('bag/PICKUP', { name: raw, qty: cmd.qty ?? 1 });
    runner._step();
  },

  remove_item(runner, cmd) {
    const raw = resolveItemField(cmd.item);
    const qty = cmd.qty ?? 1;
    for (let i = 0; i < qty; i++) store.commit('bag/USE_ITEM', raw);
    runner._step();
  },

  if_has_item(runner, cmd) {
    const raw = resolveItemField(cmd.item);
    const id  = resolveItemId(raw);
    const bag = store.state.bag;
    const found = id != null && (
      bag.items.some(e => e.id === id) ||
      bag.pokeballs.some(e => e.id === id) ||
      bag.tms.some(e => e.id === id) ||
      bag.keyItems.some(e => e.id === id)
    );
    if (runner._debug()) console.log(`[ScriptRunner] if_has_item — item: "${raw}" (id=${id}) → ${found ? 'pass' : 'fail'}`);
    runner._branch(found ? (cmd.then ?? []) : (cmd.else ?? []));
  },
};
