import { gameState } from '@Data/gameState.js';
import { SX, SY, SW, SH, TEXT_STYLE_HINT } from './layout.js';
import { drawMonDetail, getMonDetailTabs } from './MonDetail.js';

const HINT = '◄►  tab  ·  ▲▼  switch  ·  X  back';

export default class TeamDetail {
  constructor(menu) {
    this.menu        = menu;
    this.currentSlot = 0;
    this.currentTab  = 0;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  nav(dir) {
    const party    = gameState.party;
    const occupied = party.map((m, i) => m ? i : null).filter(i => i !== null);
    if (occupied.length <= 1) return;
    const pos        = occupied.indexOf(this.currentSlot);
    this.currentSlot = occupied[(pos + dir + occupied.length) % occupied.length];
    this.currentTab  = 0;
    this._rebuild();
  }

  tabNav(dir) {
    const mon  = gameState.party[this.currentSlot];
    const tabs = getMonDetailTabs(mon);
    this.currentTab = (this.currentTab + dir + tabs.length) % tabs.length;
    this._rebuild();
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  build(slot) {
    this.currentSlot = slot;
    this.currentTab  = 0;
    this._rebuild();
  }

  _rebuild() {
    this.menu._clearSubTexts();
    drawMonDetail(this.menu, {
      mon: gameState.party[this.currentSlot],
      x: SX, y: SY, w: SW, h: SH,
      tab: this.currentTab,
    });
    this._hint();
  }

  _hint() {
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, HINT, TEXT_STYLE_HINT));
  }
}
