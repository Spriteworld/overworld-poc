import { normalize, validate } from './normalize.js';
import dialogueCmds  from './commands/dialogue.js';
import itemCmds      from './commands/items.js';
import flagCmds      from './commands/flags.js';
import pokemonCmds   from './commands/pokemon.js';
import inputCmds     from './commands/input.js';
import movementCmds  from './commands/movement.js';
import spawnCmds     from './commands/spawn.js';
import variableCmds  from './commands/variables.js';
import cameraCmds    from './commands/camera.js';
import audioCmds     from './commands/audio.js';
import characterCmds from './commands/character.js';
import battleCmds    from './commands/battle.js';

const HANDLERS = {
  ...dialogueCmds,
  ...itemCmds,
  ...flagCmds,
  ...pokemonCmds,
  ...inputCmds,
  ...movementCmds,
  ...spawnCmds,
  ...variableCmds,
  ...cameraCmds,
  ...audioCmds,
  ...characterCmds,
  ...battleCmds,
};

/**
 * Executes a JSON script — an array of command objects — sequentially.
 * Commands that involve user interaction (text, yes_no, wait_input) pause
 * execution until the interaction completes, then continue automatically.
 *
 * Branching commands (yes_no, if_flag, if_var) prepend the chosen branch's
 * commands to the front of the remaining queue, so the main sequence
 * continues after the branch finishes.
 *
 * Usage:
 *   new ScriptRunner(mapScene, commands).run();
 *   new ScriptRunner(mapScene, commands).run(() => console.log('done'));
 *
 * @param {Phaser.Scene} scene    - The active map scene (NOT OverworldUI).
 * @param {object[]}     commands - Parsed command array from the script property.
 */
export default class ScriptRunner {
  constructor(scene, commands) {
    this._scene  = scene;
    this._queue  = normalize(commands);
    this._onDone        = null;
    this._inspectorText = null;
    if (!this._scene.mapVars) this._scene.mapVars = {};
  }

  static normalize = normalize;
  static validate  = validate;

  run(onDone) {
    this._onDone = onDone ?? null;
    if (this._debug()) {
      const warnings = validate(this._queue);
      if (warnings.length) {
        console.warn('[ScriptRunner] Validation warnings:', warnings);
      }
    }
    this._scene._activeScriptRunner = this;
    this._scene.game.events.emit('script-runner-start');
    if (this._debug()) console.log('[ScriptRunner] start — queue:', this._queue.map(c => c.cmd));
    this._step();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _step() {
    if (!this._queue.length) {
      if (this._inspectorText) {
        this._inspectorText.destroy();
        this._inspectorText = null;
      }
      if (this._debug()) console.log('[ScriptRunner] done');
      delete this._scene._activeScriptRunner;
      this._scene.game.events.emit('script-runner-end');
      this._onDone?.();
      return;
    }
    this._exec(this._queue.shift());
  }

  /** Prepend `cmds` to the front of the remaining queue, then continue. */
  _branch(cmds) {
    this._queue.unshift(...cmds);
    this._step();
  }

  _exec(cmd) {
    if (this._debug()) {
      const label = `[Script] ${cmd.cmd}  (${this._queue.length} remaining)`;
      if (!this._inspectorText) {
        this._inspectorText = this._scene.add.text(8, 8, label, {
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#000000cc',
          padding: { x: 4, y: 2 },
        }).setScrollFactor(0).setDepth(99999);
      } else {
        this._inspectorText.setText(label);
      }
    }
    if (this._debug()) console.log('[ScriptRunner] exec:', cmd.cmd, cmd);

    const handler = HANDLERS[cmd.cmd];
    if (handler) {
      handler(this, cmd);
    } else {
      console.warn(`[ScriptRunner] Unknown command "${cmd.cmd}" — skipping.`, cmd);
      this._step();
    }
  }

  // ─── Helpers (used by command handlers via runner._*) ─────────────────────

  /**
   * Walk a character through an ordered list of direction strings one tile at
   * a time. Advances to the next step when the character lands on each tile.
   */
  _walkPath(charId, char, steps, finalAnchor) {
    const ge = this._scene.gridEngine;
    const known = !ge || ge.hasCharacter(charId);
    if (!steps.length) {
      if (finalAnchor?.facingDir && known) char.look?.(finalAnchor.facingDir);
      this._step();
      return;
    }
    if (!ge || !known) {
      this._step();
      return;
    }
    const dir = steps.shift();
    const { dx, dy } = this._dirToDelta(dir);
    const pos  = ge.getPosition(charId);
    const dest = { x: pos.x + dx, y: pos.y + dy };

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      sub1.unsubscribe();
      sub2.unsubscribe();
      this._walkPath(charId, char, steps, finalAnchor);
    };

    const sub1 = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId: id, enterTile }) => {
      if (id !== charId) return;
      if (enterTile.x === dest.x && enterTile.y === dest.y) settle();
    });
    const sub2 = this._scene.gridEngine.movementStopped().subscribe(({ charId: id }) => {
      if (id === charId) settle();
    });

    char.moveTo(dest, { noPathFoundStrategy: 'STOP', pathBlockedStrategy: 'STOP' });
  }

  /** Convert a direction string to a {dx, dy} unit vector. */
  _dirToDelta(dir) {
    switch (dir?.toLowerCase()) {
      case 'up':    return { dx:  0, dy: -1 };
      case 'down':  return { dx:  0, dy:  1 };
      case 'left':  return { dx: -1, dy:  0 };
      case 'right': return { dx:  1, dy:  0 };
      default:      return { dx:  0, dy:  0 };
    }
  }

  /**
   * Find a `location-anchor` object by name on the interactions layer.
   * @returns {{ x: number, y: number, facingDir: string|null }|null}
   */
  _resolveAnchor(name) {
    const tilemap = this._scene.config?.tilemap;
    if (!tilemap) return null;
    const results = tilemap.filterObjects('interactions', obj => obj.name === name);
    const obj = results?.[0];
    if (!obj) {
      console.warn(`[ScriptRunner] anchor "${name}" not found`);
      return null;
    }
    const facingDir = this._scene.getPropertyFromTile?.(obj, 'facing-direction') ?? null;
    return { x: Math.floor(obj.x / 32), y: Math.floor(obj.y / 32), facingDir };
  }

  /**
   * Resolve a knockback direction string to a {dx, dy} unit vector.
   */
  _resolveKnockbackDirection(direction, targetId, sourceId) {
    if (direction === 'up')    return { dx:  0, dy: -1 };
    if (direction === 'down')  return { dx:  0, dy:  1 };
    if (direction === 'left')  return { dx: -1, dy:  0 };
    if (direction === 'right') return { dx:  1, dy:  0 };

    const srcId  = direction === 'away_from_npc' ? (sourceId ?? 'player') : 'player';
    const srcPos = this._scene.gridEngine?.getPosition(srcId);
    const tgtPos = this._scene.gridEngine?.getPosition(targetId);
    if (!srcPos || !tgtPos) return { dx: 0, dy: 0 };

    const diffX = tgtPos.x - srcPos.x;
    const diffY = tgtPos.y - srcPos.y;
    if (Math.abs(diffX) >= Math.abs(diffY)) {
      return { dx: diffX >= 0 ? 1 : -1, dy: 0 };
    }
    return { dx: 0, dy: diffY >= 0 ? 1 : -1 };
  }

  /**
   * Start a new Phaser scene, forwarding any remaining queued commands as
   * `_pendingScript` so they resume in the destination scene.
   */
  _startScene(mapKey, params) {
    if (this._queue.length) {
      params._pendingScript = [...this._queue];
      this._queue.length = 0;
    }
    this._scene.scene.start(mapKey, params);
  }

  _debug() {
    return !!this._scene?.game?.config?.debug?.console?.scriptRunner;
  }
}
