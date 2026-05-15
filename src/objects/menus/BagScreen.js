import store from '../../store/index.js';
import { gameState } from '@Data/gameState.js';
import { getGameDef } from '@Data/gameDef.js';
import { resolveItemId } from '@Data/itemDefs.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const TABS = [
  { label: 'Items',  key: 'items'     },
  { label: 'Balls',  key: 'pokeballs' },
  { label: 'TMs',    key: 'tms'       },
  { label: 'Key',    key: 'keyItems'  },
];

let _overworldUsable;
function isOverworldUsable(id) {
  if (!_overworldUsable) _overworldUsable = new Set([resolveItemId('Rare Candy')]);
  return _overworldUsable.has(id);
}

/** Submenu options shown when selecting a key item. */
const KEY_ITEM_OPTIONS = ['Use', 'Register', 'Cancel'];

const TAB_W    = Math.floor(SW / TABS.length);
const TAB_Y    = SY + 16;
const LIST_Y   = SY + 54;
const ROW_H    = 22;
const MAX_ROWS = Math.floor((SH - LIST_Y - 28) / ROW_H);

export default class BagScreen {
  constructor(menu) {
    this.menu          = menu;
    this._tabIndex     = 0;
    this._scrollTop    = 0;
    this._cursor       = 0;
    this._subMenu      = false; // submenu open for key item
    this._subCursor    = 0;
    this._subItem      = null;
  }

  /** Called by PauseMenu._transitionTo — resets state on fresh open. */
  show() {
    this._tabIndex  = 0;
    this._scrollTop = 0;
    this._cursor    = 0;
    this._subMenu   = false;
    this.build();
  }

  build() {
    const { scene, reg } = this.menu;
    const { key } = TABS[this._tabIndex];
    const isKeyTab = key === 'keyItems';
    const entries  = gameState.bag[key] ?? [];
    const registered = gameState.bag.registeredItem;

    // Title
    reg(scene.add.text(SX + 16, SY + 4, 'BAG', TEXT_STYLE_BOLD));

    // Tab bar
    TABS.forEach(({ label }, i) => {
      const cx     = SX + i * TAB_W + TAB_W / 2;
      const active = i === this._tabIndex;
      const style  = active ? TEXT_STYLE_BOLD : { ...TEXT_STYLE_BODY, color: '#888888' };
      reg(scene.add.text(cx, TAB_Y, label, style)).setOrigin(0.5, 0);
      if (active) {
        const ul = scene.add.graphics();
        ul.lineStyle(2, 0x181818);
        ul.lineBetween(cx - 28, TAB_Y + 18, cx + 28, TAB_Y + 18);
        reg(ul);
      }
    });

    // Separator
    const sep = scene.add.graphics();
    sep.lineStyle(1, 0xaaaaaa);
    sep.lineBetween(SX + 8, LIST_Y - 6, SX + SW - 8, LIST_Y - 6);
    reg(sep);

    // Item rows
    const visible = entries.slice(this._scrollTop, this._scrollTop + MAX_ROWS);
    if (visible.length === 0) {
      reg(scene.add.text(SX + 16, LIST_Y, 'Nothing here.', TEXT_STYLE_BODY));
    } else {
      visible.forEach((entry, i) => {
        const absIdx   = this._scrollTop + i;
        const isCursor = absIdx === this._cursor;
        const prefix   = isCursor ? '▶ ' : '  ';
        const isReg    = isKeyTab && entry.id === registered;
        const suffix   = isReg ? ' ★' : '';

        let line;
        if (isKeyTab) {
          line = `${prefix}${(entry.label ?? 'Item') + suffix}`;
        } else {
          const usable   = isOverworldUsable(entry.id);
          const color    = usable ? '#181818' : '#666666';
          const style    = { ...TEXT_STYLE_BODY, color };
          const hideQty  = key === 'tms' && getGameDef().infiniteTMs;
          const qtySuffix = hideQty ? '' : `  x${entry.quantity ?? 1}`;
          line = `${prefix}${String(entry.label ?? 'Item').padEnd(16)}${qtySuffix}`;
          reg(scene.add.text(SX + 16, LIST_Y + i * ROW_H, line, style));
          return;
        }
        reg(scene.add.text(SX + 16, LIST_Y + i * ROW_H, line, TEXT_STYLE_BODY));
      });
    }

    // Scroll arrows
    if (this._scrollTop > 0) {
      reg(scene.add.text(SX + SW - 24, LIST_Y, '▲', TEXT_STYLE_HINT));
    }
    if (this._scrollTop + MAX_ROWS < entries.length) {
      reg(scene.add.text(SX + SW - 24, SY + SH - 44, '▼', TEXT_STYLE_HINT));
    }

    // Hint bar
    const hint = isKeyTab
      ? '◀▶ switch tab   ▲▼ select   Z  options   X  back'
      : (key === 'items' && entries.some(e => isOverworldUsable(e.id)))
        ? '◀▶ switch tab   ▲▼ select   Z  use   X  back'
        : '◀▶ switch tab   ▲▼ scroll   X  back';
    reg(scene.add.text(SX + SW - 16, SY + SH - 32, hint, TEXT_STYLE_HINT)).setOrigin(1, 0);

    // Submenu overlay
    if (this._subMenu) {
      this._buildSubMenu(reg, scene);
    }
  }

  _buildSubMenu(reg, scene) {
    const MX = SX + SW - 110;
    const MY = LIST_Y + this._cursor * ROW_H - this._scrollTop * ROW_H;
    const MW = 100;
    const MH = KEY_ITEM_OPTIONS.length * ROW_H + 12;

    const bg = scene.add.graphics();
    bg.fillStyle(0xf8f8e8, 1);
    bg.lineStyle(2, 0x181818);
    bg.fillRect(MX, MY, MW, MH);
    bg.strokeRect(MX, MY, MW, MH);
    reg(bg);

    KEY_ITEM_OPTIONS.forEach((label, i) => {
      const isCursor = i === this._subCursor;
      const text = `${isCursor ? '▶ ' : '  '}${label}`;
      reg(scene.add.text(MX + 8, MY + 6 + i * ROW_H, text, TEXT_STYLE_BODY));
    });
  }

  /** Switch to an adjacent tab (delta = ±1). */
  tabNav(delta) {
    if (this._subMenu) return;
    this._tabIndex  = (this._tabIndex + delta + TABS.length) % TABS.length;
    this._scrollTop = 0;
    this._cursor    = 0;
    this.menu._clearSubTexts();
    this.build();
  }

  /** Move cursor up/down (delta = ±1). Routes to submenu when open. */
  nav(delta) {
    if (this._subMenu) {
      this._subCursor = (this._subCursor + delta + KEY_ITEM_OPTIONS.length) % KEY_ITEM_OPTIONS.length;
      this.menu._clearSubTexts();
      this.build();
      return;
    }

    const { key } = TABS[this._tabIndex];
    const entries  = gameState.bag[key] ?? [];
    if (entries.length === 0) return;

    this._cursor = Math.max(0, Math.min(entries.length - 1, this._cursor + delta));

    if (this._cursor < this._scrollTop) {
      this._scrollTop = this._cursor;
    } else if (this._cursor >= this._scrollTop + MAX_ROWS) {
      this._scrollTop = this._cursor - MAX_ROWS + 1;
    }

    this.menu._clearSubTexts();
    this.build();
  }

  /** Confirm selection — opens submenu for key items or uses regular items. */
  confirm() {
    const { key } = TABS[this._tabIndex];

    // ── Submenu active: execute the selected option ──
    if (this._subMenu) {
      const option = KEY_ITEM_OPTIONS[this._subCursor];
      if (option === 'Use') {
        this._subMenu = false;
        this.menu.scene.game.events.emit('use-key-item', this._subItemId);
        this.menu.close();
      } else if (option === 'Register') {
        store.commit('bag/REGISTER_ITEM', this._subItemId);
        const registered = gameState.bag.registeredItem;
        const msg = registered
          ? `${this._subItem} registered to Backspace!`
          : `${this._subItem} unregistered.`;
        this.menu.scene.game.events.emit('toast', msg);
        this._subMenu = false;
        this.menu._clearSubTexts();
        this.build();
      } else {
        // Cancel
        this._subMenu = false;
        this.menu._clearSubTexts();
        this.build();
      }
      return;
    }

    // ── Key Items tab: open submenu ──
    if (key === 'keyItems') {
      const entries = gameState.bag[key] ?? [];
      const entry   = entries[this._cursor];
      if (!entry) return;
      this._subMenu   = true;
      this._subCursor = 0;
      this._subItem   = entry.label;
      this._subItemId = entry.id;
      this.menu._clearSubTexts();
      this.build();
      return;
    }

    // ── Regular items ──
    if (key !== 'items') return;
    const entries = gameState.bag[key] ?? [];
    const entry   = entries[this._cursor];
    if (!entry) return;

    if (!isOverworldUsable(entry.id)) {
      this.menu.scene.game.events.emit('toast', `Can't use ${entry.label} here.`);
      return;
    }

    this.menu.pendingUseItem = { id: entry.id, label: entry.label };
    this.menu._transitionTo('bag-team-pick');
  }

  /** Close submenu on back; otherwise propagate to parent. Returns true if consumed. */
  back() {
    if (this._subMenu) {
      this._subMenu = false;
      this.menu._clearSubTexts();
      this.build();
      return true;
    }
    return false;
  }
}
