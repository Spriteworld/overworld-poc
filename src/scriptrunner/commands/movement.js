import store from '../../store/index.js';

function resolveChar(scene, name) {
  return scene.characters?.get(name) ?? scene.characters?.get('npc_' + name);
}

/**
 * True if gridEngine either isn't initialized yet or knows about this character.
 * Gates gridEngine calls that would otherwise throw "Character unknown".
 */
function geKnows(scene, id) {
  const ge = scene.gridEngine;
  return !ge || ge.hasCharacter(id);
}

export default {
  move_player(runner, cmd) {
    const player = runner._scene.characters?.get('player');
    if (!player || !runner._scene.gridEngine || !geKnows(runner._scene, 'player')) { runner._step(); return; }
    runner._scene.gridEngine.setSpeed('player', 4);
    if (cmd.path?.length) {
      runner._walkPath('player', player, [...cmd.path], null);
    } else {
      const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
      const target = anchor ?? { x: cmd.x, y: cmd.y };
      if (target.x == null || target.y == null) {
        console.warn(`[ScriptRunner] move_player: could not resolve target (anchor="${cmd.anchor}", x=${cmd.x}, y=${cmd.y}) — skipping`);
        runner._step();
        return;
      }
      const sub = runner._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
        if (charId !== 'player') return;
        if (enterTile.x === target.x && enterTile.y === target.y) {
          sub.unsubscribe();
          if (anchor?.facingDir) player.look?.(anchor.facingDir);
          runner._step();
        }
      });
      player.moveTo(target, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
    }
  },

  move_npc(runner, cmd) {
    const npc = resolveChar(runner._scene, cmd.character);
    if (!npc || !runner._scene.gridEngine || !geKnows(runner._scene, npc.config.id)) { runner._step(); return; }
    const npcCharId = npc.config.id;
    if (cmd.path?.length) {
      runner._walkPath(npcCharId, npc, [...cmd.path], null);
    } else {
      const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
      const target = anchor ?? { x: cmd.x, y: cmd.y };
      if (target.x == null || target.y == null) {
        console.warn(`[ScriptRunner] move_npc: could not resolve target (anchor="${cmd.anchor}", x=${cmd.x}, y=${cmd.y}) — skipping`);
        runner._step();
        return;
      }
      const noPathStrategy = cmd.strategy ?? 'CLOSEST_REACHABLE';
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        moveSub.unsubscribe();
        stopSub.unsubscribe();
        if (anchor?.facingDir) npc.look?.(anchor.facingDir);
        runner._step();
      };
      const moveSub = runner._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
        if (charId !== npcCharId) return;
        if (enterTile.x === target.x && enterTile.y === target.y) settle();
      });
      const stopSub = runner._scene.gridEngine.movementStopped().subscribe(({ charId }) => {
        if (charId === npcCharId) settle();
      });
      npc.moveTo(target, { noPathFoundStrategy: noPathStrategy, pathBlockedStrategy: 'WAIT' });
    }
  },

  walk_to_char(runner, cmd) {
    const char1 = resolveChar(runner._scene, cmd.character1);
    if (!char1 || !runner._scene.gridEngine || !geKnows(runner._scene, char1.config.id)) {
      if (runner._debug()) console.warn(`[ScriptRunner] walk_to_char: character1 "${cmd.character1}" not found`);
      runner._step();
      return;
    }
    const char2GridId = runner._scene.gridEngine.hasCharacter(cmd.character2)
      ? cmd.character2
      : (runner._scene.gridEngine.hasCharacter('npc_' + cmd.character2) ? 'npc_' + cmd.character2 : null);
    const char2pos = char2GridId ? runner._scene.gridEngine.getPosition(char2GridId) : null;
    if (!char2pos) {
      if (runner._debug()) console.warn(`[ScriptRunner] walk_to_char: character2 "${cmd.character2}" not found`);
      runner._step();
      return;
    }
    const { dx, dy } = runner._dirToDelta(cmd.side);
    const target = { x: char2pos.x + dx, y: char2pos.y + dy };
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const arrivalFacing = opposites[cmd.side?.toLowerCase()] ?? null;
    const currentPos = runner._scene.gridEngine.getPosition(char1.config.id);
    if (currentPos && currentPos.x === target.x && currentPos.y === target.y) {
      if (arrivalFacing) char1.look?.(arrivalFacing);
      runner._step();
      return;
    }
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      moveSub.unsubscribe();
      stopSub.unsubscribe();
      if (arrivalFacing) char1.look?.(arrivalFacing);
      runner._step();
    };
    const charId = char1.config.id;
    const moveSub = runner._scene.gridEngine.positionChangeFinished().subscribe(({ charId: id, enterTile }) => {
      if (id !== charId) return;
      if (enterTile.x === target.x && enterTile.y === target.y) settle();
    });
    const stopSub = runner._scene.gridEngine.movementStopped().subscribe(({ charId: id }) => {
      if (id === charId) settle();
    });
    runner._scene.gridEngine.stopMovement(charId);
    char1.moveTo(target, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
  },

  warp_npc(runner, cmd) {
    const warpNpc = resolveChar(runner._scene, cmd.character);
    if (!warpNpc || !runner._scene.gridEngine || !geKnows(runner._scene, warpNpc.config.id)) {
      console.warn(`[ScriptRunner] warp_npc: character "${cmd.character}" not found`);
      runner._step();
      return;
    }
    const npcId    = warpNpc.config.id;
    const npcLayer = runner._scene.gridEngine.getCharLayer(npcId) ?? 'ground';
    const dest     = cmd.anchor
      ? (() => { const a = runner._resolveAnchor(cmd.anchor); return a ? { x: a.x, y: a.y } : null; })()
      : { x: cmd.x ?? 0, y: cmd.y ?? 0 };
    if (dest) {
      runner._scene.gridEngine.setPosition(npcId, dest, npcLayer);
      warpNpc.setVisible(true);
      warpNpc.look(warpNpc.getFacingDirection());
    } else {
      console.warn(`[ScriptRunner] warp_npc: anchor "${cmd.anchor}" not found`);
    }
    runner._step();
  },

  warp_player(runner, cmd) {
    const player = runner._scene.characters?.get('player');
    store.commit('game/SET_PLAYER_FACING', player?.getFacingDirection() ?? 'down');
    player?.disableMovement?.();
    runner._scene.registry.set('map', cmd.map);
    runner._scene.game.events.emit('script-runner-end');
    runner._scene.cameras.main.fadeOut(500, 0, 0, 0);
    runner._scene.cameras.main.once('camerafadeoutcomplete', () => {
      const params = cmd.anchor
        ? { warpLocationName: cmd.anchor }
        : { playerLocation: { x: cmd.x ?? 0, y: cmd.y ?? 0, charLayer: cmd.layer ?? 'ground' } };
      runner._startScene(cmd.map, params);
    });
    // no _step() — scene is changing
  },

  walk_warp_continue(runner, cmd) {
    const targetId = cmd.target ?? 'player';
    const char     = resolveChar(runner._scene, targetId);

    const doWarp = () => {
      const player = runner._scene.characters?.get('player');
      store.commit('game/SET_PLAYER_FACING', player?.getFacingDirection() ?? 'down');
      player?.disableMovement?.();
      runner._scene.registry.set('map', cmd.map);
      runner._scene.game.events.emit('script-runner-end');
      const params = cmd.anchor
        ? { warpLocationName: cmd.anchor }
        : { playerLocation: { x: cmd.x ?? 0, y: cmd.y ?? 0, charLayer: cmd.layer ?? 'ground' } };
      runner._scene.cameras.main.fadeOut(500, 0, 0, 0);
      runner._scene.cameras.main.once('camerafadeoutcomplete', () => runner._startScene(cmd.map, params));
    };

    const hasWalkTarget = cmd.walk_x != null && cmd.walk_y != null;
    if (!hasWalkTarget || !char || !runner._scene.gridEngine || !geKnows(runner._scene, char.config.id)) { doWarp(); return; }

    const dest    = { x: cmd.walk_x, y: cmd.walk_y };
    const current = runner._scene.gridEngine.getPosition(char.config.id);
    if (current && current.x === dest.x && current.y === dest.y) { doWarp(); return; }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      moveSub.unsubscribe();
      stopSub.unsubscribe();
      doWarp();
    };
    const moveSub = runner._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
      if (charId !== char.config.id) return;
      if (enterTile.x === dest.x && enterTile.y === dest.y) settle();
    });
    const stopSub = runner._scene.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === char.config.id) settle();
    });
    char.moveTo(dest, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
    // no _step() — scene is changing
  },

  teleport_to_pokecenter(runner) {
    const healLoc = store.state.game.healLocation
      ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
    const player = runner._scene.characters?.get('player');
    store.commit('game/SET_PLAYER_FACING', 'down');
    player?.disableMovement?.();
    runner._scene.registry.set('map', healLoc.map);
    runner._scene.game.events.emit('script-runner-end');
    runner._scene.cameras.main.fadeOut(500, 0, 0, 0);
    runner._scene.cameras.main.once('camerafadeoutcomplete', () => {
      runner._startScene(healLoc.map, { playerLocation: healLoc });
    });
  },

  escape_rope(runner) {
    const outdoor = store.state.game.lastOutdoorLocation
      ?? store.state.game.healLocation
      ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
    const player = runner._scene.characters?.get('player');
    store.commit('game/SET_PLAYER_FACING', 'down');
    player?.disableMovement?.();
    runner._scene.registry.set('map', outdoor.map);
    runner._scene.game.events.emit('script-runner-end');
    runner._scene.cameras.main.fadeOut(500, 0, 0, 0);
    runner._scene.cameras.main.once('camerafadeoutcomplete', () => {
      runner._startScene(outdoor.map, { playerLocation: outdoor });
    });
  },
};
