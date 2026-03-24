import SpinTile from './spintile.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScene({ spinTiles = [], stopTiles = [], tileProps = new Map() } = {}) {
  return {
    game: { config: { debug: { console: { interactableShout: false } } } },
    getTilesWithProperty: jest.fn(prop => {
      if (prop === 'sw_spin') return spinTiles;
      if (prop === 'sw_stop') return stopTiles;
      return [];
    }),
    getTileProperties: jest.fn(() => tileProps),
    characters: new Map(),
    gridEngine: {
      positionChangeStarted: jest.fn(() => ({ subscribe: jest.fn() })),
      movementStopped:       jest.fn(() => ({ subscribe: jest.fn() })),
    },
  };
}

function makeChar({ spinning = false, spinningDir = null } = {}) {
  return {
    isDumbCharacter:      jest.fn(() => false),
    isSpinning:           jest.fn(() => spinning),
    getSpinningDirection: jest.fn(() => spinningDir),
    setSpinDirection:     jest.fn(),
    stateMachine: { setState: jest.fn() },
    stateDef: { SPIN: 'spin', IDLE: 'idle' },
  };
}

function makeSpinTile({ spinTiles = [], stopTiles = [], tileProps = new Map() } = {}) {
  const scene = makeScene({ spinTiles, stopTiles, tileProps });
  const spin  = new SpinTile(scene);
  spin.spinTiles = spinTiles;
  spin.stopTiles = stopTiles;
  return spin;
}

// ─── handleSpinTiles ──────────────────────────────────────────────────────────

describe('SpinTile.handleSpinTiles', () => {
  test('sets SPIN when entering a spin tile and not yet spinning', () => {
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map([['sw_spin', 'down']]),
    });
    const char = makeChar({ spinning: false, spinningDir: null });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('spin');
  });

  test('does not set SPIN again when already spinning', () => {
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map([['sw_spin', 'down']]),
    });
    const char = makeChar({ spinning: true, spinningDir: 'down' });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('calls setSpinDirection when tile direction differs from character spinningDir', () => {
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map([['sw_spin', 'left']]),
    });
    const char = makeChar({ spinning: true, spinningDir: 'down' });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    expect(char.setSpinDirection).toHaveBeenCalledWith('left');
  });

  test('does not call setSpinDirection when direction already matches', () => {
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map([['sw_spin', 'down']]),
    });
    const char = makeChar({ spinning: true, spinningDir: 'down' });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    expect(char.setSpinDirection).not.toHaveBeenCalled();
  });

  test('falls back to getSpinningDirection when tile has no sw_spin value', () => {
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map(), // no sw_spin key → props.get returns undefined → dir = false → uses getSpinningDirection()
    });
    const char = makeChar({ spinning: true, spinningDir: 'right' });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    // dir falls back to getSpinningDirection() = 'right'; already spinning so setState not called
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
    // direction matches so setSpinDirection not called either
    expect(char.setSpinDirection).not.toHaveBeenCalled();
  });

  test('sets SPIN when tile has no sw_spin and getSpinningDirection returns null — null !== false is truthy', () => {
    // dir = props.get('sw_spin') → undefined → false → dir = getSpinningDirection() → null
    // null !== false is true, so SPIN fires
    const spin = makeSpinTile({
      spinTiles: [[4, 6]],
      tileProps: new Map(),
    });
    const char = makeChar({ spinning: false, spinningDir: null });
    spin.handleSpinTiles(char, { x: 3, y: 6 }, { x: 4, y: 6 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('spin');
  });

  test('sets IDLE when entering a stop tile while spinning', () => {
    // handleSpinTiles returns early if spinTiles is empty, so we need a dummy spin tile
    const spin = makeSpinTile({
      spinTiles: [[99, 99]], // not entered, but prevents early return
      stopTiles: [[7, 2]],
    });
    const char = makeChar({ spinning: true });
    spin.handleSpinTiles(char, { x: 6, y: 2 }, { x: 7, y: 2 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('idle');
  });

  test('does not set IDLE for stop tile when character is not spinning', () => {
    const spin = makeSpinTile({
      spinTiles: [[99, 99]],
      stopTiles: [[7, 2]],
    });
    const char = makeChar({ spinning: false });
    spin.handleSpinTiles(char, { x: 6, y: 2 }, { x: 7, y: 2 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('does nothing when there are no spin tiles', () => {
    const spin = makeSpinTile({ spinTiles: [], stopTiles: [] });
    const char = makeChar();
    spin.handleSpinTiles(char, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
    expect(char.setSpinDirection).not.toHaveBeenCalled();
  });

  test('entering a non-spin non-stop tile does nothing', () => {
    const spin = makeSpinTile({ spinTiles: [[4, 6]], stopTiles: [[7, 2]] });
    const char = makeChar({ spinning: true });
    spin.handleSpinTiles(char, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });
});
