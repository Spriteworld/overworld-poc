import { normalize } from '../normalize.js';

export default {
  spawn_npc(runner, cmd) {
    const npcPlugin = runner._scene.mapPlugins?.['npc'];
    if (!npcPlugin) { runner._step(); return; }
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
    if (npc) {
      npc.remove();
    } else {
      console.warn(`[ScriptRunner] remove_npc: character "${cmd.name}" not found`);
    }
    runner._step();
  },

  spawn_pkmn(runner, cmd) {
    const pkmnPlugin = runner._scene.mapPlugins?.['pokemon'];
    if (!pkmnPlugin) { runner._step(); return; }
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
