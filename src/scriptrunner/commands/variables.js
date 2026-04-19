import store from '../../store/index.js';

export default {
  set_var(runner, cmd) {
    runner._scene.mapVars[cmd.key] = cmd.value;
    store.commit('game/SET_MAP_VAR', { map: runner._scene.sys.settings.key, key: cmd.key, value: cmd.value });
    if (runner._debug()) console.log(`[ScriptRunner] set_var — key: "${cmd.key}", value: ${JSON.stringify(cmd.value)}`);
    runner._step();
  },

  if_var(runner, cmd) {
    let varVal = runner._scene.mapVars[cmd.key];
    if (varVal === 'true')  varVal = true;
    if (varVal === 'false') varVal = false;
    const varCmp  = cmd.comparison ?? 'eq';
    const targets = Array.isArray(cmd.value) ? cmd.value : (cmd.value != null ? [cmd.value] : []);
    let varMatch;
    // eslint-disable-next-line eqeqeq
    if (varCmp === 'in')       varMatch = targets.some(t  => varVal == t);
    // eslint-disable-next-line eqeqeq
    else if (varCmp === 'nin') varMatch = targets.every(t => varVal != t);
    else {
      let varTarget = targets[0] ?? null;
      if (varTarget === 'true')  varTarget = true;
      if (varTarget === 'false') varTarget = false;
      // eslint-disable-next-line eqeqeq
      varMatch = varCmp === 'neq' ? varVal != varTarget : varVal == varTarget;
    }
    if (runner._debug()) console.log(`[ScriptRunner] if_var — key: "${cmd.key}", comparison: "${varCmp}", targets: ${JSON.stringify(targets)}, actual: ${JSON.stringify(varVal)} → ${varMatch ? 'pass' : 'fail'}`);
    runner._branch(varMatch ? (cmd.then ?? []) : (cmd.else ?? []));
  },

  if_variant(runner, cmd) {
    const sceneVariant  = runner._scene.config?.variant ?? null;
    const variantValues = Array.isArray(cmd.value) ? cmd.value : [cmd.value];
    const variantCmp    = cmd.comparison ?? 'eq';
    const variantMatch  = variantCmp === 'neq'
      ? !variantValues.includes(sceneVariant)
      : variantValues.includes(sceneVariant);
    if (runner._debug()) console.log(`[ScriptRunner] if_variant — scene variant: "${sceneVariant}", ${variantCmp} ${JSON.stringify(variantValues)} → ${variantMatch ? 'pass' : 'fail'}`);
    runner._branch(variantMatch ? (cmd.then ?? []) : (cmd.else ?? []));
  },

  if_facing(runner, cmd) {
    const targetId = cmd.target ?? 'player';
    const char     = runner._scene.characters?.get(targetId);
    const facing   = char?.getFacingDirection?.()
      ?? runner._scene.gridEngine?.getFacingDirection?.(targetId)
      ?? null;
    const match = facing === cmd.direction;
    if (runner._debug()) console.log(`[ScriptRunner] if_facing — target: "${targetId}", facing: "${facing}", expected: "${cmd.direction}" → ${match ? 'pass' : 'fail'}`);
    runner._branch(match ? (cmd.then ?? []) : (cmd.else ?? []));
  },

  if_npc_at(runner, cmd) {
    const ge     = runner._scene.gridEngine;
    const geId   = ge?.hasCharacter(cmd.name)
      ? cmd.name
      : (ge?.hasCharacter('npc_' + cmd.name) ? 'npc_' + cmd.name : null);
    if (!geId) { runner._branch(cmd.else ?? []); return; }
    const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    const target = anchor ?? { x: cmd.x, y: cmd.y };
    const pos    = ge.getPosition(geId);
    const match  = pos != null && pos.x === target.x && pos.y === target.y;
    if (runner._debug()) console.log(`[ScriptRunner] if_npc_at — name: "${cmd.name}", pos: ${JSON.stringify(pos)}, target: ${JSON.stringify(target)} → ${match ? 'pass' : 'fail'}`);
    runner._branch(match ? (cmd.then ?? []) : (cmd.else ?? []));
  },
};
