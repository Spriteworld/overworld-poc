import Phaser from 'phaser';
import Character from './Character.js';

// ─── Scene factory ────────────────────────────────────────────────────────────

function makeScene() {
  const gameEvents = new Phaser.Events.EventEmitter();

  function makeRect() {
    return {
      x: 0, y: 0,
      setOrigin: jest.fn().mockReturnThis(),
      setName:   jest.fn().mockReturnThis(),
    };
  }

  return {
    characters: new Map(),
    game: {
      events: gameEvents,
      config: {
        debug: {
          console:   { character: false },
          tests:     { rectOutlines: false },
          stateMachine: false,
        },
      },
    },
    gridEngine: {
      addCharacter: jest.fn(),
    },
    add: {
      existing:  jest.fn(),
      rectangle: jest.fn(makeRect),
    },
    addCharacter: jest.fn(),
  };
}

function makeCharacter(scene, overrides = {}) {
  return new Character({
    scene,
    id:      'npc1',
    x:       0,
    y:       0,
    texture: 'red',
    spin:    true,
    ...overrides,
  });
}

// ─── stopSpin / startSpin listener behaviour ──────────────────────────────────

describe('Character.stopSpin listener behaviour', () => {
  test('startSpin is called when textbox-disable fires after stopSpin(true)', () => {
    const scene = makeScene();
    const char = makeCharacter(scene);
    const spy = jest.spyOn(char, 'startSpin');

    char.stopSpin(true);
    scene.game.events.emit('textbox-disable');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('startSpin fires only once — listener is removed after the first textbox-disable (once, not on)', () => {
    const scene = makeScene();
    const char = makeCharacter(scene);
    const spy = jest.spyOn(char, 'startSpin');

    char.stopSpin(true);

    scene.game.events.emit('textbox-disable'); // closes dialog → spin restarts
    scene.game.events.emit('textbox-disable'); // another unrelated textbox elsewhere

    expect(spy).toHaveBeenCalledTimes(1);      // must not fire a second time
  });

  test('startSpin fires once when stopSpin(false) is called — no listener is registered', () => {
    const scene = makeScene();
    const char = makeCharacter(scene);
    const spy = jest.spyOn(char, 'startSpin');

    char.stopSpin(false);
    scene.game.events.emit('textbox-disable');

    expect(spy).not.toHaveBeenCalled();
  });

  test('startSpin fires once per dialog even across multiple interactions', () => {
    const scene = makeScene();
    const char = makeCharacter(scene);
    const spy = jest.spyOn(char, 'startSpin');

    // First interaction
    char.stopSpin(true);
    scene.game.events.emit('textbox-disable');
    expect(spy).toHaveBeenCalledTimes(1);

    // Second interaction
    char.stopSpin(true);
    scene.game.events.emit('textbox-disable');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
