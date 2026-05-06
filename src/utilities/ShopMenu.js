import { getInputManager, Action } from './InputManager.js';
import { ITEM_REGISTRY } from '../data/itemRegistry.js';
import QuantityPrompt from './QuantityPrompt.js';
import ChoicePrompt from './ChoicePrompt.js';
import store from '../store/index.js';

const DEPTH       = Number.MAX_SAFE_INTEGER - 8;
const LIST_W      = 260;
const LIST_PAD    = 10;
const ROW_H       = 22;
const MAX_VISIBLE = 7;
const MONEY_W     = 140;
const MONEY_H     = 36;
const FONT        = { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' };
const FONT_BOLD   = { fontFamily: 'Gen3', fontSize: '13px', color: '#181818', fontStyle: 'bold' };
const FONT_PRICE  = { fontFamily: 'Gen3', fontSize: '13px', color: '#484848' };

export default class ShopMenu {
  constructor(scene, { items, onClose }) {
    this._scene   = scene;
    this._items   = items;
    this._onClose = onClose;
    this._cursor  = 0;
    this._scroll  = 0;
    this._phase   = 'browse';
    this._objects = [];

    const sw = scene.scale.width;
    this._listX = sw - LIST_W - 16;
    this._listY = 16;
    this._listH = LIST_PAD * 2 + (Math.min(MAX_VISIBLE, items.length + 1)) * ROW_H;

    this._moneyX = 16;
    this._moneyY = 16;

    this._render();
    this._showDescription();

    this._upCb    = () => this._handleUp();
    this._downCb  = () => this._handleDown();
    this._okCb    = () => this._handleConfirm();
    this._noCb    = () => this._handleCancel();

    const im = getInputManager();
    im?.on(Action.UP,      this._upCb);
    im?.on(Action.DOWN,    this._downCb);
    im?.on(Action.CONFIRM, this._okCb);
    im?.on(Action.CANCEL,  this._noCb);
  }

  // ─── Input Handlers ─────────────────────────────────────────────────────────

  _handleUp() {
    if (this._phase !== 'browse') return;
    const total = this._items.length + 1; // +1 for CANCEL row
    this._cursor = (this._cursor - 1 + total) % total;
    this._adjustScroll();
    this._rebuild();
    this._showDescription();
  }

  _handleDown() {
    if (this._phase !== 'browse') return;
    const total = this._items.length + 1;
    this._cursor = (this._cursor + 1) % total;
    this._adjustScroll();
    this._rebuild();
    this._showDescription();
  }

  _handleConfirm() {
    if (this._phase !== 'browse') return;
    if (this._cursor >= this._items.length) {
      this._close();
      return;
    }
    const itemName = this._items[this._cursor];
    const info = ITEM_REGISTRY[itemName];
    if (!info) { this._close(); return; }

    const money = store.state.game.money;
    if (money < info.price) {
      this._scene.game.events.emit('textbox-changedata', "You don't have enough money.");
      this._scene.game.events.once('textbox-ready', () => {
        this._scene.game.events.emit('textbox-intercept');
      });
      return;
    }

    this._phase = 'quantity';
    const maxQty = Math.min(99, Math.floor(money / info.price));
    const qx = this._listX - 140;
    const qy = this._listY + LIST_PAD + (this._cursor - this._scroll) * ROW_H;

    this._quantityPrompt = new QuantityPrompt(this._scene, {
      unitPrice: info.price,
      maxQty,
      x: qx,
      y: qy,
      onConfirm: (qty) => {
        this._quantityPrompt = null;
        this._confirmPurchase(itemName, qty, qty * info.price);
      },
      onCancel: () => {
        this._quantityPrompt = null;
        this._phase = 'browse';
        this._showDescription();
      },
    });
  }

  _handleCancel() {
    if (this._phase !== 'browse') return;
    this._close();
  }

  // ─── Purchase Flow ──────────────────────────────────────────────────────────

  _confirmPurchase(itemName, qty, totalCost) {
    this._phase = 'confirm';
    const text = `That will be ¥${totalCost.toLocaleString()}. OK?`;
    this._scene.game.events.emit('textbox-changedata', text);
    this._scene.game.events.once('textbox-ready', () => {
      this._scene.game.events.emit('textbox-intercept');
      this._choicePrompt = new ChoicePrompt(this._scene, ['YES', 'NO'], (idx) => {
        this._choicePrompt = null;
        if (idx === 0) {
          this._executePurchase(itemName, qty, totalCost);
        } else {
          this._phase = 'browse';
          this._showDescription();
        }
      });
    });
  }

  _executePurchase(itemName, qty, totalCost) {
    store.commit('game/ADD_MONEY', -totalCost);
    store.commit('bag/PICKUP', { name: itemName, qty });
    this._phase = 'browse';
    this._rebuild();

    this._scene.game.events.emit('textbox-changedata', `Here you are!\nThank you!`);
    this._scene.game.events.once('textbox-ready', () => {
      this._scene.game.events.emit('textbox-intercept');
      const im = getInputManager();
      const resume = () => {
        im?.off(Action.CONFIRM, resume);
        im?.off(Action.CANCEL, resume);
        this._showDescription();
      };
      im?.on(Action.CONFIRM, resume);
      im?.on(Action.CANCEL, resume);
    });
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    this._drawMoney();
    this._drawList();
  }

  _rebuild() {
    this._clearObjects();
    this._render();
  }

  _drawMoney() {
    const g = this._scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    g.fillStyle(0xf8f8f8, 1);
    g.fillRoundedRect(this._moneyX, this._moneyY, MONEY_W, MONEY_H, 8);
    g.lineStyle(2, 0x181818, 1);
    g.strokeRoundedRect(this._moneyX, this._moneyY, MONEY_W, MONEY_H, 8);
    this._objects.push(g);

    const money = store.state.game.money;
    const txt = this._scene.add.text(
      this._moneyX + MONEY_W - LIST_PAD, this._moneyY + 10,
      `¥${money.toLocaleString()}`,
      FONT_BOLD
    ).setScrollFactor(0).setDepth(DEPTH + 1).setOrigin(1, 0);
    this._objects.push(txt);
  }

  _drawList() {
    const g = this._scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    g.fillStyle(0xf8f8f8, 1);
    g.fillRoundedRect(this._listX, this._listY, LIST_W, this._listH, 8);
    g.lineStyle(2, 0x181818, 1);
    g.strokeRoundedRect(this._listX, this._listY, LIST_W, this._listH, 8);
    this._objects.push(g);

    const total = this._items.length + 1;
    const visibleCount = Math.min(MAX_VISIBLE, total);
    for (let i = 0; i < visibleCount; i++) {
      const idx = this._scroll + i;
      if (idx >= total) break;

      const rowY = this._listY + LIST_PAD + i * ROW_H;
      const isCursor = idx === this._cursor;

      if (idx >= this._items.length) {
        // CANCEL row
        const label = `${isCursor ? '▶ ' : '  '}CANCEL`;
        const t = this._scene.add.text(this._listX + LIST_PAD, rowY, label, FONT)
          .setScrollFactor(0).setDepth(DEPTH + 1);
        this._objects.push(t);
      } else {
        const itemName = this._items[idx];
        const info = ITEM_REGISTRY[itemName] ?? {};
        const owned = this._getOwnedQty(itemName);
        const prefix = isCursor ? '▶ ' : '  ';

        const nameText = this._scene.add.text(
          this._listX + LIST_PAD, rowY,
          `${prefix}${itemName}`, FONT
        ).setScrollFactor(0).setDepth(DEPTH + 1);
        this._objects.push(nameText);

        const priceText = this._scene.add.text(
          this._listX + LIST_W - LIST_PAD - 50, rowY,
          `¥${(info.price ?? 0).toLocaleString()}`, FONT_PRICE
        ).setScrollFactor(0).setDepth(DEPTH + 1).setOrigin(1, 0);
        this._objects.push(priceText);

        const qtyText = this._scene.add.text(
          this._listX + LIST_W - LIST_PAD, rowY,
          `×${owned}`, FONT_PRICE
        ).setScrollFactor(0).setDepth(DEPTH + 1).setOrigin(1, 0);
        this._objects.push(qtyText);
      }
    }

    // Scroll indicators
    if (this._scroll > 0) {
      const t = this._scene.add.text(this._listX + LIST_W - 20, this._listY + 2, '▲', FONT)
        .setScrollFactor(0).setDepth(DEPTH + 1);
      this._objects.push(t);
    }
    if (this._scroll + MAX_VISIBLE < total) {
      const t = this._scene.add.text(
        this._listX + LIST_W - 20, this._listY + this._listH - 16, '▼', FONT
      ).setScrollFactor(0).setDepth(DEPTH + 1);
      this._objects.push(t);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _showDescription() {
    if (this._cursor >= this._items.length) {
      this._scene.game.events.emit('textbox-changedata', 'Quit shopping.');
      this._scene.game.events.once('textbox-ready', () => {
        this._scene.game.events.emit('textbox-intercept');
      });
      return;
    }
    const itemName = this._items[this._cursor];
    const info = ITEM_REGISTRY[itemName];
    const desc = info?.description ?? '';
    this._scene.game.events.emit('textbox-changedata', desc);
    this._scene.game.events.once('textbox-ready', () => {
      this._scene.game.events.emit('textbox-intercept');
    });
  }

  _getOwnedQty(name) {
    const bag = store.state.bag;
    const entry = bag.items.find(e => e.name === name)
      || bag.pokeballs.find(e => e.name === name)
      || bag.tms.find(e => e.name === name);
    return entry?.quantity ?? 0;
  }

  _adjustScroll() {
    if (this._cursor < this._scroll) {
      this._scroll = this._cursor;
    } else if (this._cursor >= this._scroll + MAX_VISIBLE) {
      this._scroll = this._cursor - MAX_VISIBLE + 1;
    }
  }

  _clearObjects() {
    for (const obj of this._objects) obj.destroy();
    this._objects = [];
  }

  _close() {
    this._detachInput();
    this._clearObjects();
    this._onClose();
  }

  _detachInput() {
    const im = getInputManager();
    im?.off(Action.UP,      this._upCb);
    im?.off(Action.DOWN,    this._downCb);
    im?.off(Action.CONFIRM, this._okCb);
    im?.off(Action.CANCEL,  this._noCb);
  }
}
