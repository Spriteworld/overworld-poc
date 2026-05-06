import { Moves } from '@spriteworld/pokemon-data';
import { getGameDef } from '@Data/gameDef.js';

let _cache = null;
let _cacheGame = null;

/**
 * Look up a move by name and return its full Move object (type, category, pp, ...).
 * Falls back across all gens if the current game's movedex doesn't carry that
 * move (save carryovers, trainer-scripted moves, etc.). Per-game entries win.
 */
export function getMoveMeta(name) {
  if (!name) return null;
  const game = getGameDef().game;
  if (_cache === null || _cacheGame !== game) {
    _cache = {};
    _cacheGame = game;
    for (const m of Moves.getAllMoves())           _cache[m.name.toLowerCase()] = m;
    for (const m of Moves.getMovesByGameId(game))  _cache[m.name.toLowerCase()] = m;
  }
  return _cache[String(name).toLowerCase()] ?? null;
}
