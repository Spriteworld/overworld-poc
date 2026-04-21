import { gameState } from '@Data/gameState.js';
import store from '../../store/index.js';
import { Pokedex, getSpeciesDisplayName, STATS, NATURES } from '@spriteworld/pokemon-data';
import { getGameDef } from '@Data/gameDef.js';
import PokemonSprite from '../PokemonSprite.js';
import { STATUS_ICON_W } from '../common/iconSheets.js';
import {
  SX, SY, SW, SH, ITEM_H, PAD,
  TEAM_PAD_X, TEAM_START_Y,
  TEAM_SPLIT_X,
  TEAM_LIST_X, TEAM_LIST_W, TEAM_SLOT_H, TEAM_SLOT_GAP, TEAM_SPRITE,
  TEAM_INFO_X, TEAM_INFO_W,
  TEXT_STYLE, TEXT_STYLE_BOLD, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { drawTypePills, TYPE_PILL_H } from '../common/TypePill.js';
import { drawMovesPanel, MOVES_PANEL_ROW_H } from '../common/MovesPanel.js';
import {
  slotColors, resolveMonData, drawHpRow,
  getActiveStatus, drawStatusBadge, drawMonIndicators,
} from './helpers.js';

const STAT_ROWS = [
  { label: 'HP',      key: STATS.HP,              isHp: true  },
  { label: 'Attack',  key: STATS.ATTACK,          isHp: false },
  { label: 'Defense', key: STATS.DEFENSE,         isHp: false },
  { label: 'Sp. Atk', key: STATS.SPECIAL_ATTACK,  isHp: false },
  { label: 'Sp. Def', key: STATS.SPECIAL_DEFENSE, isHp: false },
  { label: 'Speed',   key: STATS.SPEED,           isHp: false },
];
const STAT_ROW_H = 15;

export default class TeamScreen {
  constructor(menu) {
    this.menu = menu;

    this.cursor      = 0;    // highlighted slot (0–5)
    this.selected    = null; // slot picked up for swap, or null
    this.subMenuSlot = null; // slot that opened the action sub-menu
    this.subMenuCursor = 0;  // 0=Switch, 1=Details, 2=Cancel
  }

  reset() {
    this.cursor      = 0;
    this.selected    = null;
    this.subMenuSlot = null;
    this.subMenuCursor = 0;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  nav(dir) {
    if (dir === 'up')   this.cursor = Math.max(0, this.cursor - 1);
    if (dir === 'down') this.cursor = Math.min(5, this.cursor + 1);
    // left/right are no-ops; the list is a single vertical column now.
    this.rebuild();
  }

  confirm() {
    const slot = this.cursor;

    if (this.selected === null) {
      if (!gameState.party[slot]) return;
      this.subMenuSlot   = slot;
      this.subMenuCursor = 0;
      this.menu._transitionTo('team-submenu');
    } else {
      if (this.selected !== slot && gameState.party[slot]) {
        store.commit('party/SWAP', { a: this.selected, b: slot });
      }
      this.selected = null;
      this.rebuild();
    }
  }

  subMenuNav(dir) {
    const OPTS = 3;
    this.subMenuCursor = (this.subMenuCursor + dir + OPTS) % OPTS;
    this.menu._clearSubTexts();
    this._buildLayout();
    this._buildSubMenuOverlay();
    this._hint('X  cancel');
  }

  subMenuConfirm() {
    const slot = this.subMenuSlot;
    if (this.subMenuCursor === 0) {
      this.selected    = slot;
      this.subMenuSlot = null;
      this.menu._transitionTo('team');
    } else if (this.subMenuCursor === 1) {
      this.menu._transitionTo('team-detail');
    } else {
      this.subMenuSlot = null;
      this.menu._transitionTo('team');
    }
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  rebuild() {
    this.menu._clearSubTexts();
    this._buildLayout();
    this._hint('X  back / cancel');
  }

  buildWithSubMenu() {
    this.menu._clearSubTexts();
    this._buildLayout();
    this._buildSubMenuOverlay();
    this._hint('X  cancel');
  }

  _buildLayout() {
    if (!this.menu.dex) this.menu.dex = new Pokedex(getGameDef().game);
    const { menu } = this;
    const { scene, reg } = menu;

    reg(scene.add.text(SX + TEAM_PAD_X, SY + 14, 'POKÉMON', TEXT_STYLE_BOLD));

    // Vertical divider between list and info panel.
    const div = scene.add.graphics();
    div.lineStyle(1, 0xcccccc, 1);
    div.lineBetween(TEAM_SPLIT_X, SY + TEAM_START_Y, TEAM_SPLIT_X, SY + SH - 36);
    reg(div);

    // Left: 6 list slots.
    for (let i = 0; i < 6; i++) {
      const state = this._slotState(i);
      const mon   = gameState.party[i] ?? null;
      const y     = SY + TEAM_START_Y + i * (TEAM_SLOT_H + TEAM_SLOT_GAP);
      if (mon) this._buildListSlot(TEAM_LIST_X, y, mon, state);
      else     this._buildEmptySlot(TEAM_LIST_X, y, TEAM_LIST_W, TEAM_SLOT_H, state);
    }

    // Right: info panel for the cursor slot.
    const focusMon = gameState.party[this.cursor] ?? null;
    if (focusMon) this._buildInfoPanel(focusMon);
    else          this._buildInfoEmpty();
  }

  _buildSubMenuOverlay() {
    const OPTS = ['Switch', 'Details', 'Cancel'];
    const SMW  = 120;
    const SMH  = OPTS.length * ITEM_H + PAD * 2;
    const SMX  = SW - SMW - 16;
    const SMY  = SY + 56;

    const { scene, reg } = this.menu;

    const bg = scene.add.graphics();
    bg.fillStyle(0xf8f8f8, 1);
    bg.fillRoundedRect(SMX, SMY, SMW, SMH, 6);
    bg.lineStyle(2, 0x181818, 1);
    bg.strokeRoundedRect(SMX, SMY, SMW, SMH, 6);
    reg(bg);

    OPTS.forEach((label, i) => {
      if (i === this.subMenuCursor) {
        reg(scene.add.text(SMX + 8, SMY + PAD + i * ITEM_H, '▶', TEXT_STYLE));
      }
      reg(scene.add.text(SMX + 24, SMY + PAD + i * ITEM_H, label, TEXT_STYLE));
    });
  }

  // ─── List slots ──────────────────────────────────────────────────────────

  _slotState(i) {
    if (this.subMenuSlot !== null && i === this.subMenuSlot) return 'cursor';
    if (i === this.selected) return 'selected';
    if (i === this.cursor)   return this.selected !== null ? 'target' : 'cursor';
    return 'normal';
  }

  _buildListSlot(x, y, mon, state) {
    const { entry, maxHp } = resolveMonData(this.menu.dex, mon);
    const currentHp   = mon.currentHp ?? maxHp;
    const hpRatio     = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? getSpeciesDisplayName(entry).toUpperCase() : `#${mon.species}`;
    const displayName = mon.nickname || speciesName;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';

    const { bg, border, lw } = slotColors(state);
    const { scene, reg } = this.menu;

    const g = scene.add.graphics();
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x, y, TEAM_LIST_W, TEAM_SLOT_H, 6);
    g.lineStyle(lw, border, 1);
    g.strokeRoundedRect(x, y, TEAM_LIST_W, TEAM_SLOT_H, 6);
    reg(g);

    const spriteY = y + Math.floor((TEAM_SLOT_H - TEAM_SPRITE) / 2);
    const sprite = new PokemonSprite(scene, x + 8, spriteY, {
      species: mon.species, shiny: mon.shiny ?? false,
      gender: mon.gender, forme: mon.forme ?? null, size: TEAM_SPRITE,
    });
    reg(sprite);

    const bob = scene.tweens.add({
      targets:  sprite,
      y:        spriteY - 1,
      duration: 350,
      yoyo:     true,
      repeat:   -1,
      ease:     'Linear',
    });
    sprite.once('destroy', () => bob.remove());

    // HP bar / level / status still sit to the right of the sprite; only the
    // name is pulled all the way to the slot's left edge.
    const textX = x + TEAM_SPRITE + 16;
    const textW = TEAM_LIST_W - TEAM_SPRITE - 24;

    const topCy = y + 15;
    const nameT = scene.add.text(x + 8, topCy, displayName + gender, TEXT_STYLE_BOLD);
    nameT.setOrigin(0, 0.5);
    reg(nameT);

    drawMonIndicators(this.menu, x + 8 + Math.ceil(nameT.width) + 4, topCy, mon);

    const lvT = scene.add.text(x + TEAM_LIST_W - 8, topCy, `Lv.${mon.level}`, TEXT_STYLE_SM);
    lvT.setOrigin(1, 0.5);
    reg(lvT);

    const status = getActiveStatus(mon);
    if (status) {
      const bx = x + TEAM_LIST_W - 8 - Math.ceil(lvT.width) - 6 - STATUS_ICON_W;
      drawStatusBadge(this.menu, bx, topCy, status);
    }

    drawHpRow(this.menu, textX, y + TEAM_SLOT_H - 19, textW, currentHp, maxHp, hpRatio);
  }

  _buildEmptySlot(x, y, w, h, state) {
    const isCursor = state === 'cursor' || state === 'target';
    const { scene, reg } = this.menu;

    const g = scene.add.graphics();
    g.lineStyle(isCursor ? 3 : 2, isCursor ? 0x3399ff : 0xcccccc, 1);
    g.strokeRoundedRect(x, y, w, h, 6);
    reg(g);

    const t = scene.add.text(x + w / 2, y + h / 2, '---', { ...TEXT_STYLE_HINT, align: 'center' });
    t.setOrigin(0.5, 0.5);
    reg(t);
  }

  // ─── Info panel (right column) ───────────────────────────────────────────

  _buildInfoPanel(mon) {
    const { scene, reg } = this.menu;
    const { entry, types, maxHp } = resolveMonData(this.menu.dex, mon);
    const speciesName = entry ? getSpeciesDisplayName(entry).toUpperCase() : `#${mon.species}`;
    const displayName = mon.nickname || speciesName;
    const gender      = mon.gender === 'male' ? '♂' : mon.gender === 'female' ? '♀' : '';

    // ── Outer container ─────────────────────────────────────────────────
    // Card spans the info column from TEAM_START_Y to near the bottom hint.
    // Header strip (dark-ish) at the top holds name · level · HP; the rest
    // of the card is the body (types, stats, moves, ability, nature).
    const RAD      = 8;
    const CARD_X   = TEAM_INFO_X - 4;
    const CARD_Y   = SY + TEAM_START_Y;
    const CARD_W   = TEAM_INFO_W + 8;
    const CARD_H   = SY + SH - 40 - CARD_Y;
    const HEADER_H = 56;
    const INNER_PAD = 10;
    const x = TEAM_INFO_X;
    const w = TEAM_INFO_W;

    // Card body (rounded white fill + border)
    const card = scene.add.graphics();
    card.fillStyle(0xffffff, 1);
    card.fillRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, RAD);
    card.lineStyle(1, 0xcccccc, 1);
    card.strokeRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, RAD);
    reg(card);

    // Header strip — only the top corners are rounded so the bottom forms a
    // flat divider against the body.
    const header = scene.add.graphics();
    header.fillStyle(0x2a2f3a, 1);
    header.fillRoundedRect(CARD_X, CARD_Y, CARD_W, HEADER_H, { tl: RAD, tr: RAD, bl: 0, br: 0 });
    reg(header);

    // Header content: name (left, white) + level (right) on line 1; HP bar on line 2.
    const headerTextX = CARD_X + INNER_PAD;
    const nameCy = CARD_Y + 14;
    const whiteBold = { ...TEXT_STYLE_BOLD, color: '#ffffff' };
    const nameLabel = displayName + (gender ? ' ' + gender : '');
    const nickT = scene.add.text(headerTextX, nameCy, nameLabel, whiteBold);
    nickT.setOrigin(0, 0.5);
    reg(nickT);
    drawMonIndicators(this.menu, headerTextX + Math.ceil(nickT.width) + 6, nameCy, mon);

    const lvT = scene.add.text(CARD_X + CARD_W - INNER_PAD, nameCy, `Lv.${mon.level}`, whiteBold);
    lvT.setOrigin(1, 0.5);
    reg(lvT);

    // HP row inside the header strip (shown as a compact bar with current/max).
    const currentHp = mon.currentHp ?? maxHp;
    const hpRatio   = Math.max(0, currentHp / maxHp);
    drawHpRow(this.menu, headerTextX, CARD_Y + 30, CARD_W - INNER_PAD * 2, currentHp, maxHp, hpRatio);

    // ── Body ────────────────────────────────────────────────────────────
    let y = CARD_Y + HEADER_H + INNER_PAD;

    // Species subtitle (only when nickname differs)
    const nicknameDiffers = displayName.toUpperCase() !== speciesName;
    if (nicknameDiffers) {
      reg(scene.add.text(x, y, speciesName, TEXT_STYLE_SM));
      y += 18;
    }

    // Type pills
    drawTypePills(this.menu, x, y, types);
    y += TYPE_PILL_H + 8;

    // ── Stats table (light grey panel behind rows) ────────────────────
    reg(scene.add.text(x, y, 'STATS', TEXT_STYLE_BOLD));
    y += 20;

    const statsPad = 8;
    const statsH   = STAT_ROWS.length * STAT_ROW_H + statsPad;
    const statsBg  = scene.add.graphics();
    statsBg.fillStyle(0xeeeeee, 1);
    statsBg.lineStyle(1, 0xdddddd, 1);
    // Stay inside the outer card — bg shares x/w with the body instead of
    // extending horizontally past the stat-row bounds.
    statsBg.fillRoundedRect(x, y - statsPad / 2, w, statsH, 6);
    statsBg.strokeRoundedRect(x, y - statsPad / 2, w, statsH, 6);
    reg(statsBg);

    this._buildStatsTable(mon, entry, x, y, w);
    y += STAT_ROWS.length * STAT_ROW_H + 8;

    // ── Moves (blue bg per populated slot) ────────────────────────────
    reg(scene.add.text(x, y, 'MOVES', TEXT_STYLE_BOLD));
    y += 22;

    y += drawMovesPanel(this.menu, {
      x, y, w,
      moves:        mon.moves ?? [],
      filledBg:     0xbfdbfe,   // tailwind blue-200
      filledStroke: 0x60a5fa,   // blue-400 border
    }) + 10;

    // ── Ability + Nature (each in its own rounded pill) ───────────────
    const drawPill = (label, value) => {
      const H = 26;
      const bg = scene.add.graphics();
      bg.fillStyle(0xf3f4f6, 1);      // gray-100
      bg.lineStyle(1, 0xd1d5db, 1);   // gray-300
      bg.fillRoundedRect(x, y, w, H, 8);
      bg.strokeRoundedRect(x, y, w, H, 8);
      reg(bg);
      const cy = y + H / 2;
      const l = scene.add.text(x + 10, cy, label, TEXT_STYLE_HINT);
      l.setOrigin(0, 0.5);
      reg(l);
      const v = scene.add.text(x + 82, cy, value, TEXT_STYLE_SM);
      v.setOrigin(0, 0.5);
      reg(v);
      y += H + 6;
    };
    if (mon.ability?.name && mon.ability.name !== 'none') drawPill('Ability', mon.ability.name);
    if (mon.nature) drawPill('Nature', mon.nature);
  }

  _buildStatsTable(mon, entry, x, y, w) {
    const { scene, reg } = this.menu;
    const lvl = mon.level ?? 1;

    const natureData = mon.nature
      ? Object.values(NATURES).find(n => n.name === mon.nature.toUpperCase())
      : null;
    const natInc = natureData?.increase;
    const natDec = natureData?.decrease;
    const nonNeutral = natInc !== natDec;

    // Column anchors
    const NAT_X   = x + 58;
    const STAT_R  = x + 110;        // stat value right-aligned
    const BAR_X   = x + 122;
    const BAR_R   = x + w - 34;
    const IV_R    = x + w;
    const BAR_W   = BAR_R - BAR_X;

    STAT_ROWS.forEach(({ label, key, isHp }, i) => {
      const rowY = y + i * STAT_ROW_H;
      const cy   = rowY + STAT_ROW_H / 2;
      const iv   = mon.ivs?.[key] ?? 0;
      const ev   = mon.evs?.[key] ?? 0;
      const base = entry?.base_stats?.[key] ?? 0;
      const term = Math.floor((2 * base + iv + Math.floor(ev / 4)) * lvl / 100);
      const raw  = isHp ? term + lvl + 10 : term + 5;
      const mult = (!isHp && natInc === key && nonNeutral) ? 1.1
                 : (!isHp && natDec === key && nonNeutral) ? 0.9 : 1;
      const stat = Math.floor(raw * mult);

      // Label (coloured by nature mod)
      const labelCol = mult > 1 ? '#e03030' : mult < 1 ? '#3060e0' : '#181818';
      const labelT = scene.add.text(x, cy, label, { ...TEXT_STYLE_SM, color: labelCol });
      labelT.setOrigin(0, 0.5);
      reg(labelT);

      // Nature marker
      if (mult !== 1) {
        const mark = mult > 1 ? '▲' : '▼';
        const col  = mult > 1 ? '#e03030' : '#3060e0';
        const mT = scene.add.text(NAT_X, cy, mark, { ...TEXT_STYLE_SM, color: col });
        mT.setOrigin(0, 0.5);
        reg(mT);
      }

      // Calculated stat (right-aligned)
      const statT = scene.add.text(STAT_R, cy, String(stat), TEXT_STYLE_SM);
      statT.setOrigin(1, 0.5);
      reg(statT);

      // IV bar (0–31) — centred on the text's optical centre (offset for Gen3 font).
      // Kept thin so 6 stat rows still fit inside the card's stats panel.
      const BAR_H    = 6;
      const barY     = Math.round(cy - BAR_H / 2) + 3;
      const ratio    = iv / 31;
      const barColor = iv === 31 ? 0xe0a000 : iv >= 21 ? 0x48c050 : iv >= 11 ? 0xf0c040 : 0xe04040;
      const track = scene.add.graphics();
      track.fillStyle(0xdddddd, 1);
      track.fillRoundedRect(BAR_X, barY, BAR_W, BAR_H, 2);
      if (iv > 0) {
        track.fillStyle(barColor, 1);
        track.fillRoundedRect(BAR_X, barY, Math.max(2, BAR_W * ratio), BAR_H, 2);
      }
      reg(track);

      // IV value (right-aligned)
      const ivCol = iv === 31 ? '#e0a000' : iv === 0 ? '#c03030' : '#181818';
      const ivT = scene.add.text(IV_R, cy, String(iv), { ...TEXT_STYLE_SM, color: ivCol });
      ivT.setOrigin(1, 0.5);
      reg(ivT);
    });
  }

  _buildInfoEmpty() {
    const { scene, reg } = this.menu;
    const x = TEAM_INFO_X;
    const y = SY + TEAM_START_Y + 40;
    const t = scene.add.text(x + TEAM_INFO_W / 2, y, 'Empty slot', { ...TEXT_STYLE_HINT, align: 'center' });
    t.setOrigin(0.5, 0);
    reg(t);
  }

  _hint(text) {
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, text, TEXT_STYLE_HINT));
  }
}
