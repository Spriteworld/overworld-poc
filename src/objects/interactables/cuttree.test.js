import Phaser from 'phaser';
import CutTree from './cuttree.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScene({ hasCut = true, text = 'This tree can be cut.', charExists = true } = {}) {
  const gameEvents = new Phaser.Events.EventEmitter();
  const char = { remove: jest.fn() };
  return {
    game: {
      events: gameEvents,
      config: {
        debug: { console: { interactableShout: false } },
        gameFlags: { has_cut: hasCut },
      },
    },
    getPropertyFromTile: jest.fn(() => text),
    removeInteraction:   jest.fn(),
    characters:          new Map(charExists ? [['tree1', char]] : []),
    _char:               char,
  };
}

function makeTile(overrides = {}) {
  return {
    obj: { type: 'cut-tree', id: 'tree1', ...overrides },
  };
}

// ─── event routing ────────────────────────────────────────────────────────────

describe('CutTree event routing', () => {
  test('emits textbox-changedata with tile text when interacting with a cut-tree', () => {
    const scene   = makeScene();
    const cutTree = new CutTree(scene);
    cutTree.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', makeTile());

    expect(listener).toHaveBeenCalledWith('This tree can be cut.', expect.objectContaining({ type: 'cut-tree' }));
  });

  test('ignores interact-with-obj events for non-cut-tree types', () => {
    const scene   = makeScene();
    const cutTree = new CutTree(scene);
    cutTree.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', { obj: { type: 'sign', id: 'sign1' } });

    expect(listener).not.toHaveBeenCalled();
  });

  test('does nothing when tile has no text property', () => {
    const scene   = makeScene({ text: null });
    const cutTree = new CutTree(scene);
    cutTree.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', makeTile());

    expect(listener).not.toHaveBeenCalled();
  });

  test('does not register textbox-disable when has_cut is false', () => {
    const scene   = makeScene({ hasCut: false });
    const cutTree = new CutTree(scene);
    cutTree.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');

    expect(scene.removeInteraction).not.toHaveBeenCalled();
    expect(scene._char.remove).not.toHaveBeenCalled();
  });

  test('removes interaction and char on textbox-disable when has_cut is true', () => {
    const scene   = makeScene({ hasCut: true });
    const cutTree = new CutTree(scene);
    cutTree.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');

    expect(scene.removeInteraction).toHaveBeenCalledWith('tree1');
    expect(scene._char.remove).toHaveBeenCalledTimes(1);
  });

  test('textbox-disable fires only once — second dialog does not remove again', () => {
    const scene   = makeScene({ hasCut: true });
    const cutTree = new CutTree(scene);
    cutTree.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');
    scene.game.events.emit('textbox-disable'); // spurious second emission

    expect(scene.removeInteraction).toHaveBeenCalledTimes(1);
  });

  test('skips char.remove() when character is not in the scene', () => {
    const scene   = makeScene({ hasCut: true, charExists: false });
    const cutTree = new CutTree(scene);
    cutTree.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    expect(() => scene.game.events.emit('textbox-disable')).not.toThrow();
    expect(scene.removeInteraction).toHaveBeenCalledWith('tree1');
  });
});
