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

/** Default keyboard → action mapping. One key may trigger multiple actions. */
const DEFAULT_BINDINGS = {
  ArrowUp:   [Action.UP],
  ArrowDown:  [Action.DOWN],
  ArrowLeft:  [Action.LEFT],
  ArrowRight: [Action.RIGHT],
  KeyZ:       [Action.CONFIRM],
  Enter:      [Action.CONFIRM, Action.MENU],
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

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    scene.input.keyboard.on('keydown', this._onKeyDown);
    scene.input.keyboard.on('keyup',   this._onKeyUp);
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
    this._listeners.clear();
    this._once.clear();
    this._held.clear();
    this._pressedAt.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _onKeyDown(event) {
    if (event.repeat) return;
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
    this._listeners.get(action)?.forEach(cb => cb());
    const once = this._once.get(action);
    if (once?.size) {
      const pending = [...once];
      once.clear();
      pending.forEach(cb => cb());
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
        // Convert e.g. "KeyZ" → "Z", "Digit1" → "1", else use CODE_LABELS or raw code
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

/**
 * Returns the primary keyboard label for an action (e.g. 'confirm' → 'Z').
 * Falls back to the action name if no binding exists.
 * @param {string} action - One of the Action constants.
 * @returns {string}
 */
export function getKeybindLabel(action) {
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
