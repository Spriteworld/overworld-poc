export default {
  camera_pan(runner, cmd) {
    let panX, panY;
    if (cmd.anchor) {
      const anchor = runner._resolveAnchor(cmd.anchor);
      if (!anchor) { runner._step(); return; }
      panX = anchor.x * 32 + 16;
      panY = anchor.y * 32 + 16;
    } else {
      panX = (cmd.x ?? 0) * 32 + 16;
      panY = (cmd.y ?? 0) * 32 + 16;
    }
    runner._scene.cameras.main.pan(panX, panY, cmd.duration ?? 500, 'Linear', false, (cam, progress) => {
      if (progress === 1) runner._step();
    });
  },

  camera_follow_player(runner) {
    const player = runner._scene.characters?.get('player');
    if (player) {
      runner._scene.cameras.main.startFollow(player, true, 1);
      runner._scene.cameras.main.setFollowOffset(-(player.width / 2), -(player.height / 2));
    }
    runner._step();
  },

  camera_follow_npc(runner, cmd) {
    const npc = runner._scene.characters?.get(cmd.name)
             ?? runner._scene.characters?.get('npc_' + cmd.name);
    const ge  = runner._scene.gridEngine;
    if (npc && (!ge || ge.hasCharacter(npc.config.id))) {
      runner._scene.cameras.main.startFollow(npc, true, 1);
      runner._scene.cameras.main.setFollowOffset(-(npc.width / 2), -(npc.height / 2));
    } else {
      console.warn(`[ScriptRunner] camera_follow_npc: character "${cmd.name}" not found`);
    }
    runner._step();
  },

  fade_out(runner, cmd) {
    runner._scene.cameras.main.fadeOut(cmd.duration ?? 500, 0, 0, 0);
    runner._scene.cameras.main.once('camerafadeoutcomplete', () => runner._step());
  },

  fade_in(runner, cmd) {
    runner._scene.cameras.main.fadeIn(cmd.duration ?? 500, 0, 0, 0);
    runner._scene.cameras.main.once('camerafadeincomplete', () => runner._step());
  },
};
