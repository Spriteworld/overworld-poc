import { gameState } from '@Data/gameState.js';
import { Pokedex } from '@spriteworld/pokemon-data';
import PokemonSprite from '../PokemonSprite.js';
import {
  SX, SY, SW, SH,
  DEX_LIST_W, DEX_ITEM_H, DEX_VISIBLE, DEX_DETAIL_X, DEX_DETAIL_W,
  TEXT_STYLE_BOLD, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { drawTypeBadges, drawMiniBall } from './helpers.js';
import { drawMonDetail, getMonDetailTabs } from './MonDetail.js';

export default class PokedexScreen {
  constructor(menu) {
    this.menu    = menu;
    this.cursor  = 1;   // nat_dex_id (1-based)
    this.scroll  = 0;   // index of first visible row
    this.entries = null; // sorted array, built once
    this.dexTab  = 0;
  }

  reset() {
    this.cursor = 1;
    this.scroll = 0;
    this.dexTab = 0;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  nav(dir) {
    if (!this.entries) return;
    this.cursor = Math.max(1, Math.min(this.entries.length, this.cursor + dir));
    const idx   = this.cursor - 1;
    if (idx < this.scroll) this.scroll = idx;
    if (idx >= this.scroll + DEX_VISIBLE) this.scroll = idx - DEX_VISIBLE + 1;
    this.rebuild();
  }

  tabNav(dir) {
    const entry  = this.entries?.[this.cursor - 1];
    if (!entry) return;
    const record = gameState.pokedex[entry.nat_dex_id];
    if (!record?.seen) return;
    const tabs = getMonDetailTabs(null); // dex mode = null mon
    this.dexTab = (this.dexTab + dir + tabs.length) % tabs.length;
    this.rebuild();
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  rebuild() {
    this.menu._clearSubTexts();
    this.build();
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }

  build() {
    if (!this.entries) {
      this.entries = new Pokedex(null).getNationalDex(3);
    }

    const { scene, reg } = this.menu;

    reg(scene.add.text(SX + 16, SY + 14, 'POKÉDEX', TEXT_STYLE_BOLD));

    // ── Divider ────────────────────────────────────────────────────────
    const div = scene.add.graphics();
    div.lineStyle(1, 0xcccccc, 1);
    div.lineBetween(SX + DEX_LIST_W + 16, SY + 36, SX + DEX_LIST_W + 16, SY + SH - 30);
    reg(div);

    // ── List ───────────────────────────────────────────────────────────
    const listX = SX + 16;
    const listY = SY + 40;

    const visible = this.entries.slice(this.scroll, this.scroll + DEX_VISIBLE);
    visible.forEach((entry, i) => {
      const rowY       = listY + i * DEX_ITEM_H;
      const dexId      = entry.nat_dex_id;
      const isSelected = dexId === this.cursor;
      const record     = gameState.pokedex[dexId];
      const caught     = record?.caught;

      if (isSelected) {
        const sel = scene.add.graphics();
        sel.fillStyle(0x3399ff, 1);
        sel.fillRect(listX - 4, rowY - 1, DEX_LIST_W - 4, DEX_ITEM_H);
        reg(sel);
      }

      const numStr  = `#${String(dexId).padStart(3, '0')}`;
      const nameStr = record ? entry.species.toUpperCase() : '???';
      const color   = isSelected ? '#ffffff' : record ? '#181818' : '#888888';
      const style   = { fontFamily: 'monospace', fontSize: '12px', color };

      const numT  = scene.add.text(listX,      rowY + 2, numStr,  style);
      const nameT = scene.add.text(listX + 38, rowY + 2, nameStr, style);
      reg(numT);
      reg(nameT);

      if (caught) {
        reg(drawMiniBall(scene, listX + 38 + nameT.width + 8, rowY + DEX_ITEM_H / 2, 5));
      }
    });

    // Scroll indicators
    if (this.scroll > 0) {
      const up = scene.add.text(listX + DEX_LIST_W / 2, listY - 14, '▲', TEXT_STYLE_HINT);
      up.setOrigin(0.5, 0);
      reg(up);
    }
    if (this.scroll + DEX_VISIBLE < this.entries.length) {
      const dn = scene.add.text(listX + DEX_LIST_W / 2, listY + DEX_VISIBLE * DEX_ITEM_H + 2, '▼', TEXT_STYLE_HINT);
      dn.setOrigin(0.5, 0);
      reg(dn);
    }

    // ── Detail pane ────────────────────────────────────────────────────
    const entry = this.entries[this.cursor - 1];
    if (entry) this._buildDetail(entry);
  }

  _buildDetail(entry) {
    const record = gameState.pokedex[entry.nat_dex_id];
    const seen   = !!record?.seen;

    if (seen) {
      drawMonDetail(this.menu, {
        entry,
        x:   DEX_DETAIL_X,
        y:   SY + 36,
        w:   DEX_DETAIL_W,
        h:   SH - 66,
        tab: this.dexTab,
      });
      return;
    }

    // ── Unseen fallback ────────────────────────────────────────────────
    const { scene, reg } = this.menu;
    const dx  = DEX_DETAIL_X;
    const dy  = SY + 36;

    const numStr = `#${String(entry.nat_dex_id).padStart(3, '0')}`;
    reg(scene.add.text(dx, dy, numStr, TEXT_STYLE_HINT));
    reg(scene.add.text(dx + 44, dy, '???', TEXT_STYLE_BOLD));
    reg(new PokemonSprite(scene, dx, dy + 22, { species: 0, size: 80 }));
  }
}
