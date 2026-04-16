import store from '../../store/index.js';
import ScriptRunner from '../../utilities/ScriptRunner.js';
import { checkOnlyIf } from '@Utilities';

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

    const objs = [
      ...this.scene.findInteractions('trigger'),
      ...this.scene.findInteractions('on-interact').map(o => ({ ...o, _forceInteract: true })),
    ];
    if (!objs.length) return;

    for (const obj of objs) {
      const script = this.scene.getPropertyFromTile(obj, 'script');
      if (!script) continue;

      // script is a Tiled list property (array), but accept a JSON string too.
      let commands;
      if (Array.isArray(script)) {
        commands = script;
      } else {
        try {
          commands = JSON.parse(script);
        } catch (e) {
          console.warn(`[Script] Invalid JSON for object "${obj.name}":`, e.message);
          continue;
        }
      }
      if (!Array.isArray(commands)) {
        console.warn(`[Script] Script for object "${obj.name}" must be a JSON array.`);
        continue;
      }

      const once    = !!this.scene.getPropertyFromTile(obj, 'once');
      const trigger = obj._forceInteract ? 'interact' : (this.scene.getPropertyFromTile(obj, 'trigger') ?? 'interact');
      const onlyIf  = this.scene.getPropertyFromTile(obj, 'only_if') ?? null;

      // Register as interactive tile (visible debug outline uses purple).
      this.scene.interactTile(this.scene.game.config.tilemap, obj, 0x9040d0);

      this._entries.push({ obj, commands, once, trigger, onlyIf });
    }

    // ── map-settings script ──────────────────────────────────────────────────
    const mapProps     = this.scene.config?.map?.properties ?? [];
    const mapSettings  = mapProps.find(p => p.name === 'map-settings')?.value;
    const mapScript    = mapSettings?.script;
    if (mapScript?.trigger && Array.isArray(mapScript.script) && mapScript.script.length) {
      this._entries.push({
        obj:      { name: 'map_settings_script' },
        commands: mapScript.script,
        once:     false,
        trigger:  mapScript.trigger,
        onlyIf:   null,
      });
    }
  }

  event() {
    // ── Interact trigger ────────────────────────────────────────────────────
    this._onInteract = (tile) => {
      if (tile.obj.type !== 'trigger' && tile.obj.type !== 'on-interact') return;
      const entry = this._entries.find(e => e.obj === tile.obj && e.trigger === 'interact');
      if (!entry) return;
      this._run(entry);
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    // ── Enter trigger ───────────────────────────────────────────────────────
    const enterEntries = this._entries.filter(e => e.trigger === 'enter');
    if (enterEntries.length && this.scene.gridEngine) {
      this._enterSub = this.scene.gridEngine
        .positionChangeStarted()
        .subscribe(({ charId, enterTile }) => {
          if (charId !== 'player') return;
          for (const entry of enterEntries) {
            const tx = Math.floor(entry.obj.x / 32);
            const ty = Math.floor(entry.obj.y / 32);
            const tw = Math.max(1, Math.floor((entry.obj.width  ?? 32) / 32));
            const th = Math.max(1, Math.floor((entry.obj.height ?? 32) / 32));
            if (enterTile.x >= tx && enterTile.x < tx + tw &&
                enterTile.y >= ty && enterTile.y < ty + th) {
              this._run(entry);
            }
          }
        });
    }

    // ── Map-enter trigger ─────────────────────────────────────────────────
    // Run immediately — event() is only called after GridEngine is fully
    // initialised (ge_init = true), so no extra deferral is needed.
    // Running now (before the first render) ensures scripts execute while
    // the camera fade-in overlay is still opaque.
    const mapEnterEntries = this._entries.filter(e => e.trigger === 'map_enter');
    for (const entry of mapEnterEntries) {
      this._run(entry);
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
    if (!checkOnlyIf(entry.onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {})) return;
    if (entry.once) {
      const flag = `script_done_${entry.obj.name}`;
      if (store.state.game.gameFlags[flag]) return;
      store.commit('game/PATCH_FLAGS', { [flag]: true });
    }
    new ScriptRunner(this.scene, [...entry.commands]).run();
  }
}
