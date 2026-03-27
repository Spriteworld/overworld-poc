import { gameState } from '@Data/gameState.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const TABS = [
  { label: 'Items', key: 'items'     },
  { label: 'Balls', key: 'pokeballs' },
  { label: 'TMs',   key: 'tms'       },
];

const TAB_W    = Math.floor(SW / TABS.length);
const TAB_Y    = SY + 16;
const LIST_Y   = SY + 54;
const ROW_H    = 22;
const MAX_ROWS = Math.floor((SH - LIST_Y - 28) / ROW_H);

export default class BagScreen {
  constructor(menu) {
    this.menu       = menu;
    this._tabIndex  = 0;
    this._scrollTop = 0;
  }

  /** Called by PauseMenu._transitionTo — resets state on fresh open. */
  show() {
    this._tabIndex  = 0;
    this._scrollTop = 0;
    this.build();
  }

  build() {
    const { scene, reg } = this.menu;
    const { key } = TABS[this._tabIndex];
    const entries = gameState.bag[key] ?? [];

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
        const line = `${(entry.name ?? 'Item').padEnd(18)}  x${entry.quantity ?? 1}`;
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

    reg(scene.add.text(SX + 16, SY + SH - 22, '◀▶ switch tab   ▲▼ scroll   X  back', TEXT_STYLE_HINT));
  }

  /** Switch to an adjacent tab (delta = ±1). */
  tabNav(delta) {
    this._tabIndex  = Math.max(0, Math.min(TABS.length - 1, this._tabIndex + delta));
    this._scrollTop = 0;
    this.menu._clearSubTexts();
    this.build();
  }

  /** Scroll the item list up/down (delta = ±1). */
  nav(delta) {
    const { key } = TABS[this._tabIndex];
    const entries  = gameState.bag[key] ?? [];
    const maxScroll = Math.max(0, entries.length - MAX_ROWS);
    this._scrollTop = Math.max(0, Math.min(maxScroll, this._scrollTop + delta));
    this.menu._clearSubTexts();
    this.build();
  }
}
