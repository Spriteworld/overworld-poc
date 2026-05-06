import Ledge from './ledge.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScene(ledgeTiles = []) {
  return {
    game: { config: { debug: { console: { interactableShout: false } } } },
    getTilesWithProperty: jest.fn(() => ledgeTiles),
    characters: new Map(),
    gridEngine: {
      positionChangeStarted: jest.fn(() => ({ subscribe: jest.fn() })),
    },
  };
}

function makeChar(overrides = {}) {
  return {
    isDumbCharacter: jest.fn(() => false),
    stateMachine: { setState: jest.fn() },
    stateDef: { JUMP_LEDGE: 'jumpLedge' },
    ...overrides,
  };
}

function makeLedge(ledgeTiles = []) {
  const ledge = new Ledge(makeScene(ledgeTiles));
  ledge.ledgeTiles = ledgeTiles;
  return ledge;
}

// ─── handleJumps ─────────────────────────────────────────────────────────────

describe('Ledge.handleJumps', () => {
  test('sets JUMP_LEDGE when enterTile matches a ledge tile', () => {
    const ledge = makeLedge([[5, 3]]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 4, y: 3 }, { x: 5, y: 3 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('jumpLedge');
  });

  test('does not set state when enterTile is not a ledge tile', () => {
    const ledge = makeLedge([[5, 3]]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 4, y: 3 }, { x: 6, y: 3 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('does not set state when ledgeTiles is empty', () => {
    const ledge = makeLedge([]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 4, y: 3 }, { x: 5, y: 3 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('checks x and y independently — wrong x does not match', () => {
    const ledge = makeLedge([[5, 3]]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 4, y: 3 }, { x: 5, y: 4 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('uses loose equality — string tile coords match numeric enterTile', () => {
    const ledge = makeLedge([['5', '3']]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 4, y: 3 }, { x: 5, y: 3 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('jumpLedge');
  });

  test('matches the correct tile when multiple ledge tiles exist', () => {
    const ledge = makeLedge([[1, 1], [5, 3], [9, 7]]);
    const char  = makeChar();
    ledge.handleJumps(char, { x: 8, y: 7 }, { x: 9, y: 7 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('jumpLedge');
  });
});

// ─── event subscription guards ────────────────────────────────────────────────

describe('Ledge.event', () => {
  test('does not subscribe when ledgeTiles is empty', () => {
    const scene = makeScene([]);
    const ledge = new Ledge(scene);
    ledge.ledgeTiles = [];
    ledge.event();
    expect(scene.gridEngine.positionChangeStarted).not.toHaveBeenCalled();
  });

  test('subscribes to positionChangeStarted when ledgeTiles exist', () => {
    const subscribe = jest.fn();
    const scene = makeScene([[3, 3]]);
    scene.gridEngine.positionChangeStarted = jest.fn(() => ({ subscribe }));
    const ledge = new Ledge(scene);
    ledge.ledgeTiles = [[3, 3]];
    ledge.event();
    expect(subscribe).toHaveBeenCalled();
  });

  test('skips dumb characters inside the subscription', () => {
    let handler;
    const scene = makeScene([[3, 3]]);
    scene.gridEngine.positionChangeStarted = jest.fn(() => ({
      subscribe: jest.fn(fn => { handler = fn; }),
    }));
    const char = makeChar({ isDumbCharacter: jest.fn(() => true) });
    scene.characters.set('npc1', char);

    const ledge = new Ledge(scene);
    ledge.ledgeTiles = [[3, 3]];
    ledge.event();

    handler({ charId: 'npc1', exitTile: { x: 2, y: 3 }, enterTile: { x: 3, y: 3 } });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('skips unknown characters inside the subscription', () => {
    let handler;
    const scene = makeScene([[3, 3]]);
    scene.gridEngine.positionChangeStarted = jest.fn(() => ({
      subscribe: jest.fn(fn => { handler = fn; }),
    }));

    const ledge = new Ledge(scene);
    ledge.ledgeTiles = [[3, 3]];
    ledge.event();

    // no character registered for 'ghost'
    expect(() => handler({ charId: 'ghost', exitTile: { x: 2, y: 3 }, enterTile: { x: 3, y: 3 } })).not.toThrow();
  });
});
