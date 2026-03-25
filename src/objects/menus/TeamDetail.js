import { gameState } from '@Data/gameState.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';
import PokemonSprite from '../PokemonSprite.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { resolveMonData, drawHpRow, drawTypeBadges } from './helpers.js';

const HINT = '▲▼  switch  ·  X  back';

const STAT_ROWS = [
  { label: 'HP',  key: 'HP',             isHp: true  },
  { label: 'ATK', key: 'ATTACK',         isHp: false },
  { label: 'DEF', key: 'DEFENSE',        isHp: false },
  { label: 'SPA', key: 'SPECIAL_ATTACK', isHp: false },
  { label: 'SPD', key: 'SPECIAL_DEFENSE',isHp: false },
  { label: 'SPE', key: 'SPEED',          isHp: false },
];

export default class TeamDetail {
  constructor(menu) {
    this.menu        = menu;
    this.currentSlot = 0;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  nav(dir) {
    const party    = gameState.party;
    const occupied = party.map((m, i) => m ? i : null).filter(i => i !== null);
    if (occupied.length <= 1) return;
    const pos  = occupied.indexOf(this.currentSlot);
    this.currentSlot = occupied[(pos + dir + occupied.length) % occupied.length];
    this.menu._clearSubTexts();
    this._buildContent(party[this.currentSlot]);
    this._hint();
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  build(slot) {
    this.currentSlot = slot;
    this._buildContent(gameState.party[slot]);
    this._hint();
  }

  _buildContent(mon) {
    if (!this.menu.dex) this.menu.dex = new Pokedex(GAMES.POKEMON_FIRE_RED);

    const { entry, maxHp, types } = resolveMonData(this.menu.dex, mon);
    const currentHp   = mon.currentHp ?? maxHp;
    const hpRatio     = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? entry.species.toUpperCase() : `#${mon.species}`;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';
    const dexNum      = entry ? `#${String(entry.nat_dex_id).padStart(3, '0')}` : '';

    const { scene, reg } = this.menu;

    // ── Title row ──────────────────────────────────────────────────────
    reg(scene.add.text(SX + 16, SY + 14, speciesName + gender, TEXT_STYLE_BOLD));

    const lvT = scene.add.text(SW - 16, SY + 14, `Lv.${mon.level}`, TEXT_STYLE_BOLD);
    lvT.setOrigin(1, 0);
    reg(lvT);

    // ── Left column: sprite + types + HP ───────────────────────────────
    const spriteSize = 96;
    const col1X = SX + 20;
    const col1Y = SY + 48;

    reg(new PokemonSprite(scene, col1X, col1Y, {
      species: mon.species, shiny: mon.shiny ?? false,
      gender: mon.gender, forme: mon.forme ?? null, size: spriteSize,
    }));

    drawTypeBadges(this.menu, col1X, col1Y + spriteSize + 6, types);
    drawHpRow(this.menu, col1X, col1Y + spriteSize + 30, spriteSize + 40, currentHp, maxHp, hpRatio);

    // ── Right of sprite: dex#, nature, ability ─────────────────────────
    const col2X = col1X + spriteSize + 16;
    const col2Y = col1Y;

    if (dexNum) reg(scene.add.text(col2X, col2Y, dexNum, TEXT_STYLE_HINT));

    const infoLines = [];
    if (mon.nature)       infoLines.push(`Nature:   ${mon.nature}`);
    if (mon.ability?.name && mon.ability.name !== 'none') infoLines.push(`Ability:  ${mon.ability.name}`);
    infoLines.forEach((line, i) => {
      reg(scene.add.text(col2X, col2Y + (dexNum ? 18 : 0) + i * 18, line, TEXT_STYLE_BODY));
    });

    // ── Horizontal divider ─────────────────────────────────────────────
    const divY = col1Y + spriteSize + 56;

    const hDiv = scene.add.graphics();
    hDiv.lineStyle(1, 0xcccccc, 1);
    hDiv.lineBetween(SX + 16, divY, SW - 16, divY);
    reg(hDiv);

    const vDivX = SX + 400;
    const vDiv  = scene.add.graphics();
    vDiv.lineStyle(1, 0xcccccc, 1);
    vDiv.lineBetween(vDivX, divY + 8, vDivX, SY + SH - 30);
    reg(vDiv);

    const bottomY = divY + 12;

    // ── Moves ──────────────────────────────────────────────────────────
    const movesX = SX + 20;
    const movesW = 368;

    reg(scene.add.text(movesX, bottomY, 'MOVES', TEXT_STYLE_HINT));

    (mon.moves ?? []).forEach((m, i) => {
      const my = bottomY + 18 + i * 38;

      const slotBg = scene.add.graphics();
      slotBg.fillStyle(0xeef2f8, 1);
      slotBg.fillRoundedRect(movesX, my, movesW - 10, 32, 4);
      reg(slotBg);

      reg(scene.add.text(movesX + 8, my + 9, m.name, TEXT_STYLE_BODY));

      const ppCur = m.pp?.current ?? m.pp?.max ?? '?';
      const ppMax = m.pp?.max ?? '?';
      const ppT = scene.add.text(movesX + movesW - 18, my + 9, `PP ${ppCur}/${ppMax}`, TEXT_STYLE_SM);
      ppT.setOrigin(1, 0);
      reg(ppT);
    });

    // ── Stats ──────────────────────────────────────────────────────────
    const statsX = vDivX + 14;
    const statsW = SW - vDivX - 30;
    const ivs    = mon.ivs  ?? {};
    const evs    = mon.evs  ?? {};
    const lvl    = mon.level ?? 1;

    reg(scene.add.text(statsX, bottomY, 'STATS', TEXT_STYLE_HINT));

    STAT_ROWS.forEach(({ label, key, isHp }, i) => {
      const rowY     = bottomY + 18 + i * 22;
      const base     = entry?.base_stats?.[key] ?? 0;
      const iv       = ivs[key] ?? 0;
      const ev       = evs[key] ?? 0;
      const term     = Math.floor((2 * base + iv + Math.floor(ev / 4)) * lvl / 100);
      const stat     = isHp ? term + lvl + 10 : term + 5;
      const ratio    = Math.min(1, stat / (isHp ? 400 : 300));
      const barColor = ratio > 0.5 ? 0x48c050 : ratio > 0.3 ? 0xf0c040 : 0xe04040;

      reg(scene.add.text(statsX, rowY, label, { ...TEXT_STYLE_SM, color: '#555555' }));

      const barX   = statsX + 32;
      const barW   = statsW - 32 - 28;
      const track  = scene.add.graphics();
      track.fillStyle(0xdddddd, 1);
      track.fillRoundedRect(barX, rowY + 2, barW, 8, 2);
      track.fillStyle(barColor, 1);
      track.fillRoundedRect(barX, rowY + 2, Math.max(3, barW * ratio), 8, 2);
      reg(track);

      reg(scene.add.text(statsX + 32 + barW + 4, rowY, String(stat), TEXT_STYLE_SM));
    });
  }

  _hint() {
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, HINT, TEXT_STYLE_HINT));
  }
}
