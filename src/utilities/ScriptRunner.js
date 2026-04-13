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
    this._queue  = ScriptRunner.normalize(commands);
    this._vars          = {};
    this._onDone        = null;
    this._inspectorText = null;
  }

  /**
   * Normalize a command array from either format:
   *   - Flat JSON:   { "cmd": "text", "text": "..." }
   *   - Tiled class: { "propertytype": "cmd-text", "type": "class", "value": { "text": "..." } }
   *
   * Recursively normalizes nested branch arrays (then/else/yes/no).
   *
   * @param {object[]} cmds
   * @returns {object[]}
   */
  /**
   * Validate a command array and return an array of warning strings.
   * Recurses into then/else/yes/no branches.
   * Called at the start of run() when debug mode is enabled.
   *
   * @param {object[]} commands
   * @param {string}   [path='root']
   * @returns {string[]}
   */
  static validate(commands, path = 'root') {
    const KNOWN = new Set([
      'text', 'yes_no', 'give_item', 'remove_item', 'set_flag', 'if_flag',
      'if_has_item', 'give_pokemon', 'enable_input', 'disable_input',
      'move_player', 'move_npc', 'walk_to_char', 'spawn_npc', 'remove_npc',
      'move_to_box', 'if_party_count', 'teach_move', 'warp_player', 'warp_npc',
      'walk_warp_continue', 'teleport_to_pokecenter', 'escape_rope', 'wait',
      'wait_input', 'set_var', 'if_var', 'if_facing', 'if_npc_at', 'heal_party',
      'show_exclamation', 'knockback', 'look', 'face_char', 'movement_behavior',
      'play_sound', 'stop_sound', 'fade_out', 'fade_in', 'camera_pan',
      'camera_follow_player', 'camera_follow_npc',
    ]);
    const REQUIRED = {
      text:              ['text'],
      yes_no:            ['text'],
      give_item:         ['item'],
      remove_item:       ['item'],
      set_flag:          ['key'],
      if_flag:           ['key'],
      if_has_item:       ['item'],
      give_pokemon:      ['species'],
      move_npc:          ['name'],
      walk_to_char:      ['character1', 'character2', 'side'],
      spawn_npc:         ['name', 'texture'],
      remove_npc:        ['name'],
      if_party_count:    ['count'],
      teach_move:        ['move'],
      warp_player:       ['map'],
      warp_npc:          ['character'],
      walk_warp_continue: ['map'],
      set_var:           ['key', 'value'],
      if_var:            ['key', 'value'],
      if_facing:         ['direction'],
      if_npc_at:         ['name'],
      look:              ['direction'],
      face_char:         ['character1', 'character2'],
      movement_behavior: ['character1', 'value'],
      play_sound:        ['key'],
      camera_follow_npc: ['name'],
    };
    const warnings = [];
    commands.forEach((cmd, i) => {
      const loc = `${path}[${i}]`;
      if (!cmd.cmd) { warnings.push(`${loc}: missing "cmd" field`); return; }
      if (!KNOWN.has(cmd.cmd)) { warnings.push(`${loc}: unknown command "${cmd.cmd}"`); return; }
      for (const field of (REQUIRED[cmd.cmd] ?? [])) {
        if (cmd[field] == null) { warnings.push(`${loc} (${cmd.cmd}): missing required field "${field}"`); }
      }
      for (const key of ['then', 'else', 'yes', 'no']) {
        if (Array.isArray(cmd[key])) { warnings.push(...ScriptRunner.validate(cmd[key], `${loc}.${key}`)); }
      }
    });
    return warnings;
  }

  static normalize(cmds) {
    return cmds.map(item => {
      if (item?.type === 'class' && typeof item.propertytype === 'string' && item.propertytype.startsWith('cmd-')) {
        const flat = { cmd: item.propertytype.slice(4), ...item.value };
        for (const key of ['then', 'else', 'yes', 'no']) {
          if (Array.isArray(flat[key])) {
            flat[key] = ScriptRunner.normalize(flat[key]);
          }
        }
        return flat;
      }
      return item;
    });
  }

  run(onDone) {
    this._onDone = onDone ?? null;
    if (this._debug()) {
      const warnings = ScriptRunner.validate(this._queue);
      if (warnings.length) {
        console.warn('[ScriptRunner] Validation warnings:', warnings);
      }
    }
    this._scene._activeScriptRunner = this;
    this._scene.game.events.emit('script-runner-start');
    if (this._debug()) console.log('[ScriptRunner] start — queue:', this._queue.map(c => c.cmd));
    this._step();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

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

    const sub1 = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId: id, enterTile }) => {
      if (id !== charId) return;
      if (enterTile.x === dest.x && enterTile.y === dest.y) settle();
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
      obj => obj.name === name
    );
    const obj = results?.[0];
    if (!obj) {
      console.warn(`[ScriptRunner] anchor "${name}" not found`);
      return null;
    }
    const facingDir = this._scene.getPropertyFromTile?.(obj, 'facing-direction') ?? null;
    return {
      x:         Math.floor(obj.x / 32),
      y:         Math.floor(obj.y / 32),
      facingDir,
    };
  }

  _debug() {
    return !!this._scene?.game?.config?.debug?.console?.scriptRunner;
  }

  /**
   * Start a new Phaser scene, forwarding any remaining queued commands as
   * `_pendingScript` so they resume in the destination scene.
   *
   * @param {string} mapKey  - Scene key to start.
   * @param {object} params  - Scene init data (mutated in-place to add _pendingScript).
   */
  _startScene(mapKey, params) {
    if (this._queue.length) {
      params._pendingScript = [...this._queue];
      this._queue.length = 0;
    }
    this._scene.scene.start(mapKey, params);
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

      case 'set_flag':
        store.commit('game/PATCH_FLAGS', { [cmd.key]: !!cmd.value });
        this._step();
        break;

      case 'if_flag': {
        const val = !!store.state.game.gameFlags[cmd.key];
        this._branch(val ? (cmd.then ?? []) : (cmd.else ?? []));
        break;
      }

      case 'if_has_item': {
        const bag = store.state.bag;
        const found = bag.items.some(e => e.name === cmd.item) ||
                      bag.pokeballs.some(e => e.name === cmd.item) ||
                      bag.tms.some(e => e.name === cmd.item) ||
                      bag.keyItems.some(e => e.name === cmd.item);
        this._branch(found ? (cmd.then ?? []) : (cmd.else ?? []));
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
          if (target.x == null || target.y == null) {
            console.warn(`[ScriptRunner] move_player: could not resolve target (anchor="${cmd.anchor}", x=${cmd.x}, y=${cmd.y}) — skipping`);
            this._step();
            break;
          }
          const sub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
            if (charId !== 'player') return;
            if (enterTile.x === target.x && enterTile.y === target.y) {
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
        const npc = this._scene.characters?.get(cmd.name)
                    ?? this._scene.characters?.get('npc_' + cmd.name);
        if (!npc || !this._scene.gridEngine) { this._step(); break; }
        const npcCharId = npc.config.id;
        if (cmd.path?.length) {
          this._walkPath(npcCharId, npc, [...cmd.path], null);
        } else {
          const anchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
          const target = anchor ?? { x: cmd.x, y: cmd.y };
          if (target.x == null || target.y == null) {
            console.warn(`[ScriptRunner] move_npc: could not resolve target (anchor="${cmd.anchor}", x=${cmd.x}, y=${cmd.y}) — skipping`);
            this._step();
            break;
          }
          const noPathStrategy = cmd.strategy ?? 'CLOSEST_REACHABLE';
          let npcMoveSettled = false;
          const npcMoveSettle = () => {
            if (npcMoveSettled) return;
            npcMoveSettled = true;
            npcMoveSub.unsubscribe();
            npcStopSub.unsubscribe();
            if (anchor?.facingDir) npc.look?.(anchor.facingDir);
            this._step();
          };
          const npcMoveSub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
            if (charId !== npcCharId) return;
            if (enterTile.x === target.x && enterTile.y === target.y) npcMoveSettle();
          });
          const npcStopSub = this._scene.gridEngine.movementStopped().subscribe(({ charId }) => {
            if (charId === npcCharId) npcMoveSettle();
          });
          npc.moveTo(target, { noPathFoundStrategy: noPathStrategy, pathBlockedStrategy: 'WAIT' });
        }
        break;
      }

      // ── Camera ────────────────────────────────────────────────────────────

      case 'camera_pan': {
        let panX, panY;
        if (cmd.anchor) {
          const anchor = this._resolveAnchor(cmd.anchor);
          if (!anchor) { this._step(); break; }
          panX = anchor.x * 32 + 16;
          panY = anchor.y * 32 + 16;
        } else {
          panX = (cmd.x ?? 0) * 32 + 16;
          panY = (cmd.y ?? 0) * 32 + 16;
        }
        this._scene.cameras.main.pan(panX, panY, cmd.duration ?? 500, 'Linear', false, (cam, progress) => {
          if (progress === 1) this._step();
        });
        break;
      }

      case 'camera_follow_player': {
        const followPlayer = this._scene.characters?.get('player');
        if (followPlayer) {
          this._scene.cameras.main.startFollow(followPlayer, true, 1);
          this._scene.cameras.main.setFollowOffset(-(followPlayer.width / 2), -(followPlayer.height / 2));
        }
        this._step();
        break;
      }

      case 'camera_follow_npc': {
        const followNpc = this._scene.characters?.get(cmd.name)
                       ?? this._scene.characters?.get('npc_' + cmd.name);
        if (followNpc) {
          this._scene.cameras.main.startFollow(followNpc, true, 1);
          this._scene.cameras.main.setFollowOffset(-(followNpc.width / 2), -(followNpc.height / 2));
        } else {
          console.warn(`[ScriptRunner] camera_follow_npc: character "${cmd.name}" not found`);
        }
        this._step();
        break;
      }

      case 'walk_to_char': {
        // Accept bare name ("oak") or prefixed name ("npc_oak") for both characters.
        const wChar1 = this._scene.characters?.get(cmd.character1)
                    ?? this._scene.characters?.get('npc_' + cmd.character1);
        if (!wChar1 || !this._scene.gridEngine) {
          if (this._debug()) console.warn(`[ScriptRunner] walk_to_char: character1 "${cmd.character1}" not found`);
          this._step();
          break;
        }

        const char2GridId = this._scene.gridEngine.hasCharacter(cmd.character2)
          ? cmd.character2
          : (this._scene.gridEngine.hasCharacter('npc_' + cmd.character2) ? 'npc_' + cmd.character2 : null);
        const char2pos = char2GridId ? this._scene.gridEngine.getPosition(char2GridId) : null;
        if (!char2pos) {
          if (this._debug()) console.warn(`[ScriptRunner] walk_to_char: character2 "${cmd.character2}" not found`);
          this._step();
          break;
        }

        const { dx, dy } = this._dirToDelta(cmd.side);
        const target = { x: char2pos.x + dx, y: char2pos.y + dy };

        const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
        const arrivalFacing = opposites[cmd.side?.toLowerCase()] ?? null;

        // Already at target — no movement needed.
        const currentPos = this._scene.gridEngine.getPosition(wChar1.config.id);
        if (currentPos && currentPos.x === target.x && currentPos.y === target.y) {
          if (arrivalFacing) wChar1.look?.(arrivalFacing);
          this._step();
          break;
        }

        let wtcSettled = false;
        const wtcSettle = () => {
          if (wtcSettled) return;
          wtcSettled = true;
          wtcMoveSub.unsubscribe();
          wtcStopSub.unsubscribe();
          if (arrivalFacing) wChar1.look?.(arrivalFacing);
          this._step();
        };

        const wtcCharId = wChar1.config.id;
        const wtcMoveSub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
          if (charId !== wtcCharId) return;
          if (enterTile.x === target.x && enterTile.y === target.y) wtcSettle();
        });
        // Fallback: if movement stops before reaching the target (blocked/unreachable), continue.
        const wtcStopSub = this._scene.gridEngine.movementStopped().subscribe(({ charId }) => {
          if (charId === wtcCharId) wtcSettle();
        });

        this._scene.gridEngine.stopMovement(wtcCharId);
        wChar1.moveTo(target, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
        break;
      }

      // ── Spawn NPC ─────────────────────────────────────────────────────────

      case 'spawn_npc': {
        const npcPlugin = this._scene.mapPlugins?.['npc'];
        if (!npcPlugin) { this._step(); break; }
        const anchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
        const coords = anchor ?? { x: cmd.x ?? 0, y: cmd.y ?? 0 };
        const spawnTex = cmd.texture ?? '';
        npcPlugin.addToScene(
          cmd.name,
          spawnTex,
          coords,
          {
            'facing-direction': anchor?.facingDir ?? cmd.facing ?? 'down',
          },
        );
        // Wait for the texture to finish loading before continuing the script,
        // so that subsequent movement commands use the real sprite from the start.
        if (!spawnTex || this._scene.textures.exists(spawnTex)) {
          this._step();
        } else {
          this._scene.load.once('filecomplete-spritesheet-' + spawnTex, () => this._step());
        }
        break;
      }

      // ── Remove NPC ───────────────────────────────────────────────────────

      case 'remove_npc': {
        const removeNpc = this._scene.characters?.get(cmd.name)
                       ?? this._scene.characters?.get('npc_' + cmd.name);
        if (removeNpc) {
          removeNpc.remove();
        } else {
          console.warn(`[ScriptRunner] remove_npc: character "${cmd.name}" not found`);
        }
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

      // ── Camera fades ──────────────────────────────────────────────────────

      case 'fade_out':
        this._scene.cameras.main.fadeOut(cmd.duration ?? 500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => this._step());
        break;

      case 'fade_in':
        this._scene.cameras.main.fadeIn(cmd.duration ?? 500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeincomplete', () => this._step());
        break;

      // ── World navigation ──────────────────────────────────────────────────

      case 'warp_npc': {
        const warpNpc = this._scene.characters?.get(cmd.character)
                     ?? this._scene.characters?.get('npc_' + cmd.character);
        if (!warpNpc || !this._scene.gridEngine) {
          console.warn(`[ScriptRunner] warp_npc: character "${cmd.character}" not found`);
          this._step();
          break;
        }
        const warpNpcId  = warpNpc.config.id;
        const warpNpcLayer = this._scene.gridEngine.getCharLayer(warpNpcId) ?? 'ground';
        const warpNpcDest = cmd.anchor
          ? (() => { const a = this._resolveAnchor(cmd.anchor); return a ? { x: a.x, y: a.y } : null; })()
          : { x: cmd.x ?? 0, y: cmd.y ?? 0 };

        if (warpNpcDest) {
          this._scene.gridEngine.setPosition(warpNpcId, warpNpcDest, warpNpcLayer);
          warpNpc.setVisible(true);
          warpNpc.look(warpNpc.getFacingDirection());
        } else {
          console.warn(`[ScriptRunner] warp_npc: anchor "${cmd.anchor}" not found`);
        }
        this._step();
        break;
      }

      case 'warp_player': {
        const wp = this._scene.characters?.get('player');
        store.commit('game/SET_PLAYER_FACING', wp?.getFacingDirection() ?? 'down');
        wp?.disableMovement?.();
        this._scene.registry.set('map', cmd.map);
        this._scene.game.events.emit('script-runner-end');
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          const params = cmd.anchor
            ? { warpLocationName: cmd.anchor }
            : { playerLocation: { x: cmd.x ?? 0, y: cmd.y ?? 0, charLayer: cmd.layer ?? 'ground' } };
          this._startScene(cmd.map, params);
        });
        break; // no _step() — scene is changing
      }

      case 'walk_warp_continue': {
        const wwcTargetId = cmd.target ?? 'player';
        const wwcChar = this._scene.characters?.get(wwcTargetId)
                     ?? this._scene.characters?.get('npc_' + wwcTargetId);

        const wwcDoWarp = () => {
          const wwcPlayer = this._scene.characters?.get('player');
          store.commit('game/SET_PLAYER_FACING', wwcPlayer?.getFacingDirection() ?? 'down');
          wwcPlayer?.disableMovement?.();
          this._scene.registry.set('map', cmd.map);
          this._scene.game.events.emit('script-runner-end');
          const wwcParams = cmd.anchor
            ? { warpLocationName: cmd.anchor }
            : { playerLocation: { x: cmd.x ?? 0, y: cmd.y ?? 0, charLayer: cmd.layer ?? 'ground' } };
          this._scene.cameras.main.fadeOut(500, 0, 0, 0);
          this._scene.cameras.main.once('camerafadeoutcomplete', () => {
            this._startScene(cmd.map, wwcParams);
          });
        };

        // Walk destination is specified as tile coords in the current map via walk_x / walk_y.
        // cmd.anchor (and cmd.x/y) are only for the destination scene placement.
        const hasWalkTarget = cmd.walk_x != null && cmd.walk_y != null;
        if (!hasWalkTarget || !wwcChar || !this._scene.gridEngine) {
          wwcDoWarp();
          break;
        }

        const wwcDest = { x: cmd.walk_x, y: cmd.walk_y };

        // Already at destination — skip movement.
        const wwcCurrent = this._scene.gridEngine.getPosition(wwcChar.config.id);
        if (wwcCurrent && wwcCurrent.x === wwcDest.x && wwcCurrent.y === wwcDest.y) {
          wwcDoWarp();
          break;
        }

        let wwcSettled = false;
        const wwcSettle = () => {
          if (wwcSettled) return;
          wwcSettled = true;
          wwcMoveSub.unsubscribe();
          wwcStopSub.unsubscribe();
          wwcDoWarp();
        };

        const wwcMoveSub = this._scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
          if (charId !== wwcChar.config.id) return;
          if (enterTile.x === wwcDest.x && enterTile.y === wwcDest.y) wwcSettle();
        });
        const wwcStopSub = this._scene.gridEngine.movementStopped().subscribe(({ charId }) => {
          if (charId === wwcChar.config.id) wwcSettle();
        });

        wwcChar.moveTo(wwcDest, { noPathFoundStrategy: 'CLOSEST_REACHABLE', pathBlockedStrategy: 'WAIT' });
        break; // no _step() — scene is changing
      }

      case 'teleport_to_pokecenter': {
        const healLoc = store.state.game.healLocation
          ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
        const tp = this._scene.characters?.get('player');
        store.commit('game/SET_PLAYER_FACING', 'down');
        tp?.disableMovement?.();
        this._scene.registry.set('map', healLoc.map);
        this._scene.game.events.emit('script-runner-end');
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          this._startScene(healLoc.map, { playerLocation: healLoc });
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
        this._scene.game.events.emit('script-runner-end');
        this._scene.cameras.main.fadeOut(500, 0, 0, 0);
        this._scene.cameras.main.once('camerafadeoutcomplete', () => {
          this._startScene(outdoor.map, { playerLocation: outdoor });
        });
        break;
      }

      // ── Wait ─────────────────────────────────────────────────────────────

      case 'wait':
        this._scene.time.delayedCall(cmd.duration ?? 0, () => this._step());
        break;

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

      // ── Conditional branching — facing / position ─────────────────────────

      case 'if_facing': {
        /**
         * Branch on a character's current facing direction.
         *   cmd.target    — character name/id (default: 'player')
         *   cmd.direction — 'up' | 'down' | 'left' | 'right'
         *   cmd.then      — branch when facing matches
         *   cmd.else      — branch when facing does not match
         */
        const ifFacingId = cmd.target ?? 'player';
        const char = this._scene.characters?.get(ifFacingId);
        const facing = char?.getFacingDirection?.()
          ?? this._scene.gridEngine?.getFacingDirection?.(ifFacingId)
          ?? null;
        const ifFacingMatch = facing === cmd.direction;
        this._branch(ifFacingMatch ? (cmd.then ?? []) : (cmd.else ?? []));
        break;
      }

      case 'if_npc_at': {
        /**
         * Branch on whether a named NPC is at a specific tile position.
         *   cmd.name      — character name/id to check
         *   cmd.anchor    — name of a location-anchor object (preferred)
         *   cmd.x / cmd.y — tile coordinates (used when no anchor)
         *   cmd.then      — branch when NPC is at the position
         *   cmd.else      — branch when NPC is not at the position
         */
        if (!this._scene.gridEngine) { this._branch(cmd.else ?? []); break; }
        const ifNpcAnchor = cmd.anchor ? this._resolveAnchor(cmd.anchor) : null;
        const ifNpcTarget = ifNpcAnchor ?? { x: cmd.x, y: cmd.y };
        const ifNpcPos = this._scene.gridEngine.getPosition(cmd.name);
        const ifNpcMatch = ifNpcPos != null
          && ifNpcPos.x === ifNpcTarget.x
          && ifNpcPos.y === ifNpcTarget.y;
        this._branch(ifNpcMatch ? (cmd.then ?? []) : (cmd.else ?? []));
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

      // ── Look direction ────────────────────────────────────────────────────

      case 'look': {
        /**
         * Turn a character to face a cardinal direction.
         *   cmd.target    — character name/id (default: 'player')
         *   cmd.direction — 'up' | 'down' | 'left' | 'right'
         */
        const lookTarget = cmd.target ?? 'player';
        const lookChar = this._scene.characters?.get(lookTarget)
                      ?? this._scene.characters?.get('npc_' + lookTarget);
        if (lookChar) {
          lookChar.look(cmd.direction);
        } else {
          console.warn(`[ScriptRunner] look: character "${lookTarget}" not found`);
        }
        this._step();
        break;
      }

      // ── Face character ────────────────────────────────────────────────────

      case 'face_char': {
        const fc1 = this._scene.characters?.get(cmd.character1)
                 ?? this._scene.characters?.get('npc_' + cmd.character1);
        const fc2pos = this._scene.gridEngine?.getPosition(cmd.character2)
                    ?? this._scene.gridEngine?.getPosition('npc_' + cmd.character2);
        if (fc1 && fc2pos) {
          const fc1pos = this._scene.gridEngine.getPosition(fc1.config.id);
          const dx = fc2pos.x - fc1pos.x;
          const dy = fc2pos.y - fc1pos.y;
          let dir;
          if (Math.abs(dx) >= Math.abs(dy)) {
            dir = dx >= 0 ? 'right' : 'left';
          } else {
            dir = dy >= 0 ? 'down' : 'up';
          }
          fc1.look(dir);
        } else {
          console.warn(`[ScriptRunner] face_char: could not resolve "${cmd.character1}" or "${cmd.character2}"`);
        }
        this._step();
        break;
      }

      // ── Movement behaviour ────────────────────────────────────────────────

      case 'movement_behavior': {
        console.log('movement_behavior command:', cmd);
        const npc = this._scene.characters?.get(cmd.character1)
                 ?? this._scene.characters?.get('npc_' + cmd.character1);
        if (npc) {
          npc.setMovementBehavior(cmd.value, cmd.character2 ?? 'none');
        } else {
          console.warn(`[ScriptRunner] movement_behavior: character "${cmd.character1}" not found`);
        }
        this._step();
        break;
      }

      // ── Audio ─────────────────────────────────────────────────────────────

      case 'play_sound':
        this._scene.sound.play(cmd.key, { loop: cmd.loop ?? false });
        this._step();
        break;

      case 'stop_sound':
        if (cmd.key) {
          this._scene.sound.stopByKey(cmd.key);
        } else {
          this._scene.sound.stopAll();
        }
        this._step();
        break;

      default:
        console.warn(`[ScriptRunner] Unknown command "${cmd.cmd}" — skipping.`, cmd);
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
