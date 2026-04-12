import { getInputManager, Action } from './InputManager.js';

const DEPTH   = Number.MAX_SAFE_INTEGER - 9;   // above textbox (MAX - 10)
const BOX_W   = 96;
const BOX_PAD = 10;
const ROW_H   = 20;

/**
 * Renders a small choice menu (YES/NO or arbitrary options) in the given scene.
 * Positioned bottom-right, just above the standard textbox area.
 *
 * Navigation:
 *   ▲/▼    move cursor
 *   Z      confirm selection
 *   X      cancel (selects last option — treated as "no")
 *
 * @param {Phaser.Scene} scene    - The scene to render in (typically OverworldUI).
 * @param {string[]}     choices  - Choice labels, e.g. ['YES', 'NO'].
 * @param {Function}     onChoice - Called with the selected index after selection.
 */
export default class ChoicePrompt {
  constructor(scene, choices, onChoice) {
    this._scene    = scene;
    this._choices  = choices;
    this._cursor   = 0;
    this._onChoice = onChoice;

    const boxH = BOX_PAD * 2 + choices.length * ROW_H;

    // Sit just above the textbox: textbox top ≈ height - (65+28) - 20 = height - 113
    const bx = scene.scale.width  - BOX_W  - 20;
    const by = scene.scale.height - boxH   - 113 - 6;

    this._bx  = bx;
    this._by  = by;
    this._boxH = boxH;

    // Background
    this._bg = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    this._drawBg();

    // Choice labels
    this._labels = choices.map((label, i) => {
      return scene.add.text(
        bx + BOX_PAD + 16,
        by + BOX_PAD + i * ROW_H,
        label,
        { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' }
      ).setScrollFactor(0).setDepth(DEPTH + 1);
    });

    // Cursor arrow
    this._arrow = scene.add.text(
      bx + BOX_PAD,
      by + BOX_PAD,
      '►',
      { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' }
    ).setScrollFactor(0).setDepth(DEPTH + 1);

    // Input handlers
    this._upCb   = () => this._move(-1);
    this._downCb = () => this._move(1);
    this._okCb   = () => this._confirm();
    this._noCb   = () => this._cancel();

    const im = getInputManager();
    im?.on(Action.UP,      this._upCb);
    im?.on(Action.DOWN,    this._downCb);
    im?.on(Action.CONFIRM, this._okCb);
    im?.on(Action.CANCEL,  this._noCb);

    this._render();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _drawBg() {
    this._bg.clear();
    this._bg.fillStyle(0xf8f8f8, 1);
    this._bg.fillRoundedRect(this._bx, this._by, BOX_W, this._boxH, 8);
    this._bg.lineStyle(2, 0x181818, 1);
    this._bg.strokeRoundedRect(this._bx, this._by, BOX_W, this._boxH, 8);
  }

  _render() {
    this._labels.forEach((obj, i) => {
      obj.setColor(i === this._cursor ? '#f8e030' : '#181818');
    });
    this._arrow.setY(this._by + BOX_PAD + this._cursor * ROW_H);
  }

  _move(dir) {
    this._cursor = (this._cursor + dir + this._choices.length) % this._choices.length;
    this._render();
  }

  _confirm() {
    const idx = this._cursor;
    this._destroy();
    this._onChoice(idx);
  }

  _cancel() {
    // Cancel (X) always selects the last option — treat as "no".
    const idx = this._choices.length - 1;
    this._destroy();
    this._onChoice(idx);
  }

  _destroy() {
    const im = getInputManager();
    im?.off(Action.UP,      this._upCb);
    im?.off(Action.DOWN,    this._downCb);
    im?.off(Action.CONFIRM, this._okCb);
    im?.off(Action.CANCEL,  this._noCb);
    this._bg.destroy();
    this._labels.forEach(obj => obj.destroy());
    this._arrow.destroy();
  }
}
