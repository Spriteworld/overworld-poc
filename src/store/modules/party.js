import { defaultParty } from '@Data/party.js';
import { Pokedex, GAMES, NATURES, FRLG_LEARNSETS, Moves, EXPERIENCE_TABLES, GROWTH } from '@spriteworld/pokemon-data';

let _dex      = null;
let _movePool = null;
function getDex()      { return (_dex      ??= new Pokedex(GAMES.POKEMON_FIRE_RED)); }
function getMovePool() { return (_movePool ??= Moves.getMovesByGameId(GAMES.POKEMON_FIRE_RED)); }

function buildMoves(speciesName, level) {
  const pool    = getMovePool();
  const learnset = FRLG_LEARNSETS[speciesName.toUpperCase()];
  if (!learnset?.length) {
    return pool.slice(0, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }));
  }
  const learnable = learnset.filter(([lvl]) => lvl <= level);
  const selected  = learnable.slice(-4);
  const ppByName  = Object.fromEntries(pool.map(m => [m.name, m.pp]));
  return selected.map(([, name]) => {
    const pp = ppByName[name] ?? 5;
    return { name, pp: { max: pp, current: pp } };
  });
}

function cloneParty(source) {
  return source.map(p => ({
    ...p,
    moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
    ivs:   { ...p.ivs },
    evs:   { ...p.evs },
  }));
}

export default {
  namespaced: true,

  state: () => ({
    list: cloneParty(defaultParty),
    box:  [], // Pokémon moved off the party; flat array, no slot management yet
  }),

  mutations: {
    LOAD(state, saved) {
      if (Array.isArray(saved.party)) state.list = saved.party;
    },

    SWAP(state, { a, b }) {
      const tmp = state.list[a];
      state.list[a] = state.list[b];
      state.list[b] = tmp;
      // Remove trailing nulls/undefineds
      while (state.list.length && !state.list[state.list.length - 1]) {
        state.list.pop();
      }
    },

    /**
     * Apply the result of a Rare Candy use to a party member.
     */
    APPLY_RARE_CANDY(state, { pid, newLevel, newExp, readyToEvolve, newMoves, pendingMovesToLearn }) {
      const p = state.list.find(p => p.pid === pid);
      if (!p) return;
      p.level = newLevel;
      p.exp   = newExp;
      newMoves.forEach(m => {
        if (!p.moves.some(x => x.name === m.name)) p.moves.push(m);
      });
      pendingMovesToLearn.forEach(m => {
        p.pendingMovesToLearn = p.pendingMovesToLearn ?? [];
        if (!p.pendingMovesToLearn.some(x => x.name === m.name)) p.pendingMovesToLearn.push(m);
      });
      if (readyToEvolve != null) p.readyToEvolve = readyToEvolve;
    },

    /**
     * Apply an overworld evolution: change species and clear readyToEvolve.
     */
    EVOLVE(state, { pid, targetSpecies }) {
      const p = state.list.find(p => p.pid === pid);
      if (!p) return;
      p.species        = targetSpecies;
      p.readyToEvolve  = null;
    },

    CLEAR_READY_TO_EVOLVE(state, pid) {
      const p = state.list.find(p => p.pid === pid);
      if (p) p.readyToEvolve = null;
    },

    /**
     * Restore all party Pokémon to full HP and PP (white-out / Pokémon Center heal).
     * Setting currentHp to null causes BattlePokemon to re-derive max HP on next battle.
     */
    RESTORE_ALL(state) {
      state.list.forEach(p => {
        if (!p) return;
        p.currentHp = null;
        p.moves.forEach(m => { if (m.pp) m.pp.current = m.pp.max; });
      });
    },

    /**
     * Add a gift Pokémon to the party (up to 6 members).
     * Called by ScriptRunner's `give_pokemon` command.
     * Does nothing if the party is already full.
     */
    ADD_POKEMON(state, { natDexId, level, nickname, shiny }) {
      if (state.list.length >= 6) return;
      const STAT_KEYS  = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
      const lvl        = level ?? 5;
      const speciesData = getDex().getPokemonById(natDexId);
      const growth     = speciesData?.growth ?? GROWTH.MEDIUM_FAST;
      const exp        = (EXPERIENCE_TABLES[growth] ?? EXPERIENCE_TABLES[GROWTH.MEDIUM_FAST])[lvl - 1] ?? 0;
      const abils      = speciesData?.abilities ?? [];
      const ability    = abils.length
        ? { name: abils[Math.floor(Math.random() * abils.length)].name }
        : { name: 'none' };
      const moves      = speciesData ? buildMoves(speciesData.species, lvl) : [];
      const natureKeys = Object.keys(NATURES);
      state.list.push({
        pid:       Date.now() + Math.floor(Math.random() * 1000),
        species:   natDexId,
        level:     lvl,
        exp,
        nickname:  nickname ?? speciesData.species,
        shiny:     shiny    ?? false,
        nature:    NATURES[natureKeys[Math.floor(Math.random() * natureKeys.length)]].name,
        gender:    Math.random() < 0.5 ? 'male' : 'female',
        ability,
        moves,
        ivs:       Object.fromEntries(STAT_KEYS.map(s => [s, Math.floor(Math.random() * 32)])),
        evs:       Object.fromEntries(STAT_KEYS.map(s => [s, 0])),
        currentHp: null,
      });
    },

    /**
     * Move a party Pokémon to the box by party slot index (0-5).
     * Called by ScriptRunner's `move_to_box` command.
     */
    MOVE_TO_BOX(state, { slot }) {
      if (slot < 0 || slot >= state.list.length) return;
      const [mon] = state.list.splice(slot, 1);
      state.box.push(mon);
    },

    /**
     * Apply the result of the teach-move interactive UI.
     * Adds or replaces a move on the party Pokémon identified by pid.
     * replaceIdx = -1 means append (only called when < 4 moves).
     */
    REPLACE_MOVE(state, { pid, move, pp, replaceIdx }) {
      const mon = state.list.find(m => m.pid === pid);
      if (!mon) return;
      const newMove = { name: move, pp: { max: pp, current: pp } };
      if (replaceIdx >= 0) {
        mon.moves[replaceIdx] = newMove;
      } else {
        mon.moves.push(newMove);
      }
    },

    RESET(state) {
      state.list = cloneParty(defaultParty);
      state.box  = [];
    },

    SYNC_AFTER_BATTLE(state, team) {
      team.forEach(snapshot => {
        const entry = state.list.find(p => p.pid === snapshot.pid);
        if (!entry) return;
        entry.currentHp = snapshot.currentHp;
        if (snapshot.species                      != null) entry.species             = snapshot.species;
        if (snapshot.exp                          != null) entry.exp                 = snapshot.exp;
        if (snapshot.level                        != null) entry.level               = snapshot.level;
        if (snapshot.readyToEvolve                != null) entry.readyToEvolve       = snapshot.readyToEvolve;
        if (snapshot.pendingMovesToLearn?.length)          entry.pendingMovesToLearn = snapshot.pendingMovesToLearn;
        // Sync moves: update PP for existing slots, append any newly learned moves
        snapshot.moves.forEach((mSnap, i) => {
          if (entry.moves[i]) {
            entry.moves[i].pp.current = mSnap.pp.current;
          } else {
            entry.moves.push({ name: mSnap.name, pp: { max: mSnap.pp.max, current: mSnap.pp.current } });
          }
        });
      });
    },
  },
};
