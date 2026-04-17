import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves, Items, FRLG_LEARNSETS } from '@spriteworld/pokemon-data';
import { gameState } from '../../data/gameState.js';
import { getGameDef } from '../../data/gameDef.js';
import { resolveAiType, DEFAULT_WILD_AI, DEFAULT_TRAINER_AI } from '../../data/aiTypes.js';
import store from '../../store/index.js';
import { rng } from '../../utilities/rng.js';

const ITEM_REGISTRY = {
  'Potion':        Items.Potion,
  'Super Potion':  Items.SuperPotion,
  'Hyper Potion':  Items.HyperPotion,
  'Max Potion':    Items.MaxPotion,
  'Full Restore':  Items.FullRestore,
  'Ether':         Items.Ether,
  'Revive':        Items.Revive,
};

const BALL_REGISTRY = {
  'pokeball':   Items.Pokeball,
  'greatball':  Items.GreatBall,
  'ultraball':  Items.UltraBall,
  'masterball': Items.MasterBall,
};

const STAT_KEYS   = [STATS.HP, STATS.ATTACK, STATS.DEFENSE, STATS.SPECIAL_ATTACK, STATS.SPECIAL_DEFENSE, STATS.SPEED];
const NATURE_LIST = Object.values(NATURES);

const normalizeBallName = name => name.toLowerCase().replace(/[-_\s]/g, '').replace(/[éèê]/g, 'e');
const pick              = arr  => arr[Math.floor(rng() * arr.length)];
const pickUnique        = (arr, n) => [...arr].sort(() => rng() - 0.5).slice(0, Math.min(n, arr.length));

/**
 * Unwraps a Tiled custom-class wrapper `{ propertytype, type: 'class', value }`
 * down to its inner value. Pass-through for already-flat objects.
 */
const unwrapClass = x => (x && x.type === 'class' && 'value' in x) ? x.value : x;
const unwrapList  = xs => Array.isArray(xs) ? xs.map(unwrapClass) : xs;

function buildBattleInventory() {
  const { items, pokeballs } = store.state.bag;
  const battleItems = items
    .filter(e => ITEM_REGISTRY[e.name] && e.quantity > 0)
    .map(e => ({ item: new ITEM_REGISTRY[e.name](), quantity: e.quantity }));
  const battleBalls = pokeballs
    .filter(e => e.quantity > 0)
    .map(e => {
      const Cls = BALL_REGISTRY[normalizeBallName(e.name)];
      return Cls ? { item: new Cls(), quantity: e.quantity } : null;
    })
    .filter(Boolean);
  return { items: [...battleItems, ...battleBalls], pokeballs: [], tms: [] };
}

/**
 * Build a synthetic battle inventory from a list of `{ name, qty }` entries,
 * without touching `store.state.bag`. Used by tutorial battles so the tutor's
 * stand-in bag exists only for the duration of that battle.
 */
function buildSyntheticInventory(entries) {
  const items = [];
  for (const { name, qty } of unwrapList(entries) ?? []) {
    if (!name || !(qty > 0)) continue;
    const ItemCls = ITEM_REGISTRY[name];
    if (ItemCls) {
      items.push({ item: new ItemCls(), quantity: qty });
      continue;
    }
    const BallCls = BALL_REGISTRY[normalizeBallName(name)];
    if (BallCls) {
      items.push({ item: new BallCls(), quantity: qty });
      continue;
    }
    console.warn(`[ScriptRunner] start_battle.player_override: unknown item "${name}"`);
  }
  return { items, pokeballs: [], tms: [] };
}

function buildMovePool() {
  return Moves.getMovesByGameId(GAMES.POKEMON_FIRE_RED).filter(
    m => m.pp > 0 && (m.power !== null || m.category === Moves.MOVE_CATEGORIES.STATUS)
  );
}

let _pokedex = null;
function getPokedex() {
  if (!_pokedex) _pokedex = new Pokedex(GAMES.POKEMON_FIRE_RED);
  return _pokedex;
}

function resolveSpecies(species) {
  if (typeof species === 'number') {
    const entry = Object.values(getPokedex().pokedex).find(p => p.nat_dex_id === species);
    return { id: species, name: entry?.species ?? null };
  }
  if (typeof species === 'string') {
    const lower = species.toLowerCase();
    const entry = Object.values(getPokedex().pokedex).find(p => p.species?.toLowerCase() === lower);
    return { id: entry?.nat_dex_id ?? null, name: entry?.species ?? species };
  }
  return { id: null, name: null };
}

function buildMovesFromLearnset(speciesName, level, pool) {
  const learnset = FRLG_LEARNSETS[speciesName?.toUpperCase()];
  if (!learnset?.length) {
    return pickUnique(pool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }));
  }
  const selected = learnset.filter(([lvl]) => lvl <= level).slice(-4);
  const ppByName = Object.fromEntries(pool.map(m => [m.name, m.pp]));
  return selected.map(([, name]) => {
    const pp = ppByName[name] ?? 5;
    return { name, pp: { max: pp, current: pp } };
  });
}

function resolveMoves(spec, speciesName, level, pool) {
  // Tiled `trainer-pokemon` entries use flat move1..move4 strings.
  const tiledMoves = [spec.move1, spec.move2, spec.move3, spec.move4]
    .filter(m => typeof m === 'string' && m.trim() !== '');
  const moves = (Array.isArray(spec.moves) && spec.moves.length > 0)
    ? spec.moves
    : (tiledMoves.length > 0 ? tiledMoves : null);

  if (moves) {
    const ppByName = Object.fromEntries(pool.map(m => [m.name.toLowerCase(), m.pp]));
    return moves.slice(0, 4).map(m => {
      if (typeof m === 'string') {
        const pp = ppByName[m.toLowerCase()] ?? 5;
        return { name: m, pp: { max: pp, current: pp } };
      }
      return m;
    });
  }
  const useRandom = getGameDef().learnsets === 'random' || speciesName == null;
  return useRandom
    ? pickUnique(pool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }))
    : buildMovesFromLearnset(speciesName, level, pool);
}

function buildTeam(specs) {
  const pool = buildMovePool();
  return unwrapList(specs).map((spec, i) => {
    const { id, name } = resolveSpecies(spec.species);
    if (id == null) {
      console.warn(`[ScriptRunner] start_battle: unknown species "${spec.species}"`);
      return null;
    }
    const level = spec.level ?? 5;
    const mon = {
      game:    GAMES.POKEMON_FIRE_RED,
      pid:     spec.pid ?? (i + 1),
      species: id,
      level,
      nature:  spec.nature  ?? pick(NATURE_LIST).name,
      gender:  spec.gender  ?? pick([GENDERS.MALE, GENDERS.FEMALE]),
      ability: spec.ability ?? { name: 'none' },
      moves:   resolveMoves(spec, name, level, pool),
      ivs:     spec.ivs ?? Object.fromEntries(STAT_KEYS.map(s => [s, Math.floor(rng() * 32)])),
      evs:     spec.evs ?? Object.fromEntries(STAT_KEYS.map(s => [s, 0])),
    };
    if (spec.shiny   != null) mon.isShiny = !!spec.shiny;
    if (spec.pokerus != null) mon.pokerus = !!spec.pokerus;
    if (spec.heldItem) mon.heldItem = spec.heldItem;
    return mon;
  }).filter(Boolean);
}

export default {
  start_battle(runner, cmd) {
    console.log('[start_battle] cmd=', cmd);
    const type      = (cmd.type ?? 'wild').toLowerCase();
    const isTrainer = type === 'trainer';
    const specs     = Array.isArray(cmd.team) ? cmd.team : [];

    if (specs.length === 0) {
      console.warn('[ScriptRunner] start_battle: no team specified — skipping');
      runner._step();
      return;
    }

    const team    = buildTeam(specs);
    const aiType  = resolveAiType(cmd['use-ai'], isTrainer ? DEFAULT_TRAINER_AI : DEFAULT_WILD_AI);
    const def     = getGameDef();

    const enemy = isTrainer
      ? {
          isTrainer:           true,
          name:                cmd.name ?? 'Rival',
          team,
          trainerClass:        aiType,
          prizeMoney:          team.reduce((m, p) => Math.max(m, p.level ?? 1), 1) * 50 * (def.prizeMoneyMultiplier ?? 1),
          trainerBattleSprite: cmd.battle_texture ?? cmd['battle-texture'] ?? null,
          midFightText:        cmd.mid_fight_text ?? null,
          postDefeatText:      cmd.post_defeat_text ?? null,
        }
      : {
          isTrainer:    false,
          name:         'Wild',
          team:         [team[0]],
          trainerClass: aiType,
        };

    // player_override lets a tutorial / cutscene battle use a stand-in team and
    // inventory instead of the real player party + bag. The real save is never
    // read or written for this battle.
    const override = unwrapClass(cmd.player_override);
    const player = override && (Array.isArray(override.team) || Array.isArray(override.inventory))
      ? {
          name:      override.name ?? 'Tutor',
          team:      buildTeam(Array.isArray(override.team) ? override.team : []),
          inventory: buildSyntheticInventory(override.inventory),
        }
      : {
          name: 'Red',
          team: gameState.party.map(p => ({
            ...p,
            moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
            ivs:   { ...p.ivs },
            evs:   { ...p.evs },
          })),
          inventory: buildBattleInventory(),
        };

    const battleConfig = {
      tilesetBaseUrl:  '/',
      textSpeed:       store.state.game.textSpeed ?? 'normal',
      expRate:         def.expRateMultiplier,
      deferEvolution:  def.deferEvolution,
      nuzlocke:        null,
      field:           { weather: null, terrain: 'normal' },
      tutorial:        cmd.tutorial === true,
      forceCatch:      cmd.force_catch === true,
      scriptedActions: Array.isArray(cmd.scripted_actions) ? unwrapList(cmd.scripted_actions) : null,
      player,
      enemy,
    };

    console.log('[start_battle] emitting battle-start with config=', battleConfig);
    runner._scene.game.events.once('battle-complete', () => runner._step());
    runner._scene.game.events.emit('battle-start', battleConfig);
  },
};
