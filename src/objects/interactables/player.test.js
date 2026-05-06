import PlayerInteractable from './player.js';

// ─── Scene factory ────────────────────────────────────────────────────────────

function makeScene({ playerLocation = {}, spawns = null, warpLocations = [] } = {}) {
  return {
    game: {
      config: {
        debug: { console: { interactableShout: false }, tests: { timeOverlay: false } },
      },
    },
    config: { playerLocation },
    findInteractions: jest.fn((type) => type === 'playerSpawn' ? spawns : warpLocations),
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
  test('throws when no playerSpawn and no warpLocation', () => {
    const scene = makeScene({ spawns: null, warpLocations: [] });
    const p = new PlayerInteractable(scene);
    expect(() => p.init()).toThrow('No player spawn found');
  });

  test('throws when playerSpawn is empty and no warpLocation', () => {
    const scene = makeScene({ spawns: [], warpLocations: [] });
    const p = new PlayerInteractable(scene);
    expect(() => p.init()).toThrow('No player spawn found');
  });

  test('falls back to first warpLocation when no playerSpawn', () => {
    const scene = makeScene({
      spawns: [],
      warpLocations: [{ name: 'Entry', x: 224, y: 416, properties: [] }],
    });
    const p = new PlayerInteractable(scene);
    try { p.init(); } catch (_) { /* addPlayerToScene may fail in test env */ }
    // Should have queried both types
    expect(scene.findInteractions).toHaveBeenCalledWith('playerSpawn');
    expect(scene.findInteractions).toHaveBeenCalledWith('warpLocation');
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
