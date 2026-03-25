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

// Sub-screen panel (full canvas)
const SX = 0;
const SY = 0;
const SW = 800;
const SH = 600;

// Pokédex screen layout
const DEX_LIST_W   = 200;  // width of left list pane
const DEX_ITEM_H   = 20;   // height of each list row
const DEX_VISIBLE  = 25;   // max visible list rows
const DEX_DETAIL_X = SX + DEX_LIST_W + 28;  // right panel x
const DEX_DETAIL_W = SW - DEX_LIST_W - 44;  // right panel width

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

    // Pokédex screen state
    this._dexCursor  = 1;   // nat_dex_id of selected entry (1-based)
    this._dexScroll  = 0;   // index of first visible list row (0-based)
    this._dexEntries = null; // sorted array of all pokedex entries, built once

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
    if (this._currentScreen === 'team')    { this._teamNav('up'); return; }
    if (this._currentScreen === 'pokedex') { this._dexNav(-1);    return; }
    if (this._currentScreen !== null) return;
    this._selectedIndex = (this._selectedIndex - 1 + this._menuKeys.length) % this._menuKeys.length;
    this._updateCursor();
  }

  moveDown() {
    if (this._currentScreen === 'team')    { this._teamNav('down'); return; }
    if (this._currentScreen === 'pokedex') { this._dexNav(1);       return; }
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
    if (this._currentScreen === 'team')    { this._teamConfirm(); return null; }
    if (this._currentScreen !== null)      return null; // sub-screens handle Enter internally
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
    if (type === 'pokedex') {
      this._dexCursor = 1;
      this._dexScroll = 0;
    }
    this._showSubPanel();
    this._clearSubTexts();

    if (type === 'team') {
      this._buildTeamScreen();
    } else if (type === 'pokedex') {
      this._buildPokedexScreen();
    } else {
      this._buildTextScreen(type);
    }

    // Back hint at bottom (team screen rebuilds its own hint)
    if (type !== 'team' && type !== 'pokedex') {
      const hint = this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT);
      this.add(hint);
      this._subTexts.push(hint);
    }
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

  // ─── Pokédex navigation & build ──────────────────────────────────────────

  _dexNav(dir) {
    if (!this._dexEntries) return;
    const total = this._dexEntries.length;
    this._dexCursor = Math.max(1, Math.min(total, this._dexCursor + dir));
    // Keep cursor inside the visible scroll window
    const idx = this._dexCursor - 1;
    if (idx < this._dexScroll) this._dexScroll = idx;
    if (idx >= this._dexScroll + DEX_VISIBLE) this._dexScroll = idx - DEX_VISIBLE + 1;
    this._rebuildDexScreen();
  }

  _rebuildDexScreen() {
    this._clearSubTexts();
    this._buildPokedexScreen();
    const hint = this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT);
    this.add(hint);
    this._subTexts.push(hint);
  }

  _buildPokedexScreen() {
    if (!this._dex) this._dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    if (!this._dexEntries) {
      this._dexEntries = Object.values(this._dex.pokedex)
        .sort((a, b) => a.nat_dex_id - b.nat_dex_id);
    }

    // Title
    const title = this.scene.add.text(SX + 16, SY + 14, 'POKÉDEX', TEXT_STYLE_BOLD);
    this.add(title);
    this._subTexts.push(title);

    // ── Left list pane ───────────────────────────────────────────────────
    const listX = SX + 16;
    const listY = SY + 40;

    // Vertical divider between list and detail
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0xcccccc, 1);
    divider.lineBetween(SX + DEX_LIST_W + 16, SY + 36, SX + DEX_LIST_W + 16, SY + SH - 30);
    this.add(divider);
    this._subTexts.push(divider);

    const visibleEntries = this._dexEntries.slice(this._dexScroll, this._dexScroll + DEX_VISIBLE);
    visibleEntries.forEach((entry, i) => {
      const rowY    = listY + i * DEX_ITEM_H;
      const dexId   = entry.nat_dex_id;
      const isSelected = dexId === this._dexCursor;
      const seen    = gameState.pokedex[dexId];
      const caught  = seen?.caught;

      if (isSelected) {
        const sel = this.scene.add.graphics();
        sel.fillStyle(0x3399ff, 1);
        sel.fillRect(listX - 4, rowY - 1, DEX_LIST_W - 4, DEX_ITEM_H);
        this.add(sel);
        this._subTexts.push(sel);
      }

      const numStr  = `#${String(dexId).padStart(3, '0')}`;
      const nameStr = seen ? entry.species.toUpperCase() : '???';
      const color   = isSelected ? '#ffffff' : seen ? '#181818' : '#888888';
      const style   = { fontFamily: 'monospace', fontSize: '12px', color };

      const numT  = this.scene.add.text(listX, rowY + 2, numStr, style);
      const nameT = this.scene.add.text(listX + 38, rowY + 2, nameStr, style);
      this.add(numT);
      this.add(nameT);
      this._subTexts.push(numT, nameT);

      if (caught) {
        const ball = this._drawMiniBall(listX + 38 + nameT.width + 8, rowY + DEX_ITEM_H / 2, 5);
        this.add(ball);
        this._subTexts.push(ball);
      }
    });

    // Scroll indicators
    if (this._dexScroll > 0) {
      const up = this.scene.add.text(listX + DEX_LIST_W / 2, listY - 14, '▲', TEXT_STYLE_HINT);
      up.setOrigin(0.5, 0);
      this.add(up);
      this._subTexts.push(up);
    }
    if (this._dexScroll + DEX_VISIBLE < this._dexEntries.length) {
      const dn = this.scene.add.text(listX + DEX_LIST_W / 2, listY + DEX_VISIBLE * DEX_ITEM_H + 2, '▼', TEXT_STYLE_HINT);
      dn.setOrigin(0.5, 0);
      this.add(dn);
      this._subTexts.push(dn);
    }

    // ── Right detail pane ────────────────────────────────────────────────
    const entry = this._dexEntries[this._dexCursor - 1];
    if (entry) this._buildDexDetail(entry);
  }

  _buildDexDetail(entry) {
    const dx     = DEX_DETAIL_X;
    const dy     = SY + 36;
    const record = gameState.pokedex[entry.nat_dex_id];
    const seen   = !!record?.seen;
    const caught = !!record?.caught;

    // Dex number
    const numStr = `#${String(entry.nat_dex_id).padStart(3, '0')}`;
    const numT = this.scene.add.text(dx, dy, numStr, TEXT_STYLE_HINT);
    this.add(numT);
    this._subTexts.push(numT);

    // Species name — revealed once seen
    const nameStr = seen ? entry.species.toUpperCase() : '???';
    const nameT = this.scene.add.text(dx + 44, dy, nameStr, TEXT_STYLE_BOLD);
    this.add(nameT);
    this._subTexts.push(nameT);

    // Sprite — only shown when caught; grey silhouette when only seen
    const spriteSize = 80;
    if (caught) {
      const sprite = new PokemonSprite(this.scene, dx, dy + 22, {
        species: entry.nat_dex_id,
        size: spriteSize,
      });
      this.add(sprite);
      this._subTexts.push(sprite);
    } else {
      const unk = this.scene.add.graphics();
      unk.fillStyle(0xcccccc, 1);
      unk.fillRect(dx, dy + 22, spriteSize, spriteSize);
      const q = this.scene.add.text(
        dx + spriteSize / 2, dy + 22 + spriteSize / 2,
        seen ? '!' : '?',
        { fontFamily: 'monospace', fontSize: '32px', color: '#888888' }
      );
      q.setOrigin(0.5, 0.5);
      this.add(unk);
      this.add(q);
      this._subTexts.push(unk, q);
    }

    // Types, height/weight — only when caught
    const infoX = dx + spriteSize + 10;
    if (caught && entry.types?.length) {
      this._drawTypeBadges(infoX, dy + 28, entry.types);
      const hw = this.scene.add.text(infoX, dy + 52,
        `HT  ${entry.height.toFixed(1)} m\nWT  ${entry.weight.toFixed(1)} kg`,
        { ...TEXT_STYLE_SM, lineSpacing: 6 }
      );
      this.add(hw);
      this._subTexts.push(hw);
    } else if (seen && !caught) {
      const seenNote = this.scene.add.text(infoX, dy + 36, 'Not yet caught', TEXT_STYLE_HINT);
      this.add(seenNote);
      this._subTexts.push(seenNote);
    }

    // ── Base stats — only when caught ────────────────────────────────────
    const statsY   = dy + 22 + spriteSize + 14;
    const statW    = DEX_DETAIL_W - 4;
    const LABEL_W  = 30;
    const BAR_W    = Math.min(180, statW - LABEL_W - 36);
    const STAT_MAX = 255;

    const STAT_ROWS = [
      { label: 'HP',  key: 'HP' },
      { label: 'ATK', key: 'ATTACK' },
      { label: 'DEF', key: 'DEFENSE' },
      { label: 'SPA', key: 'SPECIAL_ATTACK' },
      { label: 'SPD', key: 'SPECIAL_DEFENSE' },
      { label: 'SPE', key: 'SPEED' },
    ];

    if (caught) {
      const statsTitle = this.scene.add.text(dx, statsY - 14, 'BASE STATS', TEXT_STYLE_HINT);
      this.add(statsTitle);
      this._subTexts.push(statsTitle);

      STAT_ROWS.forEach(({ label, key }, i) => {
        const rowY = statsY + i * 18;
        const val  = entry.base_stats[key] ?? 0;
        const ratio = val / STAT_MAX;
        const barColor = ratio > 0.6 ? 0x48c050 : ratio > 0.35 ? 0xf0c040 : 0xe04040;

        const lbl = this.scene.add.text(dx, rowY, label, { ...TEXT_STYLE_SM, color: '#555555' });
        this.add(lbl);
        this._subTexts.push(lbl);

        const track = this.scene.add.graphics();
        const barX = dx + LABEL_W;
        track.fillStyle(0xdddddd, 1);
        track.fillRoundedRect(barX, rowY + 2, BAR_W, 9, 2);
        track.fillStyle(barColor, 1);
        track.fillRoundedRect(barX, rowY + 2, Math.max(3, BAR_W * ratio), 9, 2);
        this.add(track);
        this._subTexts.push(track);

        const valT = this.scene.add.text(dx + LABEL_W + BAR_W + 4, rowY, String(val), { ...TEXT_STYLE_SM, align: 'right' });
        valT.setOrigin(0, 0);
        this.add(valT);
        this._subTexts.push(valT);
      });
    }
  }

  /** Draw a mini Pokéball graphic centred at (cx, cy) with radius r. Returns the Graphics object. */
  _drawMiniBall(cx, cy, r) {
    const g = this.scene.add.graphics();
    // Top half — red arc
    g.fillStyle(0xee1111, 1);
    g.beginPath();
    g.arc(cx, cy, r, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    // Bottom half — white arc
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI, false);
    g.closePath();
    g.fillPath();
    // Outer border
    g.lineStyle(1, 0x111111, 1);
    g.strokeCircle(cx, cy, r);
    // Horizontal divider
    g.lineBetween(cx - r, cy, cx + r, cy);
    // Centre button — white fill then border
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, 2);
    g.lineStyle(1, 0x111111, 1);
    g.strokeCircle(cx, cy, 2);
    return g;
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
