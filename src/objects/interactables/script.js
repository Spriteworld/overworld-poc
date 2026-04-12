import store from '../../store/index.js';
import ScriptRunner from '../../utilities/ScriptRunner.js';

/**
 * Script interactable plugin.
 *
 * Scans the `interactions` object layer for objects of type `scriptable`.
 * Each scriptable object must have a `script` custom property containing a
 * JSON array of command objects (see docs/scriptables.md for the full reference).
 *
 * Additional object-level properties:
 *   once    (boolean) — if true, the script runs only once per save.
 *                       Completion is recorded as `script_done_<name>` in gameFlags.
 *   trigger (string)  — "interact" (default) fires on player press-Z;
 *                       "enter" fires when the player steps onto the object's tile.
 */
export default class Script {
  constructor(scene) {
    this.scene      = scene;
    this._entries   = []; // { obj, commands, once, trigger }
    this._onInteract = null;
    this._enterSub  = null;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::script');
    }

    const objs = this.scene.findInteractions('scriptable');
    if (!objs.length) return;

    for (const obj of objs) {
      const scriptText = this.scene.getPropertyFromTile(obj, 'script');
      if (!scriptText) continue;

      let commands;
      try {
        commands = JSON.parse(scriptText);
      } catch (e) {
        console.warn(`[Script] Invalid JSON for object "${obj.name}":`, e.message);
        continue;
      }
      if (!Array.isArray(commands)) {
        console.warn(`[Script] Script for object "${obj.name}" must be a JSON array.`);
        continue;
      }

      const once    = !!this.scene.getPropertyFromTile(obj, 'once');
      const trigger = this.scene.getPropertyFromTile(obj, 'trigger') ?? 'interact';

      // Register as interactive tile (visible debug outline uses purple).
      this.scene.interactTile(this.scene.game.config.tilemap, obj, 0x9040d0);

      this._entries.push({ obj, commands, once, trigger });
    }
  }

  event() {
    // ── Interact trigger ────────────────────────────────────────────────────
    this._onInteract = (tile) => {
      if (tile.obj.type !== 'scriptable') return;
      const entry = this._entries.find(e => e.obj === tile.obj && e.trigger === 'interact');
      if (!entry) return;
      this._run(entry);
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    // ── Enter trigger ───────────────────────────────────────────────────────
    const enterEntries = this._entries.filter(e => e.trigger === 'enter');
    if (enterEntries.length && this.scene.gridEngine) {
      this._enterSub = this.scene.gridEngine
        .positionChangeFinished()
        .subscribe(({ charId, toPosition }) => {
          if (charId !== 'player') return;
          for (const entry of enterEntries) {
            const tx = Math.floor(entry.obj.x / 32);
            const ty = Math.floor(entry.obj.y / 32);
            if (toPosition.x === tx && toPosition.y === ty) {
              this._run(entry);
            }
          }
        });
    }
  }

  update() {}

  destroy() {
    if (this._onInteract) {
      this.scene.game.events.off('interact-with-obj', this._onInteract);
    }
    this._enterSub?.unsubscribe();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _run(entry) {
    if (entry.once) {
      const flag = `script_done_${entry.obj.name}`;
      if (store.state.game.gameFlags[flag]) return;
      store.commit('game/PATCH_FLAGS', { [flag]: true });
    }
    new ScriptRunner(this.scene, [...entry.commands]).run();
  }
}
