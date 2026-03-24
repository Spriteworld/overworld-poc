import Warp from './warp.js';

// ─── Scene factory ───────────────────────────────────────────────────────────

function makeScene(warpObjects = []) {
  const store = {};
  return {
    game: {
      config: { debug: { console: { interactableShout: false } } },
    },
    registry: {
      get: (key) => store[key],
      set: (key, val) => { store[key] = val; },
    },
    gridEngine: {
      positionChangeStarted: () => ({ subscribe: jest.fn() }),
    },
    characters: new Map(),
    findInteractions: jest.fn((type) => type === 'warp' ? warpObjects : []),
  };
}

/**
 * Build a Tiled-style warp object using pixel coordinates (as Tiled exports them).
 * width/height are in tile units and are converted to pixels internally.
 */
function makeWarpObj({ x, y, width = 1, height = 1, warpTo = 'Route1', warpX = 5, warpY = 3, id = 1 }) {
  return {
    id,
    x: x * 32,
    y: y * 32,
    width: width * 32,
    height: height * 32,
    properties: [
      { name: 'warp',     value: warpTo },
      { name: 'warp-x',  value: warpX  },
      { name: 'warp-y',  value: warpY  },
      { name: 'warp-dir', value: 'down' },
      { name: 'layer',    value: 'ground' },
    ],
  };
}

// ─── Coordinate storage ───────────────────────────────────────────────────────

describe('warp coordinate storage', () => {
  test('1×1 warp is stored in tile coordinates, not pixel coordinates', () => {
    const scene = makeScene([makeWarpObj({ x: 5, y: 3 })]);
    const warp = new Warp(scene);
    warp.init();

    expect(warp.warps).toHaveLength(1);
    expect(warp.warps[0].x).toBe(5);
    expect(warp.warps[0].y).toBe(3);
  });

  test('2×1 warp expands to two consecutive tile entries on the x axis', () => {
    const scene = makeScene([makeWarpObj({ x: 10, y: 7, width: 2, height: 1 })]);
    const warp = new Warp(scene);
    warp.init();

    expect(warp.warps).toHaveLength(2);
    expect(warp.warps[0]).toMatchObject({ x: 10, y: 7 });
    expect(warp.warps[1]).toMatchObject({ x: 11, y: 7 });
  });

  test('1×2 warp expands to two consecutive tile entries on the y axis', () => {
    const scene = makeScene([makeWarpObj({ x: 4, y: 2, width: 1, height: 2 })]);
    const warp = new Warp(scene);
    warp.init();

    expect(warp.warps).toHaveLength(2);
    expect(warp.warps[0]).toMatchObject({ x: 4, y: 2 });
    expect(warp.warps[1]).toMatchObject({ x: 4, y: 3 });
  });

  test('2×2 warp expands to four tile entries', () => {
    const scene = makeScene([makeWarpObj({ x: 2, y: 2, width: 2, height: 2 })]);
    const warp = new Warp(scene);
    warp.init();

    expect(warp.warps).toHaveLength(4);
    const positions = warp.warps.map(w => `${w.x},${w.y}`);
    expect(positions).toContain('2,2');
    expect(positions).toContain('3,2');
    expect(positions).toContain('2,3');
    expect(positions).toContain('3,3');
  });
});

// ─── handleWarps matching ─────────────────────────────────────────────────────

describe('handleWarps tile-coordinate matching', () => {
  function playerChar() {
    return { config: { type: 'player', 'ignore-warp': false } };
  }

  test('fires when enterTile exactly matches a registered warp', () => {
    const scene = makeScene([makeWarpObj({ x: 5, y: 3 })]);
    const warp = new Warp(scene);
    warp.init();
    warp.warpPlayerToMap = jest.fn();

    warp.handleWarps(playerChar(), { x: 4, y: 3 }, { x: 5, y: 3 });

    expect(warp.warpPlayerToMap).toHaveBeenCalled();
  });

  test('does not fire when enterTile is one tile off', () => {
    const scene = makeScene([makeWarpObj({ x: 5, y: 3 })]);
    const warp = new Warp(scene);
    warp.init();
    warp.warpPlayerToMap = jest.fn();

    warp.handleWarps(playerChar(), { x: 5, y: 3 }, { x: 6, y: 3 });

    expect(warp.warpPlayerToMap).not.toHaveBeenCalled();
  });

  test('all cells of a multi-tile warp trigger independently', () => {
    const scene = makeScene([makeWarpObj({ x: 10, y: 7, width: 2, height: 1 })]);
    const warp = new Warp(scene);
    warp.init();
    warp.warpPlayerToMap = jest.fn();

    warp.handleWarps(playerChar(), { x: 9, y: 7 }, { x: 10, y: 7 });
    expect(warp.warpPlayerToMap).toHaveBeenCalledTimes(1);

    warp.warpPlayerToMap.mockClear();
    warp.handleWarps(playerChar(), { x: 10, y: 7 }, { x: 11, y: 7 });
    expect(warp.warpPlayerToMap).toHaveBeenCalledTimes(1);
  });
});
