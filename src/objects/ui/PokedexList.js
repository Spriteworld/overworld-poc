import { Pokedex } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { drawMiniBall } from '@Objects/menus/helpers.js';
import { DEX_LIST_W, DEX_ITEM_H, DEX_VISIBLE, TEXT_STYLE_HINT } from '@Objects/common/constants.js';

export default class PokedexList {
  constructor({ width = DEX_LIST_W, itemH = DEX_ITEM_H, visible = DEX_VISIBLE } = {}) {
    this.width   = width;
    this.itemH   = itemH;
    this.visible = visible;
    this.entries = null;   // built lazily
    this.cursor  = 1;      // nat_dex_id (1-based)
    this.scroll  = 0;      // index of first visible row
  }

  get selected() {
    return this.entries?.[this.cursor - 1] ?? null;
  }

  reset() {
    this.cursor = 1;
    this.scroll = 0;
  }

  nav(dir) {
    if (!this.entries) return;
    this.cursor = Math.max(1, Math.min(this.entries.length, this.cursor + dir));
    const idx   = this.cursor - 1;
    if (idx < this.scroll) this.scroll = idx;
    if (idx >= this.scroll + this.visible) this.scroll = idx - this.visible + 1;
  }

  /** Draw the list at (x, y) into the given scene, registering objects via reg(). */
  draw(scene, reg, x, y) {
    if (!this.entries) {
      this.entries = new Pokedex(null).getNationalDex(3);
    }

    const { width, itemH, visible, cursor, scroll } = this;

    const rows = this.entries.slice(scroll, scroll + visible);
    rows.forEach((entry, i) => {
      const rowY       = y + i * itemH;
      const dexId      = entry.nat_dex_id;
      const isSelected = dexId === cursor;
      const record     = gameState.pokedex[dexId];
      const caught     = record?.caught;

      if (isSelected) {
        const sel = scene.add.graphics();
        sel.fillStyle(0x3399ff, 1);
        sel.fillRect(x - 4, rowY - 1, width - 4, itemH);
        reg(sel);
      }

      const color  = isSelected ? '#ffffff' : record ? '#181818' : '#888888';
      const style  = { fontFamily: 'Gen3', fontSize: '12px', color };
      const numStr = `#${String(dexId).padStart(3, '0')}`;
      const nameStr = record ? entry.species.toUpperCase() : '???';

      const numT  = scene.add.text(x,      rowY + 2, numStr,  style);
      const nameT = scene.add.text(x + 38, rowY + 2, nameStr, style);
      reg(numT);
      reg(nameT);

      if (caught) {
        reg(drawMiniBall(scene, x + 38 + nameT.width + 8, rowY + itemH / 2, 5));
      }
    });

    // Scroll indicators
    if (scroll > 0) {
      const up = scene.add.text(x + width / 2, y - 14, '▲', TEXT_STYLE_HINT);
      up.setOrigin(0.5, 0);
      reg(up);
    }
    if (scroll + visible < this.entries.length) {
      const dn = scene.add.text(x + width / 2, y + visible * itemH + 2, '▼', TEXT_STYLE_HINT);
      dn.setOrigin(0.5, 0);
      reg(dn);
    }
  }
}
