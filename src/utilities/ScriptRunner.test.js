jest.mock('@spriteworld/pokemon-data', () => ({
  Pokedex: class {
    constructor() {
      this.pokedex = [
        { nat_dex_id: 1, species: 'Bulbasaur' },
        { nat_dex_id: 4, species: 'Charmander' },
      ];
    }
  },
  GAMES: { POKEMON_FIRE_RED: 'firered' },
}));

jest.mock('./ChoicePrompt.js', () => jest.fn());
jest.mock('./InputManager.js', () => ({
  getInputManager: jest.fn(() => null),
  Action: { CONFIRM: 'confirm' },
}));

jest.mock('../store/index.js', () => ({
  __esModule: true,
  default: {
    state: {
      game:  { gameFlags: {} },
      bag:   { items: [], pokeballs: [], tms: [], keyItems: [] },
      party: { list: [] },
    },
    commit: jest.fn(),
  },
}));

import Phaser from 'phaser';
import ScriptRunner from './ScriptRunner.js';
import store from '../store/index.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCamera() {
  const cam = new Phaser.Events.EventEmitter();
  cam.fadeOut        = jest.fn();
  cam.fadeIn         = jest.fn();
  cam.pan            = jest.fn();
  cam.startFollow    = jest.fn();
  cam.setFollowOffset = jest.fn();
  return cam;
}

function makeChar(id = 'player', facing = 'down', pos = { x: 0, y: 0 }) {
  return {
    config: { id },
    width:  16,
    height: 24,
    x:      pos.x * 32,
    y:      pos.y * 32,
    look:               jest.fn(),
    remove:             jest.fn(),
    moveTo:             jest.fn(),
    getFacingDirection: jest.fn(() => facing),
    disableMovement:    jest.fn(),
    setMovementBehavior: jest.fn(),
    setVisible:         jest.fn(),
  };
}

function makeGridEngine(positions = {}) {
  return {
    getPosition:             jest.fn((id) => positions[id] ?? null),
    setPosition:             jest.fn(),
    setSpeed:                jest.fn(),
    stopMovement:            jest.fn(),
    hasCharacter:            jest.fn((id) => id in positions),
    getCharLayer:            jest.fn(() => 'ground'),
    getFacingDirection:      jest.fn(() => 'down'),
    positionChangeFinished:  jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
    movementStopped:         jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
  };
}

function makeScene(overrides = {}) {
  const gameEvents = new Phaser.Events.EventEmitter();
  const camera = makeCamera();
  return {
    game: {
      events: gameEvents,
      config: { debug: { console: { scriptRunner: false } } },
    },
    registry: {
      _store: {},
      get: jest.fn(function (k)    { return this._store[k]; }),
      set: jest.fn(function (k, v) { this._store[k] = v; }),
    },
    cameras: { main: camera },
    characters: new Map(),
    sound: {
      play:      jest.fn(),
      stopByKey: jest.fn(),
      stopAll:   jest.fn(),
    },
    time: {
      delayedCall: jest.fn(),
    },
    gridEngine: null,
    config:     {},
    getPropertyFromTile: jest.fn(),
    scene: {
      get:   jest.fn(() => null),
      start: jest.fn(),
    },
    add: {
      text: jest.fn(() => ({
        setScrollFactor: jest.fn().mockReturnThis(),
        setDepth:        jest.fn().mockReturnThis(),
        setText:         jest.fn(),
        destroy:         jest.fn(),
      })),
      sprite: jest.fn(() => ({
        setDepth:  jest.fn().mockReturnThis(),
        setOrigin: jest.fn().mockReturnThis(),
        play:      jest.fn(),
        destroy:   jest.fn(),
      })),
    },
    anims: {
      exists:              jest.fn(() => false),
      create:              jest.fn(),
      generateFrameNumbers: jest.fn(() => []),
    },
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Run a single command and return {scene, onDone}. */
function run(cmd, sceneOpts) {
  const scene = makeScene(sceneOpts);
  const onDone = jest.fn();
  new ScriptRunner(scene, [cmd]).run(onDone);
  return { scene, onDone };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  store.commit.mockClear();
  store.state.game.gameFlags = {};
  store.state.bag  = { items: [], pokeballs: [], tms: [], keyItems: [] };
  store.state.party.list = [];
});

// ─── normalize ────────────────────────────────────────────────────────────────

describe('ScriptRunner.normalize', () => {
  test('flat commands pass through unchanged', () => {
    const cmds = [{ cmd: 'text', text: 'Hi' }];
    expect(ScriptRunner.normalize(cmds)).toEqual(cmds);
  });

  test('Tiled class format is flattened', () => {
    const cmds = [{
      type: 'class',
      propertytype: 'cmd-text',
      value: { text: 'Hello' },
    }];
    expect(ScriptRunner.normalize(cmds)).toEqual([{ cmd: 'text', text: 'Hello' }]);
  });

  test('non-cmd class entries pass through unchanged', () => {
    const cmds = [{
      type: 'class',
      propertytype: 'something-else',
      value: { foo: 'bar' },
    }];
    expect(ScriptRunner.normalize(cmds)).toEqual(cmds);
  });

  test('nested then/else branches are recursively normalized', () => {
    const cmds = [{
      type: 'class',
      propertytype: 'cmd-if_flag',
      value: {
        key: 'MY_FLAG',
        then: [{ type: 'class', propertytype: 'cmd-text', value: { text: 'Yes' } }],
        else: [{ cmd: 'heal_party' }],
      },
    }];
    const result = ScriptRunner.normalize(cmds);
    expect(result[0].cmd).toBe('if_flag');
    expect(result[0].then[0]).toEqual({ cmd: 'text', text: 'Yes' });
    expect(result[0].else[0]).toEqual({ cmd: 'heal_party' });
  });
});

// ─── validate ─────────────────────────────────────────────────────────────────

describe('ScriptRunner.validate', () => {
  test('valid commands return empty array', () => {
    expect(ScriptRunner.validate([
      { cmd: 'text', text: 'Hi' },
      { cmd: 'heal_party' },
    ])).toEqual([]);
  });

  test('missing cmd field produces a warning', () => {
    const warnings = ScriptRunner.validate([{ text: 'oops' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/missing "cmd" field/);
  });

  test('unknown command produces a warning', () => {
    const warnings = ScriptRunner.validate([{ cmd: 'fly_to_moon' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/unknown command "fly_to_moon"/);
  });

  test('missing required field produces a warning', () => {
    const warnings = ScriptRunner.validate([{ cmd: 'text' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/missing required field "text"/);
  });

  test('multiple missing fields each produce a warning', () => {
    const warnings = ScriptRunner.validate([{ cmd: 'walk_to_char' }]);
    expect(warnings.some(w => w.includes('"character1"'))).toBe(true);
    expect(warnings.some(w => w.includes('"character2"'))).toBe(true);
    expect(warnings.some(w => w.includes('"side"'))).toBe(true);
  });

  test('nested branches are recursively validated', () => {
    const warnings = ScriptRunner.validate([{
      cmd: 'if_flag',
      key: 'X',
      then: [{ cmd: 'text' }],       // missing required "text" field
      else: [{ cmd: 'unknown_cmd' }], // unknown command
    }]);
    expect(warnings.some(w => w.includes('.then') && w.includes('"text"'))).toBe(true);
    expect(warnings.some(w => w.includes('.else') && w.includes('unknown command'))).toBe(true);
  });

  test('path argument is reflected in warning location', () => {
    const warnings = ScriptRunner.validate([{ cmd: 'text' }], 'script.on_enter');
    expect(warnings[0]).toMatch(/^script\.on_enter\[0\]/);
  });
});

// ─── lifecycle ────────────────────────────────────────────────────────────────

describe('lifecycle', () => {
  test('emits script-runner-start when run() is called', () => {
    const scene  = makeScene();
    const startFn = jest.fn();
    scene.game.events.on('script-runner-start', startFn);
    new ScriptRunner(scene, []).run();
    expect(startFn).toHaveBeenCalled();
  });

  test('emits script-runner-end when queue is empty', () => {
    const scene = makeScene();
    const endFn = jest.fn();
    scene.game.events.on('script-runner-end', endFn);
    new ScriptRunner(scene, []).run();
    expect(endFn).toHaveBeenCalled();
  });

  test('onDone callback fires when queue empties', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, []).run(onDone);
    expect(onDone).toHaveBeenCalled();
  });

  test('onDone fires after all instant commands complete', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [
      { cmd: 'heal_party' },
      { cmd: 'heal_party' },
      { cmd: 'heal_party' },
    ]).run(onDone);
    expect(store.commit).toHaveBeenCalledTimes(3);
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── item commands ────────────────────────────────────────────────────────────

describe('give_item', () => {
  test('commits bag/PICKUP with item name and qty', () => {
    run({ cmd: 'give_item', item: 'Potion', qty: 3 });
    expect(store.commit).toHaveBeenCalledWith('bag/PICKUP', { name: 'Potion', qty: 3 });
  });

  test('defaults qty to 1 when not specified', () => {
    run({ cmd: 'give_item', item: 'Antidote' });
    expect(store.commit).toHaveBeenCalledWith('bag/PICKUP', { name: 'Antidote', qty: 1 });
  });

  test('advances to next command', () => {
    const { onDone } = run({ cmd: 'give_item', item: 'Potion' });
    expect(onDone).toHaveBeenCalled();
  });
});

describe('remove_item', () => {
  test('commits bag/USE_ITEM for each quantity', () => {
    run({ cmd: 'remove_item', item: 'Potion', qty: 2 });
    expect(store.commit).toHaveBeenCalledWith('bag/USE_ITEM', 'Potion');
    expect(store.commit).toHaveBeenCalledTimes(2);
  });

  test('defaults qty to 1', () => {
    run({ cmd: 'remove_item', item: 'Potion' });
    expect(store.commit).toHaveBeenCalledTimes(1);
  });
});

// ─── flag commands ────────────────────────────────────────────────────────────

describe('set_flag', () => {
  test('commits game/PATCH_FLAGS with boolean value', () => {
    run({ cmd: 'set_flag', key: 'GOT_POKEDEX', value: true });
    expect(store.commit).toHaveBeenCalledWith('game/PATCH_FLAGS', { GOT_POKEDEX: true });
  });

  test('coerces value to boolean', () => {
    run({ cmd: 'set_flag', key: 'MY_FLAG', value: 1 });
    expect(store.commit).toHaveBeenCalledWith('game/PATCH_FLAGS', { MY_FLAG: true });
  });
});

describe('if_flag', () => {
  test('takes then branch when flag is truthy', () => {
    store.state.game.gameFlags.RIVAL_FIGHT = true;
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [{
      cmd: 'if_flag',
      key: 'RIVAL_FIGHT',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run(onDone);
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('takes else branch when flag is falsy', () => {
    store.state.game.gameFlags.RIVAL_FIGHT = false;
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [{
      cmd: 'if_flag',
      key: 'RIVAL_FIGHT',
      then: [],
      else: [{ cmd: 'heal_party' }],
    }]).run(onDone);
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('uses empty array when then/else not provided', () => {
    const { onDone } = run({ cmd: 'if_flag', key: 'MISSING' });
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── if_has_item ──────────────────────────────────────────────────────────────

describe('if_has_item', () => {
  test('takes then branch when item is in items[]', () => {
    store.state.bag.items = [{ name: 'Potion', quantity: 1 }];
    const scene = makeScene();
    new ScriptRunner(scene, [{
      cmd: 'if_has_item',
      item: 'Potion',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('takes then branch when item is in pokeballs[]', () => {
    store.state.bag.pokeballs = [{ name: 'PokeBall', quantity: 5 }];
    const scene = makeScene();
    new ScriptRunner(scene, [{
      cmd: 'if_has_item',
      item: 'PokeBall',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('takes then branch when item is in keyItems[]', () => {
    store.state.bag.keyItems = [{ name: 'Bicycle' }];
    const scene = makeScene();
    new ScriptRunner(scene, [{
      cmd: 'if_has_item',
      item: 'Bicycle',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('takes else branch when item is not in bag', () => {
    const scene = makeScene();
    new ScriptRunner(scene, [{
      cmd: 'if_has_item',
      item: 'MasterBall',
      then: [],
      else: [{ cmd: 'heal_party' }],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });
});

// ─── variable commands ────────────────────────────────────────────────────────

describe('set_var / if_var', () => {
  test('set_var stores a value and advances', () => {
    const { onDone } = run({ cmd: 'set_var', key: 'counter', value: 5 });
    expect(onDone).toHaveBeenCalled();
  });

  test('if_var takes then branch when value matches (loose equality)', () => {
    const scene = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [
      { cmd: 'set_var', key: 'phase', value: '2' },
      { cmd: 'if_var',  key: 'phase', value: 2, then: [{ cmd: 'heal_party' }], else: [] },
    ]).run(onDone);
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
    expect(onDone).toHaveBeenCalled();
  });

  test('if_var takes else branch when value does not match', () => {
    const scene = makeScene();
    new ScriptRunner(scene, [
      { cmd: 'set_var', key: 'phase', value: 1 },
      { cmd: 'if_var',  key: 'phase', value: 99, then: [], else: [{ cmd: 'heal_party' }] },
    ]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });
});

// ─── input commands ───────────────────────────────────────────────────────────

describe('enable_input / disable_input', () => {
  test('enable_input sets player_input to true', () => {
    const { scene } = run({ cmd: 'enable_input' });
    expect(scene.registry.set).toHaveBeenCalledWith('player_input', true);
  });

  test('disable_input sets player_input to false', () => {
    const { scene } = run({ cmd: 'disable_input' });
    expect(scene.registry.set).toHaveBeenCalledWith('player_input', false);
  });
});

// ─── text command ─────────────────────────────────────────────────────────────

describe('text', () => {
  test('emits textbox-changedata with the text string', () => {
    const scene = makeScene();
    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    new ScriptRunner(scene, [{ cmd: 'text', text: 'Hello!' }]).run();
    expect(listener).toHaveBeenCalledWith('Hello!');
  });

  test('joins array text with newlines', () => {
    const scene = makeScene();
    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    new ScriptRunner(scene, [{ cmd: 'text', text: ['Line 1', 'Line 2'] }]).run();
    expect(listener).toHaveBeenCalledWith('Line 1\nLine 2');
  });

  test('does not advance until textbox-disable fires', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'text', text: 'Wait...' }]).run(onDone);
    expect(onDone).not.toHaveBeenCalled();
    scene.game.events.emit('textbox-disable');
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── wait command ─────────────────────────────────────────────────────────────

describe('wait', () => {
  test('calls time.delayedCall with specified duration', () => {
    const scene  = makeScene();
    let timerCb  = null;
    scene.time.delayedCall = jest.fn((dur, cb) => { timerCb = cb; });
    new ScriptRunner(scene, [{ cmd: 'wait', duration: 1000 }]).run();
    expect(scene.time.delayedCall).toHaveBeenCalledWith(1000, expect.any(Function));
    expect(timerCb).not.toBeNull();
  });

  test('defaults duration to 0', () => {
    const scene = makeScene();
    new ScriptRunner(scene, [{ cmd: 'wait' }]).run();
    expect(scene.time.delayedCall).toHaveBeenCalledWith(0, expect.any(Function));
  });

  test('does not advance until callback fires', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    let timerCb  = null;
    scene.time.delayedCall = jest.fn((dur, cb) => { timerCb = cb; });
    new ScriptRunner(scene, [{ cmd: 'wait', duration: 500 }]).run(onDone);
    expect(onDone).not.toHaveBeenCalled();
    timerCb();
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── heal_party ───────────────────────────────────────────────────────────────

describe('heal_party', () => {
  test('commits party/RESTORE_ALL and advances', () => {
    const { onDone } = run({ cmd: 'heal_party' });
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── character commands ───────────────────────────────────────────────────────

describe('look', () => {
  test('calls look() on the target character', () => {
    const scene  = makeScene();
    const player = makeChar('player');
    scene.characters.set('player', player);
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'look', direction: 'up' }]).run(onDone);
    expect(player.look).toHaveBeenCalledWith('up');
    expect(onDone).toHaveBeenCalled();
  });

  test('resolves npc_ prefix when name not found directly', () => {
    const scene = makeScene();
    const npc   = makeChar('npc_oak');
    scene.characters.set('npc_oak', npc);
    new ScriptRunner(scene, [{ cmd: 'look', target: 'oak', direction: 'right' }]).run();
    expect(npc.look).toHaveBeenCalledWith('right');
  });

  test('advances even when character not found', () => {
    const { onDone } = run({ cmd: 'look', target: 'nobody', direction: 'up' });
    expect(onDone).toHaveBeenCalled();
  });

  test('defaults to player when no target specified', () => {
    const scene  = makeScene();
    const player = makeChar('player');
    scene.characters.set('player', player);
    new ScriptRunner(scene, [{ cmd: 'look', direction: 'left' }]).run();
    expect(player.look).toHaveBeenCalledWith('left');
  });
});

describe('remove_npc', () => {
  test('calls remove() on the npc character', () => {
    const scene = makeScene();
    const npc   = makeChar('npc_oak');
    scene.characters.set('npc_oak', npc);
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'remove_npc', name: 'oak' }]).run(onDone);
    expect(npc.remove).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  test('resolves by exact name first', () => {
    const scene = makeScene();
    const npc   = makeChar('oak');
    scene.characters.set('oak', npc);
    new ScriptRunner(scene, [{ cmd: 'remove_npc', name: 'oak' }]).run();
    expect(npc.remove).toHaveBeenCalled();
  });

  test('advances even when npc not found', () => {
    const { onDone } = run({ cmd: 'remove_npc', name: 'ghost' });
    expect(onDone).toHaveBeenCalled();
  });
});

describe('movement_behavior', () => {
  test('calls setMovementBehavior on the character', () => {
    const scene = makeScene();
    const npc   = makeChar('npc_guard');
    scene.characters.set('npc_guard', npc);
    new ScriptRunner(scene, [{
      cmd: 'movement_behavior',
      character1: 'guard',
      value: 'wander',
      character2: 'player',
    }]).run();
    expect(npc.setMovementBehavior).toHaveBeenCalledWith('wander', 'player');
  });
});

describe('if_facing', () => {
  test('takes then branch when player faces the specified direction', () => {
    const scene  = makeScene();
    const player = makeChar('player', 'up');
    scene.characters.set('player', player);
    new ScriptRunner(scene, [{
      cmd: 'if_facing',
      direction: 'up',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('takes else branch when player faces a different direction', () => {
    const scene  = makeScene();
    const player = makeChar('player', 'down');
    scene.characters.set('player', player);
    new ScriptRunner(scene, [{
      cmd: 'if_facing',
      direction: 'up',
      then: [],
      else: [{ cmd: 'heal_party' }],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('resolves direction from gridEngine when character not in characters map', () => {
    const scene = makeScene();
    const ge    = makeGridEngine({ player: { x: 0, y: 0 } });
    ge.getFacingDirection = jest.fn(() => 'right');
    scene.gridEngine = ge;
    new ScriptRunner(scene, [{
      cmd: 'if_facing',
      direction: 'right',
      then: [{ cmd: 'heal_party' }],
      else: [],
    }]).run();
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });
});

describe('face_char', () => {
  test('turns character1 to face character2', () => {
    const scene = makeScene();
    const oak   = makeChar('npc_oak', 'down', { x: 5, y: 5 });
    const player = makeChar('player', 'down', { x: 5, y: 3 });
    scene.characters.set('npc_oak', oak);
    scene.characters.set('player', player);
    const ge = makeGridEngine({
      'npc_oak': { x: 5, y: 5 },
      'player':  { x: 5, y: 3 },
    });
    scene.gridEngine = ge;
    new ScriptRunner(scene, [{
      cmd: 'face_char',
      character1: 'oak',
      character2: 'player',
    }]).run();
    // player is above oak (dy = 3-5 = -2), so oak should look 'up'
    expect(oak.look).toHaveBeenCalledWith('up');
  });

  test('prefers horizontal facing when dx > dy', () => {
    const scene = makeScene();
    const npc   = makeChar('npc_rival', 'down', { x: 2, y: 5 });
    scene.characters.set('npc_rival', npc);
    const ge = makeGridEngine({
      'npc_rival': { x: 2, y: 5 },
      'player':    { x: 7, y: 5 },
    });
    scene.gridEngine = ge;
    new ScriptRunner(scene, [{
      cmd: 'face_char',
      character1: 'rival',
      character2: 'player',
    }]).run();
    expect(npc.look).toHaveBeenCalledWith('right');
  });
});

// ─── audio commands ───────────────────────────────────────────────────────────

describe('play_sound', () => {
  test('calls sound.play with key and loop option', () => {
    const { scene } = run({ cmd: 'play_sound', key: 'fanfare', loop: true });
    expect(scene.sound.play).toHaveBeenCalledWith('fanfare', { loop: true });
  });

  test('defaults loop to false', () => {
    const { scene } = run({ cmd: 'play_sound', key: 'blip' });
    expect(scene.sound.play).toHaveBeenCalledWith('blip', { loop: false });
  });
});

describe('stop_sound', () => {
  test('calls stopByKey when key is provided', () => {
    const { scene } = run({ cmd: 'stop_sound', key: 'fanfare' });
    expect(scene.sound.stopByKey).toHaveBeenCalledWith('fanfare');
    expect(scene.sound.stopAll).not.toHaveBeenCalled();
  });

  test('calls stopAll when no key is provided', () => {
    const { scene } = run({ cmd: 'stop_sound' });
    expect(scene.sound.stopAll).toHaveBeenCalled();
    expect(scene.sound.stopByKey).not.toHaveBeenCalled();
  });
});

// ─── camera commands ──────────────────────────────────────────────────────────

describe('fade_out', () => {
  test('calls cameras.main.fadeOut with duration', () => {
    const { scene } = run({ cmd: 'fade_out', duration: 300 });
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(300, 0, 0, 0);
  });

  test('defaults duration to 500', () => {
    const { scene } = run({ cmd: 'fade_out' });
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(500, 0, 0, 0);
  });

  test('does not advance until camerafadeoutcomplete fires', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'fade_out' }]).run(onDone);
    expect(onDone).not.toHaveBeenCalled();
    scene.cameras.main.emit('camerafadeoutcomplete');
    expect(onDone).toHaveBeenCalled();
  });
});

describe('fade_in', () => {
  test('calls cameras.main.fadeIn with duration', () => {
    const { scene } = run({ cmd: 'fade_in', duration: 200 });
    expect(scene.cameras.main.fadeIn).toHaveBeenCalledWith(200, 0, 0, 0);
  });

  test('does not advance until camerafadeincomplete fires', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'fade_in' }]).run(onDone);
    expect(onDone).not.toHaveBeenCalled();
    scene.cameras.main.emit('camerafadeincomplete');
    expect(onDone).toHaveBeenCalled();
  });
});

describe('camera_pan', () => {
  test('converts tile coords to pixel coords (+16 centre offset)', () => {
    const { scene } = run({ cmd: 'camera_pan', x: 3, y: 5, duration: 600 });
    expect(scene.cameras.main.pan).toHaveBeenCalledWith(
      3 * 32 + 16,
      5 * 32 + 16,
      600,
      'Linear',
      false,
      expect.any(Function),
    );
  });

  test('defaults duration to 500 and coords to 0', () => {
    const { scene } = run({ cmd: 'camera_pan' });
    expect(scene.cameras.main.pan).toHaveBeenCalledWith(16, 16, 500, 'Linear', false, expect.any(Function));
  });

  test('advances only when progress reaches 1', () => {
    const scene  = makeScene();
    const onDone = jest.fn();
    let panCb    = null;
    scene.cameras.main.pan = jest.fn((x, y, dur, ease, force, cb) => { panCb = cb; });
    new ScriptRunner(scene, [{ cmd: 'camera_pan', x: 0, y: 0 }]).run(onDone);
    panCb(null, 0);
    panCb(null, 0.5);
    expect(onDone).not.toHaveBeenCalled();
    panCb(null, 1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('camera_follow_player', () => {
  test('calls startFollow and setFollowOffset on the player', () => {
    const scene  = makeScene();
    const player = makeChar('player');
    scene.characters.set('player', player);
    const onDone = jest.fn();
    new ScriptRunner(scene, [{ cmd: 'camera_follow_player' }]).run(onDone);
    expect(scene.cameras.main.startFollow).toHaveBeenCalledWith(player, true, 1);
    expect(scene.cameras.main.setFollowOffset).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  test('advances even when player is not in the characters map', () => {
    const { onDone } = run({ cmd: 'camera_follow_player' });
    expect(onDone).toHaveBeenCalled();
  });
});

describe('camera_follow_npc', () => {
  test('calls startFollow on the resolved npc', () => {
    const scene = makeScene();
    const npc   = makeChar('npc_guard');
    scene.characters.set('npc_guard', npc);
    new ScriptRunner(scene, [{ cmd: 'camera_follow_npc', name: 'guard' }]).run();
    expect(scene.cameras.main.startFollow).toHaveBeenCalledWith(npc, true, 1);
  });

  test('advances even when npc is not found', () => {
    const { onDone } = run({ cmd: 'camera_follow_npc', name: 'nobody' });
    expect(onDone).toHaveBeenCalled();
  });
});

// ─── warp commands — _pendingScript forwarding ───────────────────────────────

describe('warp commands forward remaining commands as _pendingScript', () => {
  function makeWarpScene() {
    const scene = makeScene();
    const player = makeChar('player');
    scene.characters.set('player', player);
    return scene;
  }

  test('warp_player passes remaining commands to new scene via _pendingScript', () => {
    const scene = makeWarpScene();
    let startedWith = null;
    scene.scene.start = jest.fn((key, params) => { startedWith = params; });

    new ScriptRunner(scene, [
      { cmd: 'warp_player', map: 'Route1', x: 5, y: 3 },
      { cmd: 'heal_party' },
      { cmd: 'enable_input' },
    ]).run();

    scene.cameras.main.emit('camerafadeoutcomplete');

    expect(scene.scene.start).toHaveBeenCalledWith('Route1', expect.any(Object));
    expect(startedWith._pendingScript).toHaveLength(2);
    expect(startedWith._pendingScript[0].cmd).toBe('heal_party');
    expect(startedWith._pendingScript[1].cmd).toBe('enable_input');
  });

  test('warp_player with no trailing commands sets no _pendingScript', () => {
    const scene = makeWarpScene();
    let startedWith = null;
    scene.scene.start = jest.fn((key, params) => { startedWith = params; });

    new ScriptRunner(scene, [
      { cmd: 'warp_player', map: 'Route1', x: 5, y: 3 },
    ]).run();

    scene.cameras.main.emit('camerafadeoutcomplete');

    expect(startedWith._pendingScript).toBeUndefined();
  });

  test('walk_warp_continue passes remaining commands to new scene', () => {
    const scene = makeWarpScene();
    let startedWith = null;
    scene.scene.start = jest.fn((key, params) => { startedWith = params; });

    new ScriptRunner(scene, [
      { cmd: 'walk_warp_continue', map: 'ProfessorLab', anchor: 'entry' },
      { cmd: 'heal_party' },
    ]).run();

    scene.cameras.main.emit('camerafadeoutcomplete');

    expect(startedWith._pendingScript).toHaveLength(1);
    expect(startedWith._pendingScript[0].cmd).toBe('heal_party');
  });
});

// ─── unknown command ──────────────────────────────────────────────────────────

describe('unknown command', () => {
  test('logs a warning and advances', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { onDone } = run({ cmd: 'totally_fake_command' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"totally_fake_command"'),
      expect.anything(),
    );
    expect(onDone).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── branching and sequencing ─────────────────────────────────────────────────

describe('command sequencing', () => {
  test('commands after a branch continue executing', () => {
    store.state.game.gameFlags.FLAG = true;
    const scene = makeScene();
    new ScriptRunner(scene, [
      { cmd: 'if_flag', key: 'FLAG', then: [{ cmd: 'give_item', item: 'Potion' }], else: [] },
      { cmd: 'heal_party' },
    ]).run();
    expect(store.commit).toHaveBeenCalledWith('bag/PICKUP', { name: 'Potion', qty: 1 });
    expect(store.commit).toHaveBeenCalledWith('party/RESTORE_ALL');
  });

  test('nested branches inject commands at front of queue in order', () => {
    const order = [];
    const scene = makeScene();
    scene.registry.set = jest.fn((k, v) => { order.push(v); });
    new ScriptRunner(scene, [
      {
        cmd: 'if_flag',
        key: 'MISSING',
        then: [],
        else: [
          { cmd: 'enable_input' },   // this sets player_input=true
          { cmd: 'disable_input' },  // this sets player_input=false
        ],
      },
    ]).run();
    expect(order).toEqual([true, false]);
  });
});
