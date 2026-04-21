import { Items, buildMon, buildMovePool, resolveSpecies } from '@spriteworld/pokemon-data';
import { gameState } from '../../data/gameState.js';
import { getGameDef } from '../../data/gameDef.js';
import { resolveAiType, DEFAULT_WILD_AI, DEFAULT_TRAINER_AI } from '../../data/aiTypes.js';
import store from '../../store/index.js';
import { rng } from '../../utilities/rng.js';
import { getBattleTheme } from '../../utilities/tiles.js';

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

const normalizeBallName = name => name.toLowerCase().replace(/[-_\s]/g, '').replace(/[éèê]/g, 'e');

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

/**
 * Build a `moves` array from a Tiled trainer spec. Returns null when the spec
 * provides no explicit moves — caller passes no `moves` override and `buildMon`
 * rolls from the learnset / random pool instead.
 */
function resolveTiledMoves(spec, pool) {
  const tiledMoves = [spec.move1, spec.move2, spec.move3, spec.move4]
    .filter(m => typeof m === 'string' && m.trim() !== '');
  const moves = (Array.isArray(spec.moves) && spec.moves.length > 0)
    ? spec.moves
    : (tiledMoves.length > 0 ? tiledMoves : null);
  if (!moves) return null;

  const ppByName = Object.fromEntries(pool.map(m => [m.name.toLowerCase(), m.pp]));
  return moves.slice(0, 4).map(m => {
    if (typeof m === 'string') {
      const pp = ppByName[m.toLowerCase()] ?? 5;
      return { name: m, pp: { max: pp, current: pp } };
    }
    return m;
  });
}

function buildTeam(specs) {
  const game = getGameDef().game;
  const pool = buildMovePool(game);
  return unwrapList(specs).map((spec, i) => {
    const { id } = resolveSpecies(spec.species, game);
    if (id == null) {
      console.warn(`[ScriptRunner] start_battle: unknown species "${spec.species}"`);
      return null;
    }
    const level        = spec.level ?? 5;
    const tiledMoves   = resolveTiledMoves(spec, pool);
    const overrides = {
      rng,
      game,
      movesMode: getGameDef().learnsets,
      movePool:  pool,
      maxIvs:    !!getGameDef().maxIvs,
      pid:       spec.pid ?? (i + 1),
    };
    if (spec.nature  != null) overrides.nature  = spec.nature;
    if (spec.gender  != null) overrides.gender  = spec.gender;
    if (spec.ability != null) overrides.ability = spec.ability;
    if (spec.ivs     != null) overrides.ivs     = spec.ivs;
    if (spec.evs     != null) overrides.evs     = spec.evs;
    if (tiledMoves   != null) overrides.moves   = tiledMoves;
    if (spec.shiny   != null) overrides.isShiny = !!spec.shiny;
    if (spec.pokerus != null) overrides.pokerus = !!spec.pokerus;
    if (spec.heldItem)        overrides.heldItem = spec.heldItem;
    return buildMon(id, level, overrides);
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
          wonFightText:        cmd.won_fight_text ?? null,
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
      field:           { weather: null, terrain: 'normal', scene: getBattleTheme(runner._scene) },
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
