import { getInputManager, Action } from './InputManager.js';

const DEPTH   = Number.MAX_SAFE_INTEGER - 7;
const BOX_W   = 128;
const BOX_H   = 52;
const BOX_PAD = 10;

export default class QuantityPrompt {
  constructor(scene, { unitPrice, maxQty, x, y, onConfirm, onCancel }) {
    this._scene     = scene;
    this._unitPrice = unitPrice;
    this._maxQty    = Math.max(1, maxQty);
    this._qty       = 1;
    this._onConfirm = onConfirm;
    this._onCancel  = onCancel;

    this._bx = x;
    this._by = y;

    this._bg = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    this._drawBg();

    this._qtyText = scene.add.text(
      x + BOX_PAD + 16, y + BOX_PAD,
      '', { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' }
    ).setScrollFactor(0).setDepth(DEPTH + 1);

    this._totalText = scene.add.text(
      x + BOX_PAD + 16, y + BOX_PAD + 20,
      '', { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' }
    ).setScrollFactor(0).setDepth(DEPTH + 1);

    this._arrow = scene.add.text(
      x + BOX_PAD, y + BOX_PAD,
      '×', { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' }
    ).setScrollFactor(0).setDepth(DEPTH + 1);

    this._upCb    = () => this._adjust(1);
    this._downCb  = () => this._adjust(-1);
    this._rightCb = () => this._adjust(10);
    this._leftCb  = () => this._adjust(-10);
    this._okCb    = () => this._confirm();
    this._noCb    = () => this._cancel();

    const im = getInputManager();
    im?.on(Action.UP,      this._upCb);
    im?.on(Action.DOWN,    this._downCb);
    im?.on(Action.RIGHT,   this._rightCb);
    im?.on(Action.LEFT,    this._leftCb);
    im?.on(Action.CONFIRM, this._okCb);
    im?.on(Action.CANCEL,  this._noCb);

    this._render();
  }

  _drawBg() {
    this._bg.clear();
    this._bg.fillStyle(0xf8f8f8, 1);
    this._bg.fillRoundedRect(this._bx, this._by, BOX_W, BOX_H, 8);
    this._bg.lineStyle(2, 0x181818, 1);
    this._bg.strokeRoundedRect(this._bx, this._by, BOX_W, BOX_H, 8);
  }

  _adjust(delta) {
    const prev = this._qty;
    this._qty = Math.max(1, Math.min(this._maxQty, this._qty + delta));
    if (this._qty !== prev) this._render();
  }

  _render() {
    const padded = String(this._qty).padStart(2, '0');
    this._qtyText.setText(`  ${padded}`);
    const total = this._qty * this._unitPrice;
    this._totalText.setText(`= ¥${total.toLocaleString()}`);
  }

  _confirm() {
    const qty = this._qty;
    this._destroy();
    this._onConfirm(qty);
  }

  _cancel() {
    this._destroy();
    this._onCancel();
  }

  _destroy() {
    const im = getInputManager();
    im?.off(Action.UP,      this._upCb);
    im?.off(Action.DOWN,    this._downCb);
    im?.off(Action.RIGHT,   this._rightCb);
    im?.off(Action.LEFT,    this._leftCb);
    im?.off(Action.CONFIRM, this._okCb);
    im?.off(Action.CANCEL,  this._noCb);
    this._bg.destroy();
    this._qtyText.destroy();
    this._totalText.destroy();
    this._arrow.destroy();
  }
}
