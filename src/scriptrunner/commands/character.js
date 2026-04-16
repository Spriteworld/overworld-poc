const EXCLAIM_ANIM_KEY = 'trainer-spotted';

function resolveChar(scene, name) {
  return scene.characters?.get(name) ?? scene.characters?.get('npc_' + name);
}

export default {
  look(runner, cmd) {
    const char = resolveChar(runner._scene, cmd.target ?? 'player');
    if (char) {
      char.look(cmd.direction);
    } else {
      console.warn(`[ScriptRunner] look: character "${cmd.target ?? 'player'}" not found`);
    }
    runner._step();
  },

  face_char(runner, cmd) {
    const char1   = resolveChar(runner._scene, cmd.character1);
    const char2pos = runner._scene.gridEngine?.getPosition(cmd.character2)
                  ?? runner._scene.gridEngine?.getPosition('npc_' + cmd.character2);
    if (char1 && char2pos) {
      const char1pos = runner._scene.gridEngine.getPosition(char1.config.id);
      const dx = char2pos.x - char1pos.x;
      const dy = char2pos.y - char1pos.y;
      const dir = Math.abs(dx) >= Math.abs(dy)
        ? (dx >= 0 ? 'right' : 'left')
        : (dy >= 0 ? 'down' : 'up');
      char1.look(dir);
    } else {
      console.warn(`[ScriptRunner] face_char: could not resolve "${cmd.character1}" or "${cmd.character2}"`);
    }
    runner._step();
  },

  movement_behavior(runner, cmd) {
    console.log('movement_behavior command:', cmd);
    const npc = resolveChar(runner._scene, cmd.character1);
    if (npc) {
      npc.setMovementBehavior(cmd.value, cmd.character2 ?? 'none');
    } else {
      console.warn(`[ScriptRunner] movement_behavior: character "${cmd.character1}" not found`);
    }
    runner._step();
  },

  show_exclamation(runner, cmd) {
    const char = runner._scene.characters?.get(cmd.target ?? 'player');
    if (!char) { runner._step(); return; }
    if (!runner._scene.anims.exists(EXCLAIM_ANIM_KEY)) {
      runner._scene.anims.create({
        key:       EXCLAIM_ANIM_KEY,
        frames:    runner._scene.anims.generateFrameNumbers('animation', { start: 13, end: 16 }),
        frameRate: 10,
      });
    }
    const ex = runner._scene.add.sprite(
      char.x + char.width / 2,
      char.y - 2,
      'animation',
      13,
    ).setDepth(9999).setOrigin(0.5, 1);
    ex.play(EXCLAIM_ANIM_KEY);
    runner._scene.time.delayedCall(700, () => {
      ex.destroy();
      runner._step();
    });
  },

  knockback(runner, cmd) {
    const targetId = cmd.target ?? 'player';
    if (!runner._scene.gridEngine) { runner._step(); return; }
    const pos = runner._scene.gridEngine.getPosition(targetId);
    if (!pos) { runner._step(); return; }
    const { dx, dy } = runner._resolveKnockbackDirection(cmd.direction ?? 'away_from_player', targetId, cmd.source);
    const tiles = cmd.tiles ?? 1;
    const dest  = { x: pos.x + dx * tiles, y: pos.y + dy * tiles };
    runner._scene.gridEngine.setPosition(targetId, dest);
    runner._step();
  },
};
