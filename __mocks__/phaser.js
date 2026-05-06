/**
 * Manual Jest mock for the 'phaser' package.
 * Covers the surface area used by character-claude source files.
 */

class EventEmitter {
  constructor() { this._handlers = {}; }

  on(event, fn, ctx) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push({ fn, ctx, once: false });
    return this;
  }

  once(event, fn, ctx) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push({ fn, ctx, once: true });
    return this;
  }

  off(event, fn, ctx) {
    if (!this._handlers[event]) return this;
    this._handlers[event] = this._handlers[event].filter(
      h => !(h.fn === fn && (ctx === undefined || h.ctx === ctx))
    );
    return this;
  }

  emit(event, ...args) {
    const handlers = [...(this._handlers[event] || [])];
    this._handlers[event] = (this._handlers[event] || []).filter(h => !h.once);
    for (const h of handlers) {
      h.fn.call(h.ctx, ...args);
    }
    return this;
  }

  listenerCount(event) {
    return (this._handlers[event] || []).length;
  }
}

class Vector2 {
  constructor(x, y) {
    this.x = parseInt(x) || 0;
    this.y = parseInt(y) || 0;
  }
}

function makeRect() {
  const r = {
    x: 0, y: 0, width: 0, height: 0,
    setOrigin: jest.fn().mockReturnThis(),
    setName: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setAlpha: jest.fn().mockReturnThis(),
    setVisible: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };
  return r;
}

class Sprite {
  constructor(scene, x, y, texture, frame) {
    this.scene = scene;
    this.x = x || 0;
    this.y = y || 0;
    this.texture = texture;
    this.frame = frame;
    this.name = '';
    this.width = 16;
    this.height = 16;
    this.visible = true;
  }
  setName(n) { this.name = n; return this; }
  setVisible(v) { this.visible = v; return this; }
  setDepth() { return this; }
  setOrigin() { return this; }
  setScale() { return this; }
  setAlpha() { return this; }
  play() { return this; }
  getBounds() { return { x: this.x * 32, y: this.y * 32, width: 16, height: 16 }; }
  destroy() {}
}

class Scene {
  constructor(config) { this.sys = { settings: config || {} }; }
}

const Phaser = {
  Game: class {},
  Scene,
  GameObjects: {
    Sprite,
    Container: class {
      constructor() { this.list = []; this.visible = true; }
      add(i) { this.list.push(i); return this; }
      setVisible(v) { this.visible = v; return this; }
      setDepth() { return this; }
      destroy() {}
    },
    Graphics: class {
      fillStyle() { return this; }
      fillRect() { return this; }
      fillGradientStyle() { return this; }
      fillEllipse() { return this; }
      lineStyle() { return this; }
      strokeRect() { return this; }
      lineBetween() { return this; }
      destroy() {}
    },
    Text: class {
      constructor() { this._text = ''; }
      setText(t) { this._text = t; return this; }
      setColor() { return this; }
      setOrigin() { return this; }
      destroy() {}
    },
    Rectangle: makeRect,
  },
  Events: { EventEmitter },
  Math: {
    Vector2,
    RND: { pick: (arr) => arr[0] },
    Between: (a, b) => a,
  },
  Utils: {
    Objects: {
      GetValue: (obj, key, def) => (obj != null && key in obj ? obj[key] : def),
    },
  },
  Cameras: {
    Scene2D: {
      Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' },
    },
  },
};

module.exports = Phaser;
module.exports.default = Phaser;
