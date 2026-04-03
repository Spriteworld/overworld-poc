import {
  GEN_1_EVOLUTIONS, GEN_2_EVOLUTIONS, GEN_3_EVOLUTIONS,
  EVOLUTION_METHOD, EXPERIENCE_TABLES, GROWTH,
  FRLG_LEARNSETS, Moves, GAMES,
} from '@spriteworld/pokemon-data';

// Merged evolution table (same as applyExperienceGains.js in battle).
const ALL_EVOLUTIONS = {};
for (const src of [GEN_1_EVOLUTIONS, GEN_2_EVOLUTIONS, GEN_3_EVOLUTIONS]) {
  for (const [id, evos] of Object.entries(src)) {
    const key = Number(id);
    ALL_EVOLUTIONS[key] = ALL_EVOLUTIONS[key] ? [...ALL_EVOLUTIONS[key], ...evos] : [...evos];
  }
}

let _movePpCache = null;
function getMoveByName(name) {
  if (!_movePpCache) {
    _movePpCache = {};
    for (const m of Moves.getMovesByGameId(GAMES.POKEMON_FIRE_RED)) {
      _movePpCache[m.name] = m;
    }
  }
  return _movePpCache[name];
}

/**
 * Compute the effect of using a Rare Candy on a plain party pokemon object.
 * Does NOT mutate the pokemon — returns what to apply via Vuex mutation.
 *
 * @param {{ species: number, level: number, exp?: number, moves: Array, heldItem?: object }} pokemon
 * @returns {{ success: boolean, message: string, newLevel: number, newExp: number,
 *             readyToEvolve: number|null, newMoves: Array, pendingMovesToLearn: Array }}
 */
export function applyRareCandy(pokemon) {
  const currentLevel = pokemon.level ?? 1;

  if (currentLevel >= 100) {
    return {
      success:             false,
      message:             'Already at level 100!',
      newLevel:            currentLevel,
      newExp:              pokemon.exp ?? 0,
      readyToEvolve:       null,
      newMoves:            [],
      pendingMovesToLearn: [],
    };
  }

  const newLevel = currentLevel + 1;
  const table    = EXPERIENCE_TABLES[GROWTH.MEDIUM_FAST];
  const newExp   = table[newLevel - 1] ?? 0;

  // Check for a level-based evolution.
  const dexId = pokemon.species;
  const evos  = dexId != null ? (ALL_EVOLUTIONS[dexId] ?? []) : [];
  const evo   = evos.find(e =>
    (e.method === EVOLUTION_METHOD.LEVEL ||
     e.method === EVOLUTION_METHOD.LEVEL_MALE ||
     e.method === EVOLUTION_METHOD.LEVEL_FEMALE) &&
    e.value <= newLevel
  );
  const readyToEvolve = (evo && !pokemon.heldItem?.preventsEvolution) ? evo.target : null;

  // Check for level-up moves.
  const learnset        = dexId != null ? (FRLG_LEARNSETS[dexId] ?? []) : [];
  const movesAtLvl      = learnset.filter(([lvl]) => lvl === newLevel);
  const existingMoves   = pokemon.moves ?? [];
  const newMoves            = [];
  const pendingMovesToLearn  = [];

  for (const [, moveName] of movesAtLvl) {
    if (existingMoves.some(m => m.name === moveName)) continue;
    const moveData = getMoveByName(moveName);
    const pp       = moveData?.pp ?? 20;

    if (existingMoves.length + newMoves.length < 4) {
      newMoves.push({ name: moveName, pp: { max: pp, current: pp } });
    } else {
      pendingMovesToLearn.push({ name: moveName, pp });
    }
  }

  return {
    success:             true,
    message:             `grew to level ${newLevel}!`,
    newLevel,
    newExp,
    readyToEvolve,
    newMoves,
    pendingMovesToLearn,
  };
}
