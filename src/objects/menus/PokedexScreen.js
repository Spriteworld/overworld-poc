import { gameState } from '@Data/gameState.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';
import PokemonSprite from '../PokemonSprite.js';
import {
  SX, SY, SW, SH,
  DEX_LIST_W, DEX_ITEM_H, DEX_VISIBLE, DEX_DETAIL_X, DEX_DETAIL_W,
  TEXT_STYLE_BOLD, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { drawTypeBadges, drawMiniBall } from './helpers.js';

export default class PokedexScreen {
  constructor(menu) {
    this.menu    = menu;
    this.cursor  = 1;   // nat_dex_id (1-based)
    this.scroll  = 0;   // index of first visible row
    this.entries = null; // sorted array, built once
  }

  reset() {
    this.cursor = 1;
    this.scroll = 0;
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

  // ─── Build ───────────────────────────────────────────────────────────────

  rebuild() {
    this.menu._clearSubTexts();
    this.build();
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }

  build() {
    if (!this.menu.dex) this.menu.dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    if (!this.entries) {
      this.entries = Object.values(this.menu.dex.pokedex)
        .sort((a, b) => a.nat_dex_id - b.nat_dex_id);
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
    const dx     = DEX_DETAIL_X;
    const dy     = SY + 36;
    const record = gameState.pokedex[entry.nat_dex_id];
    const seen   = !!record?.seen;
    const caught = !!record?.caught;

    const { scene, reg } = this.menu;

    const numStr = `#${String(entry.nat_dex_id).padStart(3, '0')}`;
    reg(scene.add.text(dx, dy, numStr, TEXT_STYLE_HINT));
    reg(scene.add.text(dx + 44, dy, seen ? entry.species.toUpperCase() : '???', TEXT_STYLE_BOLD));

    const spriteSize = 80;
    if (caught) {
      reg(new PokemonSprite(scene, dx, dy + 22, { species: entry.nat_dex_id, size: spriteSize }));
    } else {
      const unk = scene.add.graphics();
      unk.fillStyle(0xcccccc, 1);
      unk.fillRect(dx, dy + 22, spriteSize, spriteSize);
      reg(unk);

      const q = scene.add.text(
        dx + spriteSize / 2, dy + 22 + spriteSize / 2,
        seen ? '!' : '?',
        { fontFamily: 'monospace', fontSize: '32px', color: '#888888' }
      );
      q.setOrigin(0.5, 0.5);
      reg(q);
    }

    const infoX = dx + spriteSize + 10;
    if (caught && entry.types?.length) {
      drawTypeBadges(this.menu, infoX, dy + 28, entry.types);
      const hw = scene.add.text(infoX, dy + 52,
        `HT  ${entry.height.toFixed(1)} m\nWT  ${entry.weight.toFixed(1)} kg`,
        { ...TEXT_STYLE_SM, lineSpacing: 6 }
      );
      reg(hw);
    } else if (seen && !caught) {
      reg(scene.add.text(infoX, dy + 36, 'Not yet caught', TEXT_STYLE_HINT));
    }

    if (!caught) return;

    // Base stats
    const statsY  = dy + 22 + spriteSize + 14;
    const LABEL_W = 30;
    const BAR_W   = Math.min(180, DEX_DETAIL_W - LABEL_W - 40);
    const STAT_MAX = 255;

    reg(scene.add.text(dx, statsY - 14, 'BASE STATS', TEXT_STYLE_HINT));

    [
      { label: 'HP',  key: 'HP' },
      { label: 'ATK', key: 'ATTACK' },
      { label: 'DEF', key: 'DEFENSE' },
      { label: 'SPA', key: 'SPECIAL_ATTACK' },
      { label: 'SPD', key: 'SPECIAL_DEFENSE' },
      { label: 'SPE', key: 'SPEED' },
    ].forEach(({ label, key }, i) => {
      const rowY     = statsY + i * 18;
      const val      = entry.base_stats[key] ?? 0;
      const ratio    = val / STAT_MAX;
      const barColor = ratio > 0.6 ? 0x48c050 : ratio > 0.35 ? 0xf0c040 : 0xe04040;
      const barX     = dx + LABEL_W;

      reg(scene.add.text(dx, rowY, label, { ...TEXT_STYLE_SM, color: '#555555' }));

      const track = scene.add.graphics();
      track.fillStyle(0xdddddd, 1);
      track.fillRoundedRect(barX, rowY + 2, BAR_W, 9, 2);
      track.fillStyle(barColor, 1);
      track.fillRoundedRect(barX, rowY + 2, Math.max(3, BAR_W * ratio), 9, 2);
      reg(track);

      const valT = scene.add.text(dx + LABEL_W + BAR_W + 4, rowY, String(val), { ...TEXT_STYLE_SM, align: 'right' });
      valT.setOrigin(0, 0);
      reg(valT);
    });
  }
}
