import { gameState } from '@Data/gameState.js';
import store from '../../store/index.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';
import PokemonSprite from '../PokemonSprite.js';
import {
  SX, SY, SW, SH, ITEM_H, PAD,
  TEAM_PAD_X, TEAM_START_Y,
  HERO_W, HERO_H, HERO_SPRITE, HERO_TEXT_X,
  BENCH_X_OFF, BENCH_W, BENCH_H, BENCH_GAP,
  TEXT_STYLE, TEXT_STYLE_BOLD, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { slotColors, resolveMonData, drawHpRow, drawTypeBadges } from './helpers.js';

export default class TeamScreen {
  constructor(menu) {
    this.menu = menu;

    this.cursor      = 0;    // highlighted slot (0=hero, 1-5=bench)
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
    const c = this.cursor;
    if (dir === 'up')    this.cursor = c === 0 ? 0 : c === 1 ? 0 : c - 1;
    if (dir === 'down')  this.cursor = c === 0 ? 1 : Math.min(5, c + 1);
    if (dir === 'left')  this.cursor = c > 0 ? 0 : c;
    if (dir === 'right') this.cursor = c === 0 ? 1 : c;
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
    this._buildList();
    this._buildSubMenuOverlay();
    this._hint('X  cancel');
  }

  subMenuConfirm() {
    const slot = this.subMenuSlot;
    if (this.subMenuCursor === 0) {
      // Switch — enter swap mode
      this.selected    = slot;
      this.subMenuSlot = null;
      this.menu._transitionTo('team');
    } else if (this.subMenuCursor === 1) {
      // Details
      this.menu._transitionTo('team-detail');
    } else {
      // Cancel
      this.subMenuSlot = null;
      this.menu._transitionTo('team');
    }
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  /** Full rebuild: list + hint. Used by PauseMenu after back(). */
  rebuild() {
    this.menu._clearSubTexts();
    this._buildList();
    this._hint('X  back / cancel');
  }

  /** Build list + sub-menu overlay. Called by PauseMenu on team-submenu transition. */
  buildWithSubMenu() {
    this.menu._clearSubTexts();
    this._buildList();
    this._buildSubMenuOverlay();
    this._hint('X  cancel');
  }

  _buildList() {
    if (!this.menu.dex) this.menu.dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    const { menu } = this;
    const { scene, reg } = menu;

    reg(scene.add.text(SX + TEAM_PAD_X, SY + 14, 'POKÉMON', TEXT_STYLE_BOLD));

    const heroX = SX + TEAM_PAD_X;
    const heroY = SY + TEAM_START_Y;

    for (let i = 0; i < 6; i++) {
      const state = this._slotState(i);
      const mon   = gameState.party[i] ?? null;

      if (i === 0) {
        mon ? this._buildHeroSlot(heroX, heroY, mon, state)
            : this._buildEmptySlot(heroX, heroY, HERO_W, HERO_H, state);
      } else {
        const x = SX + BENCH_X_OFF;
        const y = heroY + (i - 1) * (BENCH_H + BENCH_GAP);
        mon ? this._buildBenchSlot(x, y, mon, state)
            : this._buildEmptySlot(x, y, BENCH_W, BENCH_H, state);
      }
    }
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

  // ─── Slot builders ───────────────────────────────────────────────────────

  _slotState(i) {
    if (this.subMenuSlot !== null && i === this.subMenuSlot) return 'cursor';
    if (i === this.selected) return 'selected';
    if (i === this.cursor)   return this.selected !== null ? 'target' : 'cursor';
    return 'normal';
  }

  _buildHeroSlot(x, y, mon, state) {
    const { entry, maxHp, types } = resolveMonData(this.menu.dex, mon);
    const currentHp   = mon.currentHp ?? maxHp;
    const hpRatio     = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? entry.species.toUpperCase() : `#${mon.species}`;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';
    const tx          = x + HERO_TEXT_X;

    const { bg, border, lw } = slotColors(state);
    const { scene, reg } = this.menu;

    const g = scene.add.graphics();
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x, y, HERO_W, HERO_H, 8);
    g.lineStyle(lw, border, 1);
    g.strokeRoundedRect(x, y, HERO_W, HERO_H, 8);
    reg(g);

    reg(new PokemonSprite(scene, x + 8, y + 8, {
      species: mon.species, shiny: mon.shiny ?? false,
      gender: mon.gender, forme: mon.forme ?? null, size: HERO_SPRITE,
    }));

    reg(scene.add.text(tx, y + 10, speciesName + gender, TEXT_STYLE_BOLD));

    const lvT = scene.add.text(x + HERO_W - 8, y + 10, `Lv.${mon.level}`, { ...TEXT_STYLE_SM, align: 'right' });
    lvT.setOrigin(1, 0);
    reg(lvT);

    drawTypeBadges(this.menu, tx, y + 30, types);
    reg(scene.add.text(tx, y + 56, `${mon.nature ?? ''}`, TEXT_STYLE_SM));
    if (mon.ability?.name) reg(scene.add.text(tx, y + 70, mon.ability.name, TEXT_STYLE_SM));
    drawHpRow(this.menu, x + 8, y + 96, HERO_W - 16, currentHp, maxHp, hpRatio);
  }

  _buildBenchSlot(x, y, mon, state) {
    const BENCH_SPRITE_SIZE = 48;
    const TEXT_X = x + BENCH_SPRITE_SIZE + 12;
    const TEXT_W = BENCH_W - BENCH_SPRITE_SIZE - 20;

    const { entry, maxHp } = resolveMonData(this.menu.dex, mon);
    const currentHp   = mon.currentHp ?? maxHp;
    const hpRatio     = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? entry.species.toUpperCase() : `#${mon.species}`;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';

    const { bg, border, lw } = slotColors(state);
    const { scene, reg } = this.menu;

    const g = scene.add.graphics();
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x, y, BENCH_W, BENCH_H, 6);
    g.lineStyle(lw, border, 1);
    g.strokeRoundedRect(x, y, BENCH_W, BENCH_H, 6);
    reg(g);

    reg(new PokemonSprite(scene, x + 8, y + Math.floor((BENCH_H - BENCH_SPRITE_SIZE) / 2), {
      species: mon.species, shiny: mon.shiny ?? false,
      gender: mon.gender, forme: mon.forme ?? null, size: BENCH_SPRITE_SIZE,
    }));

    reg(scene.add.text(TEXT_X, y + 8, speciesName + gender, TEXT_STYLE_BOLD));

    const lvT = scene.add.text(x + BENCH_W - 8, y + 8, `Lv.${mon.level}`, { ...TEXT_STYLE_SM, align: 'right' });
    lvT.setOrigin(1, 0);
    reg(lvT);

    drawHpRow(this.menu, TEXT_X, y + 32, TEXT_W, currentHp, maxHp, hpRatio);
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

  _hint(text) {
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, text, TEXT_STYLE_HINT));
  }
}
