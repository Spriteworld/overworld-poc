import store from '../../store/index.js';

export default {
  set_flag(runner, cmd) {
    store.commit('game/PATCH_FLAGS', { [cmd.key]: !!cmd.value });
    runner._step();
  },

  if_flag(runner, cmd) {
    const flagVal    = store.state.game.gameFlags[cmd.key];
    const comparison = cmd.comparison ?? 'eq';
    const targets    = Array.isArray(cmd.value) ? cmd.value : (cmd.value != null ? [cmd.value] : []);
    const coerce     = v => { if (v === 'true') return true; if (v === 'false') return false; return v; };
    let pass;
    if (comparison === 'in')       pass = targets.some(t  => flagVal == coerce(t));  // eslint-disable-line eqeqeq
    else if (comparison === 'nin') pass = targets.every(t => flagVal != coerce(t));  // eslint-disable-line eqeqeq
    else {
      const target = coerce(targets[0] ?? true);
      // eslint-disable-next-line eqeqeq
      pass = comparison === 'neq' ? flagVal != target : flagVal == target;
    }
    if (runner._debug()) console.log(`[ScriptRunner] if_flag — key: "${cmd.key}" (=${JSON.stringify(flagVal)}) ${comparison} ${JSON.stringify(targets)} → ${pass ? 'pass' : 'fail'}`);
    runner._branch(pass ? (cmd.then ?? []) : (cmd.else ?? []));
  },
};
