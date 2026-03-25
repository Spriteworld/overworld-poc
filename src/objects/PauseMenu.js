import Phaser from 'phaser';
import { gameState, getPlaytime } from '@Data/gameState.js';
import { Pokedex, GAMES, BasePokemon } from '@spriteworld/pokemon-data';
import TypeBadge from './TypeBadge.js';
import PokemonSprite from './PokemonSprite.js';

// ─── Layout ────────────────────────────────────────────────────────────────
const DEPTH  = Number.MAX_SAFE_INTEGER - 100;

// Main menu panel (right side)
const MX = 612; // left edge
const MY = 80;  // top edge
const MW = 170; // width
const ITEM_H = 28;
const PAD = 12;

// Sub-screen panel (fills most of canvas)
const SX = 10;
const SY = 80;
const SW = 590;
const SH = 440;

// Team screen layout
const TEAM_PAD_X   = 16;  // inner left padding of sub-panel
const TEAM_START_Y = 42;  // y offset from SY for slot area

// Hero slot (active mon, left side)
const HERO_W        = 210;
const HERO_H        = 180;
const HERO_SPRITE   = 80;  // sprite display size
const HERO_TEXT_X   = 8 + HERO_SPRITE + 10; // x offset from slot left for text
const HERO_TEXT_W   = HERO_W - HERO_TEXT_X - 8;

// Bench slots (mons 1-5, right column)
const BENCH_X_OFF = TEAM_PAD_X + HERO_W + 10; // right column x offset from SX
const BENCH_W     = 330;
const BENCH_H     = 64;
const BENCH_GAP   = 8;


const TEXT_STYLE      = { fontFamily: 'monospace', fontSize: '14px', color: '#181818' };
const TEXT_STYLE_BOLD = { fontFamily: 'monospace', fontSize: '14px', color: '#181818', fontStyle: 'bold' };
const TEXT_STYLE_BODY = { fontFamily: 'monospace', fontSize: '13px', color: '#181818' };
const TEXT_STYLE_HINT = { fontFamily: 'monospace', fontSize: '12px', color: '#888888' };
const TEXT_STYLE_SM   = { fontFamily: 'monospace', fontSize: '11px', color: '#181818' };

/**
 * Classic Pokemon-style pause menu displayed in OverworldUI.
 * Lives entirely in OverworldUI's display list; no separate scene needed.
 *
 * Navigation is driven externally by OverworldUI's keyboard handler:
 *   open(), close(), moveUp(), moveDown(), confirm(), back()
 */
export default class PauseMenu extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, 0, 0);
    this.name = 'PauseMenu';

    this._selectedIndex = 0;
    this._currentScreen = null; // null = main menu; string = sub-screen key

    this._menuKeys   = ['pokedex', 'team', 'bag', 'user', 'option', 'save', 'close'];
    this._menuLabels = [
      'POKÉDEX',
      'POKÉMON',
      'BAG',
      gameState.playerName.toUpperCase(),
      'OPTION',
      'SAVE',
      'CLOSE',
    ];

    // Team screen interaction state
    this._teamCursor   = 0;    // 0 = hero slot, 1-5 = bench slots
    this._teamSelected = null; // index of slot being moved, or null

    // Lazily built Pokedex instance
    this._dex = null;

    // Persistent graphics objects
    this._mainBg    = null;
    this._cursorText = null;
    this._mainTexts  = [];

    this._subBg    = null;
    this._subTexts = []; // rebuilt each time a sub-screen opens

    this._buildMainPanel();
    this._buildSubPanel();

    this.setDepth(DEPTH);
    this.setVisible(false);

    scene.add.existing(this);
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  _buildMainPanel() {
    const panelH = this._menuLabels.length * ITEM_H + PAD * 2;

    this._mainBg = this.scene.add.graphics();
    this._mainBg.fillStyle(0xf8f8f8, 1);
    this._mainBg.fillRect(MX, MY, MW, panelH);
    this._mainBg.lineStyle(3, 0x181818, 1);
    this._mainBg.strokeRect(MX, MY, MW, panelH);
    this.add(this._mainBg);

    this._cursorText = this.scene.add.text(MX + PAD, MY + PAD, '▶', TEXT_STYLE);
    this.add(this._cursorText);

    this._menuLabels.forEach((label, i) => {
      const t = this.scene.add.text(
        MX + PAD + 18,
        MY + PAD + i * ITEM_H,
        label,
        TEXT_STYLE
      );
      this.add(t);
      this._mainTexts.push(t);
    });
  }

  _buildSubPanel() {
    this._subBg = this.scene.add.graphics();
    this._subBg.fillStyle(0xf8f8f8, 1);
    this._subBg.fillRect(SX, SY, SW, SH);
    this._subBg.lineStyle(3, 0x181818, 1);
    this._subBg.strokeRect(SX, SY, SW, SH);
    this.add(this._subBg);
    this._subBg.setVisible(false);
  }

  // ─── Visibility helpers ──────────────────────────────────────────────────

  _showMainPanel() {
    this._mainBg.setVisible(true);
    this._cursorText.setVisible(true);
    this._mainTexts.forEach(t => t.setVisible(true));
    this._subBg.setVisible(false);
    this._clearSubTexts();
    this._updateCursor();
  }

  _showSubPanel() {
    this._mainBg.setVisible(false);
    this._cursorText.setVisible(false);
    this._mainTexts.forEach(t => t.setVisible(false));
    this._subBg.setVisible(true);
  }

  _clearSubTexts() {
    this._subTexts.forEach(t => t.destroy());
    this._subTexts = [];
  }

  _updateCursor() {
    this._cursorText.setY(MY + PAD + this._selectedIndex * ITEM_H);
  }

  // ─── Public API (called by OverworldUI) ──────────────────────────────────

  open() {
    this._selectedIndex = 0;
    this._currentScreen = null;
    this._clearSubTexts();
    this._showMainPanel();
    this.setVisible(true);
  }

  close() {
    this._clearSubTexts();
    this._currentScreen = null;
    this.setVisible(false);
  }

  moveUp() {
    if (this._currentScreen === 'team') { this._teamNav('up');   return; }
    if (this._currentScreen !== null) return;
    this._selectedIndex = (this._selectedIndex - 1 + this._menuKeys.length) % this._menuKeys.length;
    this._updateCursor();
  }

  moveDown() {
    if (this._currentScreen === 'team') { this._teamNav('down'); return; }
    if (this._currentScreen !== null) return;
    this._selectedIndex = (this._selectedIndex + 1) % this._menuKeys.length;
    this._updateCursor();
  }

  moveLeft() {
    if (this._currentScreen === 'team') this._teamNav('left');
  }

  moveRight() {
    if (this._currentScreen === 'team') this._teamNav('right');
  }

  /**
   * When on the team screen, handles pick-up/drop internally and returns null.
   * Otherwise returns the key of the highlighted main-menu option.
   * @return {string|null}
   */
  confirm() {
    if (this._currentScreen === 'team') { this._teamConfirm(); return null; }
    return this._menuKeys[this._selectedIndex];
  }

  /**
   * Close sub-screen (if open) or close the whole menu.
   * @return {boolean} true if the whole menu was closed
   */
  back() {
    if (this._currentScreen === 'team' && this._teamSelected !== null) {
      // Cancel pick-up
      this._teamSelected = null;
      this._rebuildTeamScreen();
      return false;
    }
    if (this._currentScreen !== null) {
      this._currentScreen = null;
      this._showMainPanel();
      return false;
    }
    this.close();
    return true;
  }

  showSubScreen(type) {
    this._currentScreen = type;
    if (type === 'team') {
      this._teamCursor   = 0;
      this._teamSelected = null;
    }
    this._showSubPanel();
    this._clearSubTexts();

    if (type === 'team') {
      this._buildTeamScreen();
    } else {
      this._buildTextScreen(type);
    }

    // Back hint at bottom
    const hint = this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT);
    this.add(hint);
    this._subTexts.push(hint);
  }

  // ─── Team navigation & interaction ───────────────────────────────────────

  _teamNav(dir) {
    const c = this._teamCursor;
    if (dir === 'up')    this._teamCursor = c === 0 ? 0 : c === 1 ? 0 : c - 1;
    if (dir === 'down')  this._teamCursor = c === 0 ? 1 : Math.min(5, c + 1);
    if (dir === 'left')  this._teamCursor = c > 0 ? 0 : c;
    if (dir === 'right') this._teamCursor = c === 0 ? 1 : c;
    this._rebuildTeamScreen();
  }

  _teamConfirm() {
    const slot = this._teamCursor;
    if (this._teamSelected === null) {
      // Pick up — only occupied slots
      if (gameState.party[slot]) {
        this._teamSelected = slot;
        this._rebuildTeamScreen();
      }
    } else {
      // Drop — only swap with occupied slots
      if (this._teamSelected !== slot && gameState.party[slot]) {
        const a = gameState.party[this._teamSelected] ?? null;
        const b = gameState.party[slot] ?? null;
        // Mutate in place to keep the same array reference
        gameState.party[this._teamSelected] = b;
        gameState.party[slot] = a;
        // Remove trailing undefineds so party stays compact
        while (gameState.party.length && !gameState.party[gameState.party.length - 1]) {
          gameState.party.pop();
        }
      }
      this._teamSelected = null;
      this._rebuildTeamScreen();
    }
  }

  _rebuildTeamScreen() {
    this._clearSubTexts();
    this._buildTeamScreen();
    const hint = this.scene.add.text(SX + 16, SY + SH - 22, 'X  back / cancel', TEXT_STYLE_HINT);
    this.add(hint);
    this._subTexts.push(hint);
  }

  // ─── Team sub-screen ─────────────────────────────────────────────────────

  _buildTeamScreen() {
    if (!this._dex) {
      this._dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    }

    // Title
    const title = this.scene.add.text(SX + TEAM_PAD_X, SY + 14, 'POKÉMON', TEXT_STYLE_BOLD);
    this.add(title);
    this._subTexts.push(title);

    const heroX = SX + TEAM_PAD_X;
    const heroY = SY + TEAM_START_Y;

    for (let i = 0; i < 6; i++) {
      const state = this._slotState(i);
      const mon   = gameState.party[i] ?? null;

      if (i === 0) {
        const x = heroX, y = heroY;
        mon ? this._buildHeroSlot(x, y, mon, state)
            : this._buildEmptySlot(x, y, HERO_W, HERO_H, state);
      } else {
        const x = SX + BENCH_X_OFF;
        const y = heroY + (i - 1) * (BENCH_H + BENCH_GAP);
        mon ? this._buildBenchSlot(x, y, mon, state)
            : this._buildEmptySlot(x, y, BENCH_W, BENCH_H, state);
      }
    }
  }

  /** Returns 'selected' | 'cursor' | 'target' | 'normal' for a given slot index. */
  _slotState(i) {
    if (i === this._teamSelected) return 'selected';
    if (i === this._teamCursor) return this._teamSelected !== null ? 'target' : 'cursor';
    return 'normal';
  }

  /** Returns { bg, border, lineWidth } for a slot state. */
  _slotColors(state) {
    switch (state) {
      case 'selected': return { bg: 0xfff5cc, border: 0xffcc00, lw: 3 };
      case 'cursor':   return { bg: 0xdce8f0, border: 0x3399ff, lw: 3 };
      case 'target':   return { bg: 0xd4f0d4, border: 0x44aa44, lw: 3 };
      default:         return { bg: 0xdce8f0, border: 0x181818, lw: 2 };
    }
  }

  /** Left-column slot for the active (first) Pokémon. */
  _buildHeroSlot(x, y, mon, state = 'normal') {
    const { entry, maxHp, types } = this._resolveMonData(mon);
    const currentHp  = mon.currentHp ?? maxHp;
    const hpRatio    = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? entry.species.toUpperCase() : `#${mon.species}`;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';

    const tx = x + HERO_TEXT_X; // text column x

    // Background
    const { bg, border, lw } = this._slotColors(state);
    const g = this.scene.add.graphics();
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x, y, HERO_W, HERO_H, 8);
    g.lineStyle(lw, border, 1);
    g.strokeRoundedRect(x, y, HERO_W, HERO_H, 8);
    this.add(g);
    this._subTexts.push(g);

    // Sprite — top-left
    const heroSprite = new PokemonSprite(this.scene, x + 8, y + 8, {
      species: mon.species,
      shiny:   mon.shiny ?? false,
      gender:  mon.gender,
      forme:   mon.forme ?? null,
      size:    HERO_SPRITE,
    });
    this.add(heroSprite);
    this._subTexts.push(heroSprite);

    // Name
    const nameText = this.scene.add.text(tx, y + 10, speciesName + gender, TEXT_STYLE_BOLD);
    this.add(nameText);
    this._subTexts.push(nameText);

    // Level
    const lvText = this.scene.add.text(x + HERO_W - 8, y + 10, `Lv.${mon.level}`, { ...TEXT_STYLE_SM, align: 'right' });
    lvText.setOrigin(1, 0);
    this.add(lvText);
    this._subTexts.push(lvText);

    // Type badges
    this._drawTypeBadges(tx, y + 30, types);

    // Nature / ability
    const natText = this.scene.add.text(tx, y + 56, `${mon.nature ?? ''}`, TEXT_STYLE_SM);
    this.add(natText);
    this._subTexts.push(natText);

    if (mon.ability?.name) {
      const abilText = this.scene.add.text(tx, y + 70, mon.ability.name, TEXT_STYLE_SM);
      this.add(abilText);
      this._subTexts.push(abilText);
    }

    // HP row — full width, below sprite
    this._drawHpRow(x + 8, y + 96, HERO_W - 16, currentHp, maxHp, hpRatio);
  }

  /** Compact right-column slot for bench Pokémon. */
  _buildBenchSlot(x, y, mon, state = 'normal') {
    const BENCH_SPRITE_SIZE = 48;
    const TEXT_X = x + BENCH_SPRITE_SIZE + 12;
    const TEXT_W = BENCH_W - BENCH_SPRITE_SIZE - 20;

    const { entry, maxHp } = this._resolveMonData(mon);
    const currentHp  = mon.currentHp ?? maxHp;
    const hpRatio    = Math.max(0, currentHp / maxHp);
    const speciesName = entry ? entry.species.toUpperCase() : `#${mon.species}`;
    const gender      = mon.gender === 'male' ? ' ♂' : mon.gender === 'female' ? ' ♀' : '';

    const { bg, border, lw } = this._slotColors(state);
    const g = this.scene.add.graphics();
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x, y, BENCH_W, BENCH_H, 6);
    g.lineStyle(lw, border, 1);
    g.strokeRoundedRect(x, y, BENCH_W, BENCH_H, 6);
    this.add(g);
    this._subTexts.push(g);

    // Sprite on the left
    const benchSprite = new PokemonSprite(this.scene, x + 8, y + Math.floor((BENCH_H - BENCH_SPRITE_SIZE) / 2), {
      species: mon.species,
      shiny:   mon.shiny ?? false,
      gender:  mon.gender,
      forme:   mon.forme ?? null,
      size:    BENCH_SPRITE_SIZE,
    });
    this.add(benchSprite);
    this._subTexts.push(benchSprite);

    // Name + level to the right of the sprite
    const nameText = this.scene.add.text(TEXT_X, y + 8, speciesName + gender, TEXT_STYLE_BOLD);
    this.add(nameText);
    this._subTexts.push(nameText);

    const lvText = this.scene.add.text(x + BENCH_W - 8, y + 8, `Lv.${mon.level}`, { ...TEXT_STYLE_SM, align: 'right' });
    lvText.setOrigin(1, 0);
    this.add(lvText);
    this._subTexts.push(lvText);

    this._drawHpRow(TEXT_X, y + 32, TEXT_W, currentHp, maxHp, hpRatio);
  }

  _buildEmptySlot(x, y, w, h, state = 'normal') {
    const isCursor = state === 'cursor' || state === 'target';
    const g = this.scene.add.graphics();
    g.lineStyle(isCursor ? 3 : 2, isCursor ? 0x3399ff : 0xcccccc, 1);
    g.strokeRoundedRect(x, y, w, h, 6);
    this.add(g);
    this._subTexts.push(g);

    const t = this.scene.add.text(x + w / 2, y + h / 2, '---', { ...TEXT_STYLE_HINT, align: 'center' });
    t.setOrigin(0.5, 0.5);
    this.add(t);
    this._subTexts.push(t);
  }

  /** Shared HP bar row: "HP" label, track, "cur/max". */
  _drawHpRow(x, y, width, currentHp, maxHp, hpRatio) {
    const labelW = 20;
    const hpColor = hpRatio > 0.5 ? 0x48c050 : hpRatio > 0.25 ? 0xf0c040 : 0xe04040;

    const hpLabel = this.scene.add.text(x, y, 'HP', { ...TEXT_STYLE_SM, color: '#444444' });
    this.add(hpLabel);
    this._subTexts.push(hpLabel);

    const barX = x + labelW + 2, barW = width - labelW - 2 - 52;
    const track = this.scene.add.graphics();
    track.fillStyle(0xaaaaaa, 1);
    track.fillRoundedRect(barX, y + 3, barW, 8, 3);
    track.fillStyle(hpColor, 1);
    track.fillRoundedRect(barX, y + 3, Math.max(2, barW * hpRatio), 8, 3);
    this.add(track);
    this._subTexts.push(track);

    const hpNums = this.scene.add.text(x + width, y, `${currentHp}/${maxHp}`, { ...TEXT_STYLE_SM, align: 'right' });
    hpNums.setOrigin(1, 0);
    this.add(hpNums);
    this._subTexts.push(hpNums);
  }

  /** Shared type badge renderer. */
  _drawTypeBadges(x, y, types) {
    (types ?? []).slice(0, 2).forEach((type, ti) => {
      const badge = new TypeBadge(this.scene, x + ti * (TypeBadge.WIDTH + 4), y, type);
      this.add(badge);
      this._subTexts.push(badge);
    });
  }

  /** Resolve species entry + maxHp from a party mon object. */
  _resolveMonData(mon) {
    try {
      const entry = this._dex.getPokemonById(mon.species);
      const bp    = new BasePokemon({ ...mon });
      return { entry, maxHp: bp.getMaxHp(), types: entry.types ?? [] };
    } catch {
      return { entry: null, maxHp: mon.level * 3 + 10, types: [] };
    }
  }

  // ─── Generic text sub-screen ─────────────────────────────────────────────

  _buildTextScreen(type) {
    const lines = this._getLines(type);
    lines.forEach((line, i) => {
      const style = i === 0 ? TEXT_STYLE_BOLD : TEXT_STYLE_BODY;
      const t = this.scene.add.text(SX + 16, SY + 16 + i * 22, line, style);
      this.add(t);
      this._subTexts.push(t);
    });
  }

  // ─── Sub-screen content ──────────────────────────────────────────────────

  _getLines(type) {
    switch (type) {
      case 'bag':    return this._bagLines();
      case 'user':   return this._userLines();
      default:       return [type.toUpperCase(), '', 'Not yet implemented.'];
    }
  }

  _bagLines() {
    const { items, pokeballs, tms } = gameState.bag;
    const all = [...items, ...pokeballs, ...tms];
    const lines = ['BAG', ''];

    if (all.length === 0) {
      lines.push('Bag is empty.');
    } else {
      all.forEach(entry => {
        lines.push(`${(entry.name ?? 'Item').padEnd(16)}  x${entry.quantity ?? 1}`);
      });
    }
    return lines;
  }

  _userLines() {
    const secs = Math.floor(getPlaytime());
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    const map = this.scene.registry.get('map') ?? gameState.currentMap;

    return [
      gameState.playerName.toUpperCase(),
      '',
      `Playtime:  ${h}:${m}:${s}`,
      `Location:  ${map}`,
    ];
  }
}
