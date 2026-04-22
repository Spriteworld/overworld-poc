import { normalize } from '../normalize.js';
import { assertNotReservedId, Vector2 } from '@Utilities';
import { Pokedex } from '@spriteworld/pokemon-data';
import { getGameDef } from '@Data/gameDef.js';
import { Flock, Direction } from '@Objects';

const DIRECTION_BY_NAME = {
  up:    Direction.UP,
  down:  Direction.DOWN,
  left:  Direction.LEFT,
  right: Direction.RIGHT,
};

/**
 * Build a V-formation grid for the Flock class. The grid is a 2D boolean
 * array indexed [row][col]; truthy cells get a bird. The leader sits at
 * one end of the V (the front, in the direction of travel) and wingmen
 * trail behind in alternating side offsets.
 *
 * @param {string} direction  one of 'up' / 'down' / 'left' / 'right'
 * @param {number} count      total bird count
 * @returns {{ grid: boolean[][], leaderRow: number, leaderCol: number }}
 *          `leaderRow`/`leaderCol` are the leader's coords inside the grid
 *          so callers can shift the spawn anchor onto the leader.
 */
function buildVGrid(direction, count) {
  // Compute the relative (back, side) offsets for each bird. Leader is
  // index 0; for i ≥ 1, back = ceil(i/2), side alternates left/right.
  const offsets = [{ back: 0, side: 0 }];
  for (let i = 1; i < count; i++) {
    const back = Math.ceil(i / 2);
    const side = (i % 2 === 1 ? -1 : 1) * back;
    offsets.push({ back, side });
  }

  // Translate (back, side) into (row, col) per direction. `back` runs
  // opposite to direction of travel; `side` is perpendicular.
  const isHorizontal = direction === 'left' || direction === 'right';
  let coords;
  if (isHorizontal) {
    const sign = direction === 'right' ? -1 : 1;  // back = behind leader
    coords = offsets.map(({ back, side }) => ({ row: side, col: sign * back }));
  } else {
    const sign = direction === 'down' ? -1 : 1;
    coords = offsets.map(({ back, side }) => ({ row: sign * back, col: side }));
  }

  // Normalise so all (row, col) are ≥ 0.
  const minRow = Math.min(...coords.map(c => c.row));
  const minCol = Math.min(...coords.map(c => c.col));
  const norm = coords.map(({ row, col }) => ({ row: row - minRow, col: col - minCol }));

  const rows = Math.max(...norm.map(c => c.row)) + 1;
  const cols = Math.max(...norm.map(c => c.col)) + 1;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const { row, col } of norm) grid[row][col] = true;

  // Leader is offsets[0] (back=0, side=0) → norm[0].
  return { grid, leaderRow: norm[0].row, leaderCol: norm[0].col };
}

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
      console.warn(`[ScriptRunner] remove_npc: character "${cmd.name}" not found`);
      runner._step();
      return;
    }
    const npcId = npc.config.id;
    const ge    = runner._scene.gridEngine;

    const doRemove = () => {
      // Capture the NPC's current tile BEFORE remove() destroys the sprite —
      // we need it to clean any tile-level collision state that persists beyond
      // GridEngine's own character tracking.
      const lastTile = (ge?.hasCharacter?.(npcId))
        ? (() => { try { return ge.getPosition(npcId); } catch (_) { return null; } })()
        : null;

      npc.remove();

      // Defensive second pass — npc.remove() *should* handle all of this, but
      // a scripted remove is easy to call across a scene transition, which
      // can leave state half-torn. Re-run the cleanup here; each step is
      // idempotent on already-cleared state.
      if (ge?.hasCharacter?.(npcId)) {
        try { ge.stopMovement(npcId); }    catch (_) {}
        try { ge.removeCharacter(npcId); } catch (_) {}
      }
      runner._scene._unindexCharacter?.(npcId);
      runner._scene.removeInteraction?.(npcId);

      // Belt-and-braces: if we still hold the NPC's last tile, scrub it out of
      // the tile index directly. Guards against the case where _charLastTile
      // was stale (e.g. the NPC was teleported via setPosition earlier without
      // the tile index being refreshed, so _unindexCharacter cleared the wrong
      // tile).
      const tileIndex = runner._scene._charTileIndex;
      if (lastTile && tileIndex) {
        const key = lastTile.x + ',' + lastTile.y;
        const set = tileIndex.get(key);
        if (set) {
          set.delete(npcId);
          if (set.size === 0) tileIndex.delete(key);
        }
      }
      // Final pass: sweep the entire tile index and drop `npcId` from every
      // entry. The NPC should only appear once, but earlier bugs (e.g. a warp
      // that didn't update the index) could have double-registered the id at
      // multiple tiles. Empty sets are deleted so `isCharacterOnTile` short-
      // circuits cleanly.
      if (tileIndex) {
        for (const [key, set] of tileIndex) {
          if (!set.has(npcId)) continue;
          set.delete(npcId);
          if (set.size === 0) tileIndex.delete(key);
        }
      }

      runner._step();
    };

    // Same grid-engine zombie-blocker workaround as warp_npc
    // (see docs/grid-engine-ticket.md): calling stopMovement mid-step leaves
    // a permanent blocker on the from-tile that survives removeCharacter.
    // npc.remove() calls stopMovement internally, so we have to let the
    // in-flight step land first. Only then is the removal safe.
    if (ge?.isMoving?.(npcId)) {
      let settled = false;
      let posSub  = null;
      let stopSub = null;
      let timeout = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        posSub?.unsubscribe?.();
        stopSub?.unsubscribe?.();
        if (timeout) clearTimeout(timeout);
        doRemove();
      };
      posSub = ge.positionChangeFinished?.().subscribe(({ charId }) => {
        if (charId === npcId) finish();
      });
      stopSub = ge.movementStopped?.().subscribe(({ charId }) => {
        if (charId === npcId) finish();
      });
      // Ultimate fallback — don't hang the script runner if no event fires.
      timeout = setTimeout(finish, 1000);
      return;
    }

    doRemove();
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

  flock(runner, cmd) {
    const scene  = runner._scene;
    const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    // anchor's facing-direction is the natural travel direction; explicit
    // cmd.direction wins.
    const directionKey = (cmd.direction ?? anchor?.facingDir ?? 'right').toLowerCase();
    const direction    = DIRECTION_BY_NAME[directionKey];
    if (!direction) {
      console.warn(`[ScriptRunner] flock: unknown direction "${directionKey}"`);
      runner._step();
      return;
    }
    // _resolveAnchor returns tile coords; cmd.x/cmd.y are also tile coords.
    const origin = anchor ?? { x: cmd.x, y: cmd.y };
    if (origin.x == null || origin.y == null) {
      console.warn(`[ScriptRunner] flock: could not resolve origin (anchor="${cmd.anchor}", x=${cmd.x}, y=${cmd.y})`);
      runner._step();
      return;
    }

    const species = (cmd.species ?? 'pidgey').toLowerCase();
    const dex     = new Pokedex(getGameDef().game);
    const entry   = Object.values(dex.pokedex).find(p => p.species?.toLowerCase() === species);
    if (!entry) {
      console.warn(`[ScriptRunner] flock: species "${species}" not found in pokedex`);
      runner._step();
      return;
    }
    const pokeId = String(entry.nat_dex_id).padStart(3, '0');

    const count = Math.max(1, cmd.count ?? 5);
    const { grid, leaderRow, leaderCol } = buildVGrid(directionKey, count);

    // Shift the grid so the leader lands ON the anchor tile (anchor names the
    // front of the V; wingmen trail behind in the opposite direction).
    const startX = origin.x - leaderCol;
    const startY = origin.y - leaderRow;

    // `Vector2` import in @Utilities returns a {x,y}-shaped object that
    // PkmnOverworld accepts; the Flock constructor passes it through.
    const name  = cmd.name ?? `flock_${species}_${runner._scene.time?.now ?? Date.now()}`;
    const flock = new Flock(scene, name, pokeId, startX, startY, direction, grid);

    // Flock extends Container, which Phaser doesn't auto-update — drive it
    // off the scene's update event and detach when the flock signals it's
    // done (every bird off-map).
    const onUpdate = (time, delta) => {
      flock.update(time, delta);
      if (!flock.active) {
        scene.events.off('update', onUpdate);
        flock.destroy(true);
      }
    };
    scene.events.on('update', onUpdate);
    scene.events.once('shutdown', () => {
      scene.events.off('update', onUpdate);
    });

    runner._step();
  },
};
