import store from '../../store/index.js';
import { Pokedex } from '@spriteworld/pokemon-data';
import { getGameDef } from '../../data/gameDef.js';

let _allSpec = null;
function getAllSpecies() {
  if (!_allSpec) _allSpec = Object.values(new Pokedex(getGameDef().game).pokedex);
  return _allSpec;
}

function maybeSpawnFollower(runner, partyWasEmpty) {
  if (partyWasEmpty && store.state.game.gameFlags.follower_pokemon) {
    runner._scene.game.events.emit('follower-pokemon-change', true);
  }
}

export default {
  give_pokemon(runner, cmd) {
    const specInput = String(cmd.species ?? '');
    const entry     = getAllSpecies().find(p =>
      p.species?.toLowerCase() === specInput.toLowerCase() ||
      p.nat_dex_id === Number(specInput)
    );
    if (!entry) {
      console.warn(`[ScriptRunner] Unknown species: "${cmd.species}"`);
      runner._step();
      return;
    }
    const partyWasEmpty = store.state.party.list.length === 0;
    store.commit('party/ADD_POKEMON', {
      natDexId: entry.nat_dex_id,
      level:    cmd.level    ?? 5,
      nickname: cmd.nickname ?? null,
      shiny:    cmd.shiny    ?? false,
    });
    maybeSpawnFollower(runner, partyWasEmpty);
    runner._step();
  },

  give_starter(runner, cmd) {
    const starterMon = getGameDef().starterMon;
    if (!Array.isArray(starterMon) || !starterMon.length) {
      console.warn('[ScriptRunner] give_starter: no starterMon defined in gameDef');
      runner._step();
      return;
    }
    const idx      = cmd.index ?? 1;
    const natDexId = starterMon[idx - 1];
    if (natDexId == null) {
      console.warn(`[ScriptRunner] give_starter: no starter at index ${idx}`);
      runner._step();
      return;
    }
    const partyWasEmpty = store.state.party.list.length === 0;
    store.commit('party/ADD_POKEMON', { natDexId, level: cmd.level ?? 5 });
    maybeSpawnFollower(runner, partyWasEmpty);
    runner._step();
  },

  move_to_box(runner, cmd) {
    store.commit('party/MOVE_TO_BOX', { slot: cmd.slot ?? 0 });
    runner._step();
  },

  if_party_count(runner, cmd) {
    const len  = store.state.party.list.length;
    const n    = cmd.count ?? 1;
    const ops  = { lt: len < n, lte: len <= n, eq: len === n, gte: len >= n, gt: len > n };
    const pass = ops[cmd.op ?? 'eq'] ?? false;
    if (runner._debug()) console.log(`[ScriptRunner] if_party_count — count: ${len}, op: "${cmd.op ?? 'eq'}", target: ${n} → ${pass ? 'pass' : 'fail'}`);
    runner._branch(pass ? (cmd.then ?? []) : (cmd.else ?? []));
  },

  teach_move(runner, cmd) {
    const partyMon = store.state.party.list[cmd.slot ?? 0];
    if (!partyMon) { runner._step(); return; }
    runner._scene.game.events.once('overworld-teach-move-complete', () => runner._step());
    runner._scene.game.events.emit('overworld-teach-move', {
      pid:  partyMon.pid,
      move: cmd.move ?? '',
      pp:   cmd.pp   ?? 30,
    });
  },

  heal_party(runner) {
    store.commit('party/RESTORE_ALL');
    runner._step();
  },
};
