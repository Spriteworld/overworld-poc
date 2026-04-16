import store from '../../store/index.js';

export default {
  give_item(runner, cmd) {
    store.commit('bag/PICKUP', { name: cmd.item, qty: cmd.qty ?? 1 });
    runner._step();
  },

  remove_item(runner, cmd) {
    const qty = cmd.qty ?? 1;
    for (let i = 0; i < qty; i++) store.commit('bag/USE_ITEM', cmd.item);
    runner._step();
  },

  if_has_item(runner, cmd) {
    const bag = store.state.bag;
    const found = bag.items.some(e => e.name === cmd.item) ||
                  bag.pokeballs.some(e => e.name === cmd.item) ||
                  bag.tms.some(e => e.name === cmd.item) ||
                  bag.keyItems.some(e => e.name === cmd.item);
    if (runner._debug()) console.log(`[ScriptRunner] if_has_item — item: "${cmd.item}" → ${found ? 'pass' : 'fail'}`);
    runner._branch(found ? (cmd.then ?? []) : (cmd.else ?? []));
  },
};
