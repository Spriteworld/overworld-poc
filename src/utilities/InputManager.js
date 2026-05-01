/**
 * InputManager — centralised keyboard / mobile input for the overworld.
 *
 * Provides two complementary APIs:
 *   • Poll:  isDown(action), getDuration(action)   — for per-frame movement checks
 *   • Event: on/once/off(action, cb)               — for one-shot menu navigation
 *
 * Mobile controls drive the manager directly via press() / release() instead
 * of dispatching synthetic KeyboardEvents.
 *
 * Usage:
 *   import { createInputManager, getInputManager, Action } from '@Utilities/InputManager.js';
 *
 *   // In OverworldUI.create():
 *   createInputManager(this);
 *
 *   // Anywhere input is needed:
 *   const im = getInputManager();
 *   im.isDown(Action.LEFT)
 *   im.on(Action.CONFIRM, handler)
 *   im.press(Action.UP)   // called by MobileControls
 */

export const Action = Object.freeze({
  UP:       'up',
  DOWN:     'down',
  LEFT:     'left',
  RIGHT:    'right',
  CONFIRM:  'confirm',
  CANCEL:   'cancel',
  /** Held modifier for running (X / C keys). */
  RUN:      'run',
  /** Open the pause menu (Enter key). */
  MENU:     'menu',
  /** Use the registered key item (Backspace key). */
  USE_ITEM: 'use_item',
});

/**
 * Standard gamepad button index → action(s).
 * Follows the standard mapping (Xbox / PS layout):
 *   0=A/Cross  1=B/Circle  2=X/Square  3=Y/Triangle
 *   8=Select   9=Start
 *   12=D-Up  13=D-Down  14=D-Left  15=D-Right
 */
const GAMEPAD_BUTTON_BINDINGS = {
  0:  [Action.CONFIRM],
  1:  [Action.CANCEL, Action.RUN],
  9:  [Action.MENU],
  12: [Action.UP],
  13: [Action.DOWN],
  14: [Action.LEFT],
  15: [Action.RIGHT],
};

const AXIS_THRESHOLD = 0.5;

/** Default keyboard → action mapping. One key may trigger multiple actions. */
const DEFAULT_BINDINGS = {
  ArrowUp:   [Action.UP],
  ArrowDown:  [Action.DOWN],
  ArrowLeft:  [Action.LEFT],
  ArrowRight: [Action.RIGHT],
  KeyZ:       [Action.CONFIRM],
  Enter:      [Action.MENU],
  KeyX:       [Action.CANCEL, Action.RUN],
  Escape:     [Action.CANCEL],
  KeyC:       [Action.RUN],
  Backspace:  [Action.USE_ITEM],
};

class InputManager {
  /**
   * @param {Phaser.Scene} scene - Scene whose keyboard plugin receives events.
   * @param {Object.<string, string[]>} [bindings] - event.code → action[] map.
   */
  constructor(scene, bindings = DEFAULT_BINDINGS) {
    this._scene     = scene;
    this._bindings  = bindings;
    this._held      = new Set();
    this._pressedAt = new Map();
    this._listeners = new Map();
    this._once      = new Map();
    this._inputMode = 'keyboard'; // 'keyboard' | 'controller'

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    scene.input.keyboard.on('keydown', this._onKeyDown);
    scene.input.keyboard.on('keyup',   this._onKeyUp);

    // Gamepad support
    this._axisActions = new Set(); // actions currently held via analog stick
    if (scene.input.gamepad) {
      this._onPadDown      = this._onPadDown.bind(this);
      this._onPadUp        = this._onPadUp.bind(this);
      this._onSceneUpdate  = this._onSceneUpdate.bind(this);
      this._padConnected       = false;
      this._onPadConnected     = this._onPadConnected.bind(this);
      this._onPadDisconnected  = this._onPadDisconnected.bind(this);
      scene.input.gamepad.on('connected',    this._onPadConnected);
      scene.input.gamepad.on('disconnected', this._onPadDisconnected);
      scene.input.gamepad.on('down', this._onPadDown);
      scene.input.gamepad.on('up',   this._onPadUp);
      scene.events.on('update', this._onSceneUpdate);
    }
  }

  // ─── Mobile / programmatic ─────────────────────────────────────────────────

  /**
   * Simulate an action press (called by MobileControls on touchstart/mousedown).
   * No-ops when already held so touch-hold doesn't re-trigger events.
   * @param {string} action - One of the Action constants.
   */
  press(action) {
    if (this._held.has(action)) return;
    this._held.add(action);
    this._pressedAt.set(action, Date.now());
    this._emit(action);
  }

  /**
   * Simulate an action release (called by MobileControls on touchend/mouseup).
   * @param {string} action - One of the Action constants.
   */
  release(action) {
    this._held.delete(action);
  }

  // ─── Poll API ──────────────────────────────────────────────────────────────

  /**
   * Returns true while the action key or button is currently held.
   * Use in per-frame update callbacks (movement, run modifier).
   * @param {string} action
   * @returns {boolean}
   */
  isDown(action) {
    return this._held.has(action);
  }

  /**
   * Returns milliseconds since the action was first pressed, or 0 if not held.
   * Used by Character.handleMove for the 150 ms directional-change debounce.
   * @param {string} action
   * @returns {number}
   */
  getDuration(action) {
    if (!this._held.has(action)) return 0;
    return Date.now() - (this._pressedAt.get(action) ?? Date.now());
  }

  // ─── Event API ─────────────────────────────────────────────────────────────

  /**
   * Register a persistent listener for an action.
   * Fires on the initial key press only — key-repeat is ignored.
   * @param {string} action
   * @param {Function} callback
   */
  on(action, callback) {
    if (!this._listeners.has(action)) this._listeners.set(action, new Set());
    this._listeners.get(action).add(callback);
  }

  /**
   * Remove a persistent listener.
   * @param {string} action
   * @param {Function} callback
   */
  off(action, callback) {
    this._listeners.get(action)?.delete(callback);
  }

  /**
   * Register a one-shot listener that fires once then removes itself.
   * @param {string} action
   * @param {Function} callback
   */
  once(action, callback) {
    if (!this._once.has(action)) this._once.set(action, new Set());
    this._once.get(action).add(callback);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Detach Phaser keyboard listeners and clear all internal state. */
  destroy() {
    this._scene.input.keyboard.off('keydown', this._onKeyDown);
    this._scene.input.keyboard.off('keyup',   this._onKeyUp);
    if (this._scene.input.gamepad) {
      this._scene.input.gamepad.off('connected',    this._onPadConnected);
      this._scene.input.gamepad.off('disconnected', this._onPadDisconnected);
      this._scene.input.gamepad.off('down', this._onPadDown);
      this._scene.input.gamepad.off('up',   this._onPadUp);
      this._scene.events.off('update', this._onSceneUpdate);
    }
    this._listeners.clear();
    this._once.clear();
    this._held.clear();
    this._pressedAt.clear();
    this._axisActions?.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _onKeyDown(event) {
    if (event.repeat) return;
    this._inputMode = 'keyboard';
    const actions = this._bindings[event.code] ?? [];
    for (const action of actions) {
      if (!this._held.has(action)) {
        this._held.add(action);
        this._pressedAt.set(action, Date.now());
        this._emit(action);
      }
    }
  }

  _onKeyUp(event) {
    const actions = this._bindings[event.code] ?? [];
    for (const action of actions) {
      this._held.delete(action);
    }
  }

  _emit(action) {
    const cbs = this._listeners.get(action);
    if (cbs?.size) [...cbs].forEach(cb => cb());
    const once = this._once.get(action);
    if (once?.size) {
      const pending = [...once];
      once.clear();
      pending.forEach(cb => cb());
    }
  }

  _onPadConnected(pad) {
    this._padConnected = true;
    const name = pad.id?.split('(')[0].trim() || 'Controller';
    this._scene.game.events.emit('toast', `${name} connected`);
  }

  _onPadDisconnected() {
    this._padConnected = false;
  }

  _onPadDown(pad, button) {
    this._inputMode = 'controller';
    const actions = GAMEPAD_BUTTON_BINDINGS[button.index] ?? [];
    for (const action of actions) {
      this.press(action);
    }
  }

  _onPadUp(pad, button) {
    const actions = GAMEPAD_BUTTON_BINDINGS[button.index] ?? [];
    for (const action of actions) {
      this.release(action);
    }
  }

  /**
   * Polls the left analog stick each frame and synthesises press/release
   * events when axes cross the dead-zone threshold.
   */
  _onSceneUpdate() {
    const gp = this._scene.input.gamepad?.getPad(0);
    if (!gp) return;

    const axisX = gp.axes[0]?.getValue() ?? 0;
    const axisY = gp.axes[1]?.getValue() ?? 0;

    this._pollAxis(axisX < -AXIS_THRESHOLD, Action.LEFT);
    this._pollAxis(axisX >  AXIS_THRESHOLD, Action.RIGHT);
    this._pollAxis(axisY < -AXIS_THRESHOLD, Action.UP);
    this._pollAxis(axisY >  AXIS_THRESHOLD, Action.DOWN);
  }

  _pollAxis(active, action) {
    const wasActive = this._axisActions.has(action);
    if (active && !wasActive) {
      this._inputMode = 'controller';
      this._axisActions.add(action);
      this.press(action);
    } else if (!active && wasActive) {
      this._axisActions.delete(action);
      this.release(action);
    }
  }
}

// ─── Keybind labels ────────────────────────────────────────────────────────

/** Human-readable label for each event.code value. */
const CODE_LABELS = {
  ArrowUp:   '↑',
  ArrowDown:  '↓',
  ArrowLeft:  '←',
  ArrowRight: '→',
  Enter:      'Enter',
  Escape:     'Esc',
  Backspace:  'Bksp',
  Space:      'Space',
};

/** Build a reverse map: action → primary key label (first binding found). */
function buildActionLabels(bindings) {
  const map = {};
  for (const [code, actions] of Object.entries(bindings)) {
    for (const action of actions) {
      if (!(action in map)) {
        const label = CODE_LABELS[code]
          ?? (code.startsWith('Key')   ? code.slice(3)   : null)
          ?? (code.startsWith('Digit') ? code.slice(5)   : null)
          ?? code;
        map[action] = label;
      }
    }
  }
  return map;
}

const _defaultActionLabels = buildActionLabels(DEFAULT_BINDINGS);

/** Action → controller button label (standard Xbox/PS layout). */
const GAMEPAD_ACTION_LABELS = {
  [Action.CONFIRM]:  'A',
  [Action.CANCEL]:   'B',
  [Action.RUN]:      'B',
  [Action.MENU]:     'Start',
  [Action.UP]:       '↑',
  [Action.DOWN]:     '↓',
  [Action.LEFT]:     '←',
  [Action.RIGHT]:    '→',
};

/**
 * Returns the label for an action based on the current input device.
 * Shows controller button names when a pad is connected, keyboard keys otherwise.
 * @param {string} action - One of the Action constants.
 * @returns {string}
 */
export function getKeybindLabel(action) {
  if (_instance?._inputMode === 'controller') {
    return GAMEPAD_ACTION_LABELS[action] ?? _defaultActionLabels[action] ?? action;
  }
  return _defaultActionLabels[action] ?? action;
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Create (or replace) the singleton InputManager for this session.
 * Call once in the owning scene's create() — currently OverworldUI.
 * @param {Phaser.Scene} scene
 * @param {Object} [bindings]
 * @returns {InputManager}
 */
export function createInputManager(scene, bindings) {
  _instance?.destroy();
  _instance = new InputManager(scene, bindings);
  return _instance;
}

/**
 * Retrieve the active InputManager instance.
 * Returns null before createInputManager() has been called.
 * @returns {InputManager|null}
 */
export function getInputManager() {
  return _instance;
}

export default InputManager;
