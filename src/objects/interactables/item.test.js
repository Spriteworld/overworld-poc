import Phaser from 'phaser';
import Item from './item.js';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeScene({ itemName = 'Potion', charExists = true } = {}) {
  const gameEvents = new Phaser.Events.EventEmitter();
  const char = { remove: jest.fn() };
  return {
    game: {
      events: gameEvents,
      config: { debug: { console: { interactableShout: false } } },
    },
    getPropertyFromTile: jest.fn(() => itemName),
    removeInteraction:   jest.fn(),
    characters:          new Map(charExists ? [['item1', char]] : []),
    _char:               char,
  };
}

function makeTile(overrides = {}) {
  return {
    obj: { type: 'item', id: 'item1', ...overrides },
  };
}

// ─── event routing ────────────────────────────────────────────────────────────

describe('Item event routing', () => {
  test('emits textbox-changedata with "You found a X!" message', () => {
    const scene = makeScene({ itemName: 'Potion' });
    const item  = new Item(scene);
    item.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', makeTile());

    expect(listener).toHaveBeenCalledWith(
      'You found a Potion!',
      expect.objectContaining({ type: 'item' })
    );
  });

  test('ignores interact-with-obj events for non-item types', () => {
    const scene = makeScene();
    const item  = new Item(scene);
    item.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', { obj: { type: 'sign', id: 'sign1' } });

    expect(listener).not.toHaveBeenCalled();
  });

  test('does nothing when tile has no item property', () => {
    const scene = makeScene({ itemName: null });
    const item  = new Item(scene);
    item.event();

    const listener = jest.fn();
    scene.game.events.on('textbox-changedata', listener);
    scene.game.events.emit('interact-with-obj', makeTile());

    expect(listener).not.toHaveBeenCalled();
  });

  test('emits item-pickup with item name on textbox-disable', () => {
    const scene = makeScene({ itemName: 'Rare Candy' });
    const item  = new Item(scene);
    item.event();

    const pickupListener = jest.fn();
    scene.game.events.on('item-pickup', pickupListener);

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');

    expect(pickupListener).toHaveBeenCalledWith('Rare Candy');
  });

  test('removes interaction on textbox-disable', () => {
    const scene = makeScene();
    const item  = new Item(scene);
    item.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');

    expect(scene.removeInteraction).toHaveBeenCalledWith('item1');
  });

  test('removes char on textbox-disable when character exists', () => {
    const scene = makeScene({ charExists: true });
    const item  = new Item(scene);
    item.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');

    expect(scene._char.remove).toHaveBeenCalledTimes(1);
  });

  test('skips char.remove() when character is not in the scene', () => {
    const scene = makeScene({ charExists: false });
    const item  = new Item(scene);
    item.event();

    scene.game.events.emit('interact-with-obj', makeTile());
    expect(() => scene.game.events.emit('textbox-disable')).not.toThrow();
    expect(scene.removeInteraction).toHaveBeenCalledWith('item1');
  });

  test('textbox-disable fires only once — second dialog does not pick up again', () => {
    const scene = makeScene();
    const item  = new Item(scene);
    item.event();

    const pickupListener = jest.fn();
    scene.game.events.on('item-pickup', pickupListener);

    scene.game.events.emit('interact-with-obj', makeTile());
    scene.game.events.emit('textbox-disable');
    scene.game.events.emit('textbox-disable'); // spurious second emission

    expect(pickupListener).toHaveBeenCalledTimes(1);
    expect(scene.removeInteraction).toHaveBeenCalledTimes(1);
  });
});
