import SlideTile from './slidetile.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScene(iceTiles = []) {
  return {
    game: { config: { debug: { console: { interactableShout: false } } } },
    getTilesWithProperty: jest.fn(() => iceTiles),
    characters: new Map(),
    gridEngine: {
      positionChangeStarted: jest.fn(() => ({ subscribe: jest.fn() })),
      movementStopped:       jest.fn(() => ({ subscribe: jest.fn() })),
    },
  };
}

function makeChar({ sliding = false } = {}) {
  const char = {
    isDumbCharacter: jest.fn(() => false),
    isSliding:       jest.fn(() => sliding),
    slidingDir:      sliding ? 'down' : null,
    stateMachine:    { setState: jest.fn() },
    stateDef:        { SLIDE: 'slide', IDLE: 'idle' },
  };
  char._returnToBaseMovement = () => char.stateMachine.setState(char.stateDef.IDLE);
  return char;
}

function makeSlide(iceTiles = []) {
  const slide = new SlideTile(makeScene(iceTiles));
  slide.iceTiles = iceTiles;
  return slide;
}

// ─── handleIceTiles ───────────────────────────────────────────────────────────

describe('SlideTile.handleIceTiles', () => {
  test('sets SLIDE when entering an ice tile and not already sliding', () => {
    const slide = makeSlide([[3, 5]]);
    const char  = makeChar({ sliding: false });
    slide.handleIceTiles(char, { x: 2, y: 5 }, { x: 3, y: 5 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('slide');
  });

  test('does not set SLIDE when already sliding onto an ice tile', () => {
    const slide = makeSlide([[3, 5]]);
    const char  = makeChar({ sliding: true });
    slide.handleIceTiles(char, { x: 2, y: 5 }, { x: 3, y: 5 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('sets IDLE when leaving an ice tile while sliding', () => {
    const slide = makeSlide([[3, 5]]);
    const char  = makeChar({ sliding: true });
    slide.handleIceTiles(char, { x: 3, y: 5 }, { x: 4, y: 5 });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('idle');
  });

  test('does not change state entering a non-ice tile while not sliding', () => {
    const slide = makeSlide([[3, 5]]);
    const char  = makeChar({ sliding: false });
    slide.handleIceTiles(char, { x: 1, y: 1 }, { x: 2, y: 1 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('does not set IDLE when leaving a non-ice tile without sliding', () => {
    const slide = makeSlide([[3, 5]]);
    const char  = makeChar({ sliding: false });
    slide.handleIceTiles(char, { x: 3, y: 5 }, { x: 4, y: 5 });
    // enterTile 4,5 is not ice and char is not sliding — no state change
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });

  test('does nothing when iceTiles list is empty', () => {
    const slide = makeSlide([]);
    const char  = makeChar({ sliding: false });
    slide.handleIceTiles(char, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });
});

// ─── movementStopped subscription ────────────────────────────────────────────

describe('SlideTile movementStopped subscription', () => {
  test('sets IDLE when movement stops and slidingDir is not null', () => {
    let handler;
    const scene = makeScene([[3, 5]]);
    scene.gridEngine.movementStopped = jest.fn(() => ({
      subscribe: jest.fn(fn => { handler = fn; }),
    }));
    const slide = new SlideTile(scene);
    slide.iceTiles = [[3, 5]];
    slide.event();

    const char = makeChar({ sliding: true });
    char.slidingDir = 'down';
    scene.characters.set('player', char);

    handler({ charId: 'player', direction: 'down' });
    expect(char.stateMachine.setState).toHaveBeenCalledWith('idle');
  });

  test('does not set IDLE when movement stops and slidingDir is null', () => {
    let handler;
    const scene = makeScene([[3, 5]]);
    scene.gridEngine.movementStopped = jest.fn(() => ({
      subscribe: jest.fn(fn => { handler = fn; }),
    }));
    const slide = new SlideTile(scene);
    slide.iceTiles = [[3, 5]];
    slide.event();

    const char = makeChar({ sliding: false });
    char.slidingDir = null;
    scene.characters.set('player', char);

    handler({ charId: 'player', direction: 'down' });
    expect(char.stateMachine.setState).not.toHaveBeenCalled();
  });
});
