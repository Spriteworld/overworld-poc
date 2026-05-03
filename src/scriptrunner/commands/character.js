import { safeSetPosition } from '../../utilities/safeSetPosition.js';

const EXCLAIM_ANIM_KEY = 'trainer-spotted';

function resolveChar(scene, name) {
  return scene.characters?.get(name) ?? scene.characters?.get('npc_' + name);
}

/**
 * True if gridEngine either isn't initialized yet (tests / pre-ge_init) or
 * knows about this character. Used to gate gridEngine calls that would
 * otherwise throw "Character unknown" when a sprite was removed mid-script.
 */
function geKnows(scene, id) {
  const ge = scene.gridEngine;
  return !ge || ge.hasCharacter(id);
}

export default {
  look(runner, cmd) {
    const char = resolveChar(runner._scene, cmd.target ?? 'player');
    if (char && geKnows(runner._scene, char.config.id)) {
      char.look(cmd.direction);
    } else {
      console.warn(`[ScriptRunner] look: character "${cmd.target ?? 'player'}" not found`);
    }
    runner._step();
  },

  face_char(runner, cmd) {
    const char1 = resolveChar(runner._scene, cmd.character1);
    const ge    = runner._scene.gridEngine;
    // Resolve char2's id for position lookup (with or without npc_ prefix).
    const char2Id = !ge
      ? cmd.character2
      : (ge.hasCharacter(cmd.character2)
        ? cmd.character2
        : (ge.hasCharacter('npc_' + cmd.character2) ? 'npc_' + cmd.character2 : null));
    const char1Ok = char1 && geKnows(runner._scene, char1.config.id);
    if (char1Ok && char2Id && ge) {
      const char1pos = ge.getPosition(char1.config.id);
      const char2pos = ge.getPosition(char2Id);
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
      const target = cmd.value === 'follow'
        ? (cmd.character2 ?? 'player')
        : (cmd.character2 ?? 'none');
      npc.setMovementBehavior(cmd.value, target);
    } else {
      console.warn(`[ScriptRunner] movement_behavior: character "${cmd.character1}" not found`);
    }
    runner._step();
  },

  show_exclamation(runner, cmd) {
    const targetId = cmd.target ?? 'player';
    const char = runner._scene.characters?.get(targetId)
              ?? runner._scene.characters?.get('npc_' + targetId);
    if (!char || !geKnows(runner._scene, char.config.id)) { runner._step(); return; }
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
    if (!runner._scene.gridEngine || !geKnows(runner._scene, targetId)) { runner._step(); return; }
    const pos = runner._scene.gridEngine.getPosition(targetId);
    if (!pos) { runner._step(); return; }
    const { dx, dy } = runner._resolveKnockbackDirection(cmd.direction ?? 'away_from_player', targetId, cmd.source);
    const tiles = cmd.tiles ?? 1;
    const dest  = { x: pos.x + dx * tiles, y: pos.y + dy * tiles };
    const char = resolveChar(runner._scene, targetId);
    safeSetPosition(runner._scene, targetId, dest, undefined, { sprite: char })
      .then(() => runner._step());
  },
};
