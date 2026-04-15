import { Tile, NPC } from '@Objects';
import { getPropertyValue, remapProps, Vector2, checkOnlyIf } from '@Utilities';
import Tileset from '@Tileset';
import store from '../../store/index.js';
import ScriptRunner from '../../utilities/ScriptRunner.js';

export default class {
  constructor(scene) {
    this.scene    = scene;
    this._enterSub = null;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::npc');
    }
    this.scene.npcs = this.scene.add.group();
    this.scene.npcs.setName('npcs');
    let npcs = this.scene.findInteractions('npc');
    if (npcs.length === 0) {
      //console.log(['Interactables::npc', 'No NPCs found']);
      return;
    }
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::npc', npcs]);
    }

    this.scene.npcs.runChildUpdate = true;
    npcs.forEach((npc) => {
      if (!checkOnlyIf(getPropertyValue(npc.properties, 'only_if'), store.state.game.gameFlags, this.scene.config.variant ?? null)) return;
      this.addToScene(
        npc.name,
        getPropertyValue(npc.properties, 'overworld-texture'),
        Vector2(npc.x / Tile.WIDTH, npc.y / Tile.HEIGHT),
        {
          id: npc.name,
          scene: this.scene,
          properties: npc.properties,
          ...remapProps(npc.properties)
        }
      );
    });
  }

  addToScene(name, texture, coords, config) {
    let npcDef = {
      id: 'npc_'+name,
      type: 'npc',
      texture: texture,
      x: coords.x,
      y: coords.y,
      scene: this.scene,
      collides: { enabled: true },
      ...config,
      'seen-character': '',
      'seen-radius': 0,
    };

    if (npcDef['movement-behavior'] === 'spinner') {
      npcDef.spin = true;
    }

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::npc::addToScene', name, texture, coords.x, coords.y);
    }

    // Always create immediately so GridEngine can manage this character from scene init.
    // If the texture isn't loaded yet it will show a placeholder; setTexture() fixes it once loaded.
    let npcObj = new NPC(npcDef);
    this.scene.npcs.add(npcObj);
    this.scene.interactTile(this.scene.game.config.tilemap, npcDef, 0x000000);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      // If GridEngine is already initialised (dynamic spawn mid-game), register now
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(npcObj.characterDef());
      }
    } else {
      const path = texture ? Tileset.trainers[texture] : null;
      if (!path) {
        if (texture) console.warn('Interactables::npc: no sprite path for texture', texture);
        // Fall back to placeholder so GridEngine can still manage this character.
        npcObj.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(npcObj.characterDef());
        }
        return npcObj;
      }

      // Use the already-loaded 'red' spritesheet as a placeholder so GridEngine can
      // manage frames normally without __MISSING frame warnings.
      npcObj.setTexture('red');

      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(npcObj.characterDef());
      }

      this.scene.load.spritesheet(texture, path, {
        frameWidth: Tile.WIDTH,
        frameHeight: 48
      });
      this.scene.load.once('filecomplete-spritesheet-' + texture, () => {
        this._ensureAnim(texture);
        this.scene.npcs.getChildren()
          .filter(n => n.config?.texture === texture)
          .forEach(n => {
            n.setTexture(texture);
            // Re-apply the walking animation mapping so GridEngine uses frames
            // from the new texture rather than the stale placeholder state.
            if (this.scene.gridEngine?.hasCharacter(n.config.id)) {
              this.scene.gridEngine.setWalkingAnimationMapping(n.config.id, n.characterFramesDef());
            }
          });
      });
      this.scene.load.start();
    }

    return npcObj;
  }

  _ensureAnim(texture) {
    if (!this.scene.anims.exists(texture + '-spin')) {
      this.scene.anims.create({
        key: texture + '-spin',
        frames: this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::pokemon::event', this.scene]);
    }

    const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
    this._mirrorSub = this.scene.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      this.scene.npcs.getChildren().forEach(npc => {
        const behavior = npc.config?.['movement-behavior'];
        if (!behavior || behavior === 'none') return;
        const target = npc.config?.['mirror-target'] || 'player';
        if (charId !== target) return;
        if (behavior === 'match-movement') {
          npc.move(direction);
        } else if (behavior === 'mirror-move') {
          npc.move(OPPOSITE[direction] || direction);
        }
      });
    });

    this._onInteract = (tile) => {
      if (tile.obj.type !== 'npc') { return; }

      const _dbg = this.scene.game.config.debug.console.interactableShout;
      const scriptTrigger = this.scene.getPropertyFromTile(tile.obj, 'script-trigger') ?? 'interact';
      if (_dbg) console.log(`[NPC] interact "${tile.obj.name}" script-trigger="${scriptTrigger}"`);
      if (scriptTrigger !== 'interact') return;

      const player      = this.scene.characters.get('player');
      const char        = this.scene.characters.get(tile.obj.id);
      const originalDir = char?.getFacingDirection() ?? null;
      char?.look(player.getOppositeFacingDirection());

      const npcName = tile.obj.name;

      const npcScript = this.scene.getPropertyFromTile(tile.obj, 'script');
      if (!npcScript) {
        console.warn(`[NPC] No script found for NPC "${npcName}"`);
        return;
      }

      const onlyIf = this.scene.getPropertyFromTile(tile.obj, 'only_if') ?? null;
      const onlyIfPass = checkOnlyIf(onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {});
      if (_dbg) console.log(`[NPC] interact "${npcName}" only_if →`, onlyIfPass, onlyIf ?? 'none');
      if (!onlyIfPass) return;

      const scriptDoneFlag = 'npc_interacted_' + npcName;
      const scriptDone = !!store.state.game.gameFlags[scriptDoneFlag];
      const scriptRepeatable = !!this.scene.getPropertyFromTile(tile.obj, 'script-repeatable');
      if (_dbg) console.log(`[NPC] interact "${npcName}" scriptDone=${scriptDone} repeatable=${scriptRepeatable}`);

      if (scriptDone && !scriptRepeatable) { return; }

      // Only stop spin/move (with restart=true) when we're actually running the script,
      // so we don't leave stale once('textbox-disable') listeners from early-return paths.
      char?.stopSpin(true);
      char?.stopMove(true);

      store.commit('game/PATCH_FLAGS', { [scriptDoneFlag]: true });
      if (_dbg) console.log(`[NPC] interact "${npcName}" running script (${npcScript.length} cmd(s))`);
      new ScriptRunner(this.scene, [...npcScript]).run(() => {
        if (originalDir) char?.look(originalDir);
      });
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    // ── Enter trigger ──────────────────────────────────────────────────────
    if (this.scene.gridEngine) {
      this._enterSub = this.scene.gridEngine
        .positionChangeFinished()
        .subscribe(({ charId, enterTile }) => {
          if (charId !== 'player') return;
          const _dbg = this.scene.game.config.debug.console.interactableShout;
          this.scene.npcs.getChildren().forEach(npc => {
            const cfg = npc.config;
            if (!cfg?.properties) return;
            const scriptTrigger = this.scene.getPropertyFromTile(cfg, 'script-trigger');
            if (scriptTrigger !== 'enter') return;
            const npcScript = this.scene.getPropertyFromTile(cfg, 'script');
            if (!npcScript) return;
            const pos = this.scene.gridEngine.getPosition(cfg.id);
            if (!pos || pos.x !== enterTile.x || pos.y !== enterTile.y) return;
            const onlyIf = this.scene.getPropertyFromTile(cfg, 'only_if') ?? null;
            const onlyIfPass = checkOnlyIf(onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {});
            if (_dbg) console.log(`[NPC] enter "${cfg.id}" at (${enterTile.x},${enterTile.y}) only_if →`, onlyIfPass, onlyIf ?? 'none');
            if (!onlyIfPass) return;
            if (_dbg) console.log(`[NPC] enter "${cfg.id}" running script (${npcScript.length} cmd(s))`);
            new ScriptRunner(this.scene, [...npcScript]).run();
          });
        });
    }
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
    if (this._mirrorSub) this._mirrorSub.unsubscribe();
    if (this._enterSub)  this._enterSub.unsubscribe();
  }
}
