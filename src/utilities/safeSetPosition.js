import * as Tile from '../objects/Tile.js';

function waitTileAligned(ge, charId, timeoutMs = 1000) {
  return new Promise(resolve => {
    if (!ge?.isMoving?.(charId)) { resolve(); return; }
    let settled = false;
    let posSub = null;
    let stopSub = null;
    let timeout = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      posSub?.unsubscribe?.();
      stopSub?.unsubscribe?.();
      if (timeout) clearTimeout(timeout);
      resolve();
    };
    posSub = ge.positionChangeFinished?.().subscribe(({ charId: id }) => {
      if (id === charId) finish();
    });
    stopSub = ge.movementStopped?.().subscribe(({ charId: id }) => {
      if (id === charId) finish();
    });
    timeout = setTimeout(finish, timeoutMs);
  });
}

function sweepTileIndex(scene, charId, dest) {
  const tileIndex = scene._charTileIndex;
  if (tileIndex) {
    for (const [key, set] of tileIndex) {
      if (!set.has(charId)) continue;
      set.delete(charId);
      if (set.size === 0) tileIndex.delete(key);
    }
  }
  scene._charLastTile?.delete(charId);
  scene._updateCharTileIndex?.(charId, dest.x + ',' + dest.y);
}

/**
 * Purge a character from grid-engine's internal charBlockCache at every
 * tile except the destination. Works around the library bug where
 * stopMovement mid-step leaves a zombie entry that no public API clears.
 */
export function purgeGEBlockerCache(ge, charId, dest) {
  const tilemap = ge?.geHeadless?.gridTilemap;
  const cache = tilemap?.charBlockCache;
  if (!cache) return;
  const memo = cache.tilePosToCharacters?.memo;
  if (!memo) return;
  const gridChar = tilemap.characters?.get(charId)
                ?? ge.geHeadless?.gridCharacters?.get(charId);
  if (!gridChar) return;
  for (const [x, yMap] of memo) {
    for (const [y, layerMap] of yMap) {
      if (dest && x === dest.x && y === dest.y) continue;
      for (const [lyr, charSet] of layerMap) {
        if (charSet.has(gridChar)) {
          charSet.delete(gridChar);
        }
      }
    }
  }
}

/**
 * Teleport a grid-engine character without seeding a zombie blocker.
 * Waits for any in-flight step to finish before calling setPosition,
 * then purges stale entries from grid-engine's internal blocker cache.
 *
 * @param {object} scene - The Phaser scene with gridEngine
 * @param {string} charId - The grid-engine character ID
 * @param {{x:number, y:number}} dest - Destination tile
 * @param {string} [layer] - Target char layer (omit to keep current)
 * @param {object} [opts]
 * @param {object} [opts.sprite] - Sprite to sync pixel position
 * @param {boolean} [opts.sweepIndex=true] - Sweep _charTileIndex
 */
export async function safeSetPosition(scene, charId, dest, layer, opts = {}) {
  const ge = scene?.gridEngine;
  if (!ge?.hasCharacter?.(charId)) return;

  if (ge.isMoving?.(charId)) {
    await waitTileAligned(ge, charId);
    if (!scene?.gridEngine?.hasCharacter?.(charId)) return;
    try { ge.stopMovement(charId); } catch (_) {}
  }

  // Yield once so any synchronous grid-engine emit chain in flight finishes
  // its cache mutations before we apply setPosition. stopMoving fires
  // movementStopped$ before positionChangeFinished$, and ScriptRunner-style
  // settle handlers can hop straight from movementStopped into a chained
  // setPosition. Without the yield, the trailing positionChangeFinished
  // re-adds the character to its from-tile *after* purgeGEBlockerCache ran,
  // leaving a permanent zombie blocker on the abandoned tile.
  await Promise.resolve();
  if (!scene?.gridEngine?.hasCharacter?.(charId)) return;

  ge.setPosition(charId, dest, layer);
  purgeGEBlockerCache(ge, charId, dest);

  if (opts.sweepIndex !== false) {
    sweepTileIndex(scene, charId, dest);
  }

  if (opts.sprite) {
    opts.sprite.setPosition?.(dest.x * Tile.WIDTH, dest.y * Tile.HEIGHT);
  }
}
