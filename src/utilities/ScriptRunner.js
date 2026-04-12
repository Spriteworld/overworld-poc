import store from '../store/index.js';
import ChoicePrompt from './ChoicePrompt.js';
import { getInputManager, Action } from './InputManager.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';

// Lazy-load the species list once per session.
let _allSpec = null;
function getAllSpecies() {
  if (!_allSpec) _allSpec = new Pokedex(GAMES.POKEMON_FIRE_RED).pokedex;
  return _allSpec;
}

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
    this._queue  = [...commands];
    this._vars   = {};
    this._onDone = null;
  }

  run(onDone) {
    this._onDone = onDone ?? null;
    this._step();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _step() {
    if (!this._queue.length) {
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

  /**
   * Walk a character through an ordered list of direction strings one tile at
   * a time. Advances to the next step when the character lands on each tile.
   * If a tile is blocked, `movementStopped` fires and the step is skipped.
   *
   * @param {string}                charId  - GridEngine character id.
   * @param {MovableSprite}         char    - Character instance.
   * @param {string[]}              steps   - Remaining directions to walk.
   * @param {{ facingDir: string }|null} finalAnchor - Applied after last step.
   */
  _walkPath(charId, char, steps, finalAnchor) {
    if (!steps.length) {
      if (finalAnchor?.facingDir) char.look?.(finalAnchor.facingDir);
      this._step();
      return;
    }
    const dir = steps.shift();
    const { dx, dy } = this._dirToDelta(dir);
    const pos  = this._scene.gridEngine.getPosition(charId);
    const dest = { x: pos.x + dx, y: pos.y + dy };

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      sub1.unsubscribe();
      sub2.unsubscribe();
      this._walkPath(charId, char, steps, finalAnchor);
    };

    const sub1 = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId: id, toPosition }) => {
      if (id !== charId) return;
      if (toPosition.x === dest.x && toPosition.y === dest.y) settle();
    });
    // Fallback: if the tile is blocked, movementStopped fires — skip the step.
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
   * Find a `location-anchor` object by name on the interactions layer and
   * return its tile coordinates plus optional facing direction.
   *
   * @param {string} name - The Tiled object name of the anchor.
   * @returns {{ x: number, y: number, facingDir: string|null }|null}
   */
  _resolveAnchor(name) {
    const tilemap = this._scene.config?.tilemap;
    if (!tilemap) return null;
    const results = tilemap.filterObjects(
      'interactions',
      obj => obj.name === name && obj.type === 'location-anchor'
    );
    const obj = results?.[0];
    if (!obj) {
      console.warn(`[ScriptRunner] location-anchor "${name}" not found`);
      return null;
    }
    const facingDir = this._scene.getPropertyFromTile?.(obj, 'facing-direction') ?? null;
    return {
      x:         Math.floor(obj.x / 32),
      y:         Math.floor(obj.y / 32),
      facingDir,
    };
  }

  _exec(cmd) {
    switch (cmd.cmd) {

      // ── Text ──────────────────────────────────────────────────────────────

      case 'text': {
        const text = Array.isArray(cmd.text) ? cmd.text.join('\n') : String(cmd.text ?? '');
        this._scene.game.events.emit('textbox-changedata', text);
        this._scene.game.events.once('textbox-disable', () => this._step());
        break;
      }

      // ── Yes / No choice ───────────────────────────────────────────────────

      case 'yes_no': {
        const text = Array.isArray(cmd.text) ? cmd.text.join('\n') : String(cmd.text ?? '');
        this._scene.game.events.emit('textbox-changedata', text);
        this._scene.game.events.once('textbox-disable', () => {
          // Render choice prompt in OverworldUI (always-active UI scene).
          const uiScene = this._scene.scene.get('OverworldUI');
          new ChoicePrompt(uiScene ?? this._scene, ['YES', 'NO'], (idx) => {
            this._branch(idx === 0 ? (cmd.yes ?? []) : (cmd.no ?? []));
          });
        });
        break;
      }

      // ── Items ─────────────────────────────────────────────────────────────

      case 'give_item':
        store.commit('bag/PICKUP', { name: cmd.item, qty: cmd.qty ?? 1 });
        this._step();
        break;

      case 'remove_item': {
        const qty = cmd.qty ?? 1;
        for (let i = 0; i < qty; i++) store.commit('bag/USE_ITEM', cmd.item);
        this._step();
        break;
      }

      // ── Flags ─────────────────────────────────────────────────────────────

      case 'flag':
        store.commit('game/PATCH_FLAGS', { [cmd.key]: !!cmd.value });
        this._step();
        break;

      case 'if_flag': {
        const val = !!store.state.game.gameFlags[cmd.key];
        this._branch(val ? (cmd.then ?? []) : (cmd.else ?? []));
        break;
      }

      // ── Gift Pokémon ──────────────────────────────────────────────────────

      case 'give_pokemon': {
        const specInput = String(cmd.species ?? '');
        const allSpec   = getAllSpecies();
        const entry     = allSpec.find(p =>
          p.species?.toLowerCase() === specInput.toLowerCase() ||
          p.nat_dex_id === Number(specInput)
        );
        if (!entry) {
          console.warn(`[ScriptRunner] Unknown species: "${cmd.species}"`);
          this._step();
          break;
        }
        store.commit('party/ADD_POKEMON', {
          natDexId: entry.nat_dex_id,
          level:    cmd.level    ?? 5,
          nickname: cmd.nickname ?? null,
          shiny:    cmd.shiny    ?? false,
        });
        this._step();
        break;
      }

      // ── Player input ──────────────────────────────────────────────────────

      case 'enable_input':
        this._scene.registry.set('player_input', true);
        this._step();
        break;

      case 'disable_input':
        this._scene.registry.set('player_input', false);
        this._step();
        break;

      // ── Character movement ────────────────────────────────────────────────

      case 'move_player': {
        const player = this._scene.characters?.get('player');
        if (!player || !this._scene.gridEngine) { this._step(); break; }
        // Ensure GridEngine has a valid speed — moveOnUpdate is skipped when
        // player_input is disabled, so speed might never have been set.
        this._scene.gridEngine.setSpeed('player', 4);
        if (cmd.path?.length) {
          this._walkPath('player', player, [...cmd.path], null);
        } else {
          const anchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
          const target = anchor ?? { x: cmd.x, y: cmd.y };
          const sub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, toPosition }) => {
            if (charId !== 'player') return;
            if (toPosition.x === target.x && toPosition.y === target.y) {
              sub.unsubscribe();
              if (anchor?.facingDir) player.look?.(anchor.facingDir);
              this._step();
            }
          });
          player.moveTo(target, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
        }
        break;
      }

      case 'move_npc': {
        const npc = this._scene.characters?.get(cmd.name);
        if (!npc || !this._scene.gridEngine) { this._step(); break; }
        if (cmd.path?.length) {
          this._walkPath(cmd.name, npc, [...cmd.path], null);
        } else {
          const anchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
          const target = anchor ?? { x: cmd.x, y: cmd.y };
          const sub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, toPosition }) => {
            if (charId !== cmd.name) return;
            if (toPosition.x === target.x && toPosition.y === target.y) {
              sub.unsubscribe();
              if (anchor?.facingDir) npc.look?.(anchor.facingDir);
              this._step();
            }
          });
          npc.moveTo(target, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
        }
        break;
      }

      // ── Spawn NPC ─────────────────────────────────────────────────────────

      case 'spawn_npc': {
        const npcPlugin = this._scene.mapPlugins?.['npc'];
        if (!npcPlugin) { this._step(); break; }
        const anchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
        const coords = anchor ?? { x: cmd.x ?? 0, y: cmd.y ?? 0 };
        npcPlugin.addToScene(
          cmd.name,
          cmd.texture ?? '',
          coords,
          {
            'facing-direction': anchor?.facingDir ?? cmd.facing ?? 'down',
          },
        );
        this._step();
        break;
      }

      // ── Party management ──────────────────────────────────────────────────

      case 'move_to_box':
        store.commit('party/MOVE_TO_BOX', { slot: cmd.slot ?? 0 });
        this._step();
        break;

      case 'if_party_count': {
        const len  = store.state.party.list.length;
        const n    = cmd.count ?? 1;
        const ops  = { lt: len < n, lte: len <= n, eq: len === n, gte: len >= n, gt: len > n };
        const pass = ops[cmd.op ?? 'eq'] ?? false;
        this._branch(pass ? (cmd.then ?? []) : (cmd.else ?? []));
        break;
      }

      case 'teach_move': {
        const partyMon = store.state.party.list[cmd.slot ?? 0];
        if (!partyMon) { this._step(); break; }
        this._scene.game.events.once('overworld-teach-move-complete', () => this._step());
        this._scene.game.events.emit('overworld-teach-move', {
          pid:  partyMon.pid,
          move: cmd.move ?? '',
          pp:   cmd.pp   ?? 30,
        });
        break;
      }

      // ── World navigation ──────────────────────────────────────────────────

      case 'warp_player': {
        const wp = this._scene.characters?.get('player');
        store.commit('game/SET_PLAYER_FACING', wp?.getFacingDirection() ?? 'down');
        wp?.disableMovement?.();
        this._scene.registry.set('map', cmd.map);
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          const params = cmd.anchor
            ? { warpLocationName: cmd.anchor }
            : { playerLocation: { x: cmd.x ?? 0, y: cmd.y ?? 0, charLayer: cmd.layer ?? 'ground' } };
          this._scene.scene.start(cmd.map, params);
        });
        break; // no _step() — scene is changing
      }

      case 'teleport_to_pokecenter': {
        const healLoc = store.state.game.healLocation
          ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
        const tp = this._scene.characters?.get('player');
        store.commit('game/SET_PLAYER_FACING', 'down');
        tp?.disableMovement?.();
        this._scene.registry.set('map', healLoc.map);
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          this._scene.scene.start(healLoc.map, { playerLocation: healLoc });
        });
        break;
      }

      case 'escape_rope': {
        const outdoor = store.state.game.lastOutdoorLocation
          ?? store.state.game.healLocation
          ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
        const er = this._scene.characters?.get('player');
        store.commit('game/SET_PLAYER_FACING', 'down');
        er?.disableMovement?.();
        this._scene.registry.set('map', outdoor.map);
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          this._scene.scene.start(outdoor.map, { playerLocation: outdoor });
        });
        break;
      }

      // ── Wait for input ────────────────────────────────────────────────────

      case 'wait_input':
        getInputManager()?.once(Action.CONFIRM, () => this._step());
        break;

      // ── Temporary variables ───────────────────────────────────────────────

      case 'set_var':
        this._vars[cmd.key] = cmd.value;
        this._step();
        break;

      case 'if_var': {
        // eslint-disable-next-line eqeqeq
        const match = this._vars[cmd.key] == cmd.value;
        this._branch(match ? (cmd.then ?? []) : (cmd.else ?? []));
        break;
      }

      // ── Party ─────────────────────────────────────────────────────────────

      case 'heal_party':
        store.commit('party/RESTORE_ALL');
        this._step();
        break;

      // ── Exclamation animation ─────────────────────────────────────────────

      case 'show_exclamation': {
        const targetId = cmd.target ?? 'player';
        const char = this._scene.characters?.get(targetId);
        if (!char) { this._step(); break; }
        const ANIM_KEY = 'trainer-spotted';
        if (!this._scene.anims.exists(ANIM_KEY)) {
          this._scene.anims.create({
            key:       ANIM_KEY,
            frames:    this._scene.anims.generateFrameNumbers('animation', { start: 13, end: 16 }),
            frameRate: 10,
          });
        }
        const ex = this._scene.add.sprite(
          char.x + char.width / 2,
          char.y - 2,
          'animation',
          13,
        ).setDepth(9999).setOrigin(0.5, 1);
        ex.play(ANIM_KEY);
        this._scene.time.delayedCall(700, () => {
          ex.destroy();
          this._step();
        });
        break;
      }

      // ── Knockback ─────────────────────────────────────────────────────────

      case 'knockback': {
        const targetId2 = cmd.target ?? 'player';
        if (!this._scene.gridEngine) { this._step(); break; }
        const pos = this._scene.gridEngine.getPosition(targetId2);
        if (!pos) { this._step(); break; }
        const { dx, dy } = this._resolveKnockbackDirection(cmd.direction ?? 'away_from_player', targetId2, cmd.source);
        const tiles = cmd.tiles ?? 1;
        const dest  = { x: pos.x + dx * tiles, y: pos.y + dy * tiles };
        this._scene.gridEngine.setPosition(targetId2, dest);
        this._step();
        break;
      }

      default:
        console.warn(`[ScriptRunner] Unknown command: "${cmd.cmd}"`);
        this._step();
    }
  }

  /**
   * Resolve a knockback direction string to a {dx, dy} unit vector.
   * For away_from_player / away_from_npc, computes the cardinal direction
   * from the source character to the target, then reverses it.
   *
   * @param {string} direction   - knockback-direction enum value
   * @param {string} targetId    - charId of the character being knocked back
   * @param {string} [sourceId]  - charId of the source (for away_from_npc)
   * @returns {{ dx: number, dy: number }}
   */
  _resolveKnockbackDirection(direction, targetId, sourceId) {
    if (direction === 'up')    return { dx:  0, dy: -1 };
    if (direction === 'down')  return { dx:  0, dy:  1 };
    if (direction === 'left')  return { dx: -1, dy:  0 };
    if (direction === 'right') return { dx:  1, dy:  0 };

    // away_from_player or away_from_npc — compute cardinal away from source
    const srcId = direction === 'away_from_npc' ? (sourceId ?? 'player') : 'player';
    const srcPos = this._scene.gridEngine?.getPosition(srcId);
    const tgtPos = this._scene.gridEngine?.getPosition(targetId);
    if (!srcPos || !tgtPos) return { dx: 0, dy: 0 };

    const diffX = tgtPos.x - srcPos.x;
    const diffY = tgtPos.y - srcPos.y;
    // Pick the dominant axis; ties go to x
    if (Math.abs(diffX) >= Math.abs(diffY)) {
      return { dx: diffX >= 0 ? 1 : -1, dy: 0 };
    }
    return { dx: 0, dy: diffY >= 0 ? 1 : -1 };
  }
}
