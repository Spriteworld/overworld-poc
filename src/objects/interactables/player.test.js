import PlayerInteractable from './player.js';

// ─── Scene factory ────────────────────────────────────────────────────────────

function makeScene({ playerLocation = {}, spawns = null } = {}) {
  return {
    game: {
      config: {
        debug: { console: { interactableShout: false }, tests: { timeOverlay: false } },
      },
    },
    config: { playerLocation },
    findInteractions: jest.fn(() => spawns),
    registry:  { set: jest.fn() },
    cameras: {
      main: {
        startFollow:    jest.fn(),
        setFollowOffset: jest.fn(),
        setSize:        jest.fn(),
      },
    },
    characters: new Map(),
    gridEngine: { addCharacter: jest.fn() },
    add:        { existing: jest.fn(), rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn().mockReturnThis(), setName: jest.fn().mockReturnThis() }) },
  };
}

// ─── init — spawn validation ──────────────────────────────────────────────────

describe('PlayerInteractable.init spawn validation', () => {
  test('throws when findInteractions returns null', () => {
    const scene = makeScene({ spawns: null });
    const p = new PlayerInteractable(scene);
    expect(() => p.init()).toThrow('No player spawn found');
  });

  test('throws when findInteractions returns an empty array', () => {
    const scene = makeScene({ spawns: [] });
    const p = new PlayerInteractable(scene);
    expect(() => p.init()).toThrow('No player spawn found');
  });

  test('throws when more than one playerSpawn is found', () => {
    const scene = makeScene({
      spawns: [
        { x: 32, y: 64 },
        { x: 96, y: 64 },
      ],
    });
    const p = new PlayerInteractable(scene);
    expect(() => p.init()).toThrow('Only 1 player spawn can be in the map.');
  });

  test('skips spawn check entirely when playerLocation has keys', () => {
    const scene = makeScene({ playerLocation: { x: 5, y: 10 } });
    const p = new PlayerInteractable(scene);
    // findInteractions should NOT be called — warp location bypasses spawn lookup.
    // We only verify the guard is skipped; addPlayerToScene itself needs a full Phaser scene.
    try { p.init(); } catch (_) { /* addPlayerToScene may fail in test env */ }
    expect(scene.findInteractions).not.toHaveBeenCalled();
  });
});
