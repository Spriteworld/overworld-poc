import MovableSprite from './MovableSprite.js';
import { Vector2 } from '@Utilities';

// ─── Scene / GridEngine factory ───────────────────────────────────────────────

function makeGridEngine(pos = { x: 0, y: 0 }) {
  return {
    addCharacter:    jest.fn(),
    removeCharacter: jest.fn(),
    hasCharacter:    jest.fn(() => true),
    move:            jest.fn(),
    moveTo:          jest.fn(),
    isMoving:        jest.fn(() => false),
    stopMovement:    jest.fn(),
    getPosition:     jest.fn(() => pos),
    getFacingDirection: jest.fn(() => 'down'),
    getFacingPosition:  jest.fn(() => pos),
    turnTowards:     jest.fn(),
    isBlocked:       jest.fn(() => false),
  };
}

function makeSprite(pos = { x: 0, y: 0 }) {
  const gridEngine = makeGridEngine(pos);
  const scene = { gridEngine };
  const sprite = new MovableSprite({ scene, id: 'test', x: pos.x, y: pos.y, texture: 't' });
  return { sprite, gridEngine, scene };
}

// ─── isInArea ─────────────────────────────────────────────────────────────────

describe('MovableSprite.isInArea', () => {
  test('returns true when character is inside the area', () => {
    const { sprite } = makeSprite({ x: 3, y: 5 });
    expect(sprite.isInArea(Vector2(1, 3), Vector2(5, 7))).toBe(true);
  });

  test('returns false when character is outside the area', () => {
    const { sprite } = makeSprite({ x: 10, y: 10 });
    expect(sprite.isInArea(Vector2(1, 1), Vector2(5, 5))).toBe(false);
  });

  test('returns true when character is on the top-left boundary', () => {
    const { sprite } = makeSprite({ x: 2, y: 4 });
    expect(sprite.isInArea(Vector2(2, 4), Vector2(6, 8))).toBe(true);
  });

  test('returns true when character is on the bottom-right boundary', () => {
    const { sprite } = makeSprite({ x: 6, y: 8 });
    expect(sprite.isInArea(Vector2(2, 4), Vector2(6, 8))).toBe(true);
  });

  test('returns false when character is one tile outside the boundary', () => {
    const { sprite } = makeSprite({ x: 7, y: 5 });
    expect(sprite.isInArea(Vector2(2, 4), Vector2(6, 8))).toBe(false);
  });

  test('returns false for a single-tile area when character is not on that tile', () => {
    const { sprite } = makeSprite({ x: 5, y: 5 });
    expect(sprite.isInArea(Vector2(3, 3), Vector2(3, 3))).toBe(false);
  });

  test('returns true for a single-tile area when character is on that tile', () => {
    const { sprite } = makeSprite({ x: 3, y: 3 });
    expect(sprite.isInArea(Vector2(3, 3), Vector2(3, 3))).toBe(true);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('MovableSprite.remove', () => {
  test('calls gridengine.removeCharacter with the character id', () => {
    const gridEngine = makeGridEngine();
    const scene = { gridEngine };
    const sprite = new MovableSprite({ scene, id: 'hero', x: 0, y: 0, texture: 't' });

    sprite.remove();

    expect(gridEngine.removeCharacter).toHaveBeenCalledWith('hero');
  });

  test('does not throw', () => {
    const { sprite } = makeSprite();
    expect(() => sprite.remove()).not.toThrow();
  });
});
