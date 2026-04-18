import { normalize } from '../normalize.js';
import { assertNotReservedId } from '@Utilities';

export default {
  spawn_npc(runner, cmd) {
    const npcPlugin = runner._scene.mapPlugins?.['npc'];
    if (!npcPlugin) { runner._step(); return; }
    assertNotReservedId(cmd.name, 'ScriptRunner::spawn_npc');
    const anchor   = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    const coords   = anchor ?? { x: cmd.x ?? 0, y: cmd.y ?? 0 };
    const spawnTex = cmd.texture ?? '';
    const npcConfig = { 'facing-direction': anchor?.facingDir ?? cmd.facing ?? 'down' };
    if (cmd.trigger && Array.isArray(cmd.trigger.script) && cmd.trigger.script.length) {
      npcConfig.properties = [
        { name: 'script',         value: normalize(cmd.trigger.script) },
        { name: 'script-trigger', value: cmd.trigger.trigger ?? 'interact' },
      ];
    } else if (Array.isArray(cmd.script) && cmd.script.length) {
      npcConfig.properties = [{ name: 'script', value: normalize(cmd.script) }];
    }
    npcPlugin.addToScene(cmd.name, spawnTex, coords, npcConfig);
    if (!spawnTex || runner._scene.textures.exists(spawnTex)) {
      runner._step();
    } else {
      const completeKey = 'filecomplete-spritesheet-' + spawnTex;
      const errorKey    = 'loaderror';
      const advance = () => {
        runner._scene.load.off(errorKey, onError);
        runner._step();
      };
      const onError = (file) => {
        if (file.key !== spawnTex) return;
        runner._scene.load.off(completeKey, advance);
        console.warn(`[ScriptRunner] spawn_npc: failed to load texture "${spawnTex}"`);
        runner._step();
      };
      runner._scene.load.once(completeKey, advance);
      runner._scene.load.on(errorKey, onError);
    }
  },

  remove_npc(runner, cmd) {
    const npc = runner._scene.characters?.get(cmd.name)
             ?? runner._scene.characters?.get('npc_' + cmd.name);
    if (!npc) {
      console.warn(`[ScriptRunner] remove_npc: character "${cmd.name}" not found — scene.characters keys:`, [...(runner._scene.characters?.keys() ?? [])]);
      runner._step();
      return;
    }
    const npcId     = npc.config.id;
    const ge        = runner._scene.gridEngine;
    const gePos     = ge?.hasCharacter?.(npcId) ? ge.getPosition(npcId) : null;
    const npcLayer  = ge?.hasCharacter?.(npcId) ? ge.getCharLayer?.(npcId) : null;
    const playerLayer = ge?.hasCharacter?.('player') ? ge.getCharLayer?.('player') : null;
    const npcCollides = npc.config.collides;
    console.log(`[ScriptRunner] remove_npc "${cmd.name}" → id=${npcId}, GE pos=${JSON.stringify(gePos)}, npcLayer=${npcLayer}, playerLayer=${playerLayer}, collides=${JSON.stringify(npcCollides)}`);
    const spriteBefore = { active: npc.active, visible: npc.visible, x: npc.x, y: npc.y };
    npc.remove();
    runner._scene.removeInteraction?.(npcId);
    const stillInGE = ge?.hasCharacter?.(npcId);
    const spriteAfter = { active: npc.active, visible: npc.visible, x: npc.x, y: npc.y, destroyed: !npc.scene };
    // Check the interactions registry — a leftover entry could block interactions
    // or be mistaken by the player for a collision.
    const interactions = runner._scene.registry?.get?.('interactions') ?? [];
    const leftoverInReg = interactions.find(i => i.obj?.id === npcId);
    // Check the npcs group
    const stillInNpcsGroup = runner._scene.npcs?.getChildren?.()?.find(n => n.config?.id === npcId);
    // Check if player_input is enabled
    const playerInputEnabled = runner._scene.registry?.get?.('player_input');
    console.log(`[ScriptRunner] remove_npc "${npcId}" cleanup report:`);
    console.log(`  sprite: before=${JSON.stringify(spriteBefore)} after=${JSON.stringify(spriteAfter)}`);
    console.log(`  GE.hasCharacter=${stillInGE}, leftoverInteraction=${!!leftoverInReg}, stillInNpcsGroup=${!!stillInNpcsGroup}, player_input=${playerInputEnabled}`);
    if (gePos) {
      const blockedPlayerLayer = ge?.isBlocked?.(gePos, playerLayer);
      const tileBlocked = ge?.isTileBlocked?.(gePos, playerLayer);
      const charsAtTile = ge?.getCharactersAt?.(gePos, playerLayer);
      console.log(`  Tile ${JSON.stringify(gePos)} layer="${playerLayer}": isBlocked=${blockedPlayerLayer}, isTileBlocked=${tileBlocked}, chars=${JSON.stringify(charsAtTile)}`);
    }
    runner._step();
  },

  spawn_pkmn(runner, cmd) {
    const pkmnPlugin = runner._scene.mapPlugins?.['pokemon'];
    if (!pkmnPlugin) { runner._step(); return; }
    assertNotReservedId(cmd.name, 'ScriptRunner::spawn_pkmn');
    const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    const coords = anchor ?? { x: cmd.x ?? 0, y: cmd.y ?? 0 };
    const config = {
      id: cmd.name,
      collides: false,
      move: false,
      spin: false,
      shiny: cmd.shiny ?? false,
      'facing-direction': anchor?.facingDir ?? cmd.facing ?? 'down',
    };
    if (cmd.trigger && Array.isArray(cmd.trigger.script) && cmd.trigger.script.length) {
      config.properties = [
        { name: 'script',         value: normalize(cmd.trigger.script) },
        { name: 'script-trigger', value: cmd.trigger.trigger ?? 'interact' },
      ];
    } else if (Array.isArray(cmd.script) && cmd.script.length) {
      config.properties = [{ name: 'script', value: normalize(cmd.script) }];
    }
    pkmnPlugin.addToScene(cmd.name, cmd.texture ?? '', coords, config);
    runner._step();
  },
};
