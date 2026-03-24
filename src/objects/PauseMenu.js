import Phaser from 'phaser';
import { gameState, getPlaytime } from '@Data/gameState.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';

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

const TEXT_STYLE      = { fontFamily: 'monospace', fontSize: '14px', color: '#181818' };
const TEXT_STYLE_BOLD = { fontFamily: 'monospace', fontSize: '14px', color: '#181818', fontStyle: 'bold' };
const TEXT_STYLE_BODY = { fontFamily: 'monospace', fontSize: '13px', color: '#181818' };
const TEXT_STYLE_HINT = { fontFamily: 'monospace', fontSize: '12px', color: '#888888' };

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
      '× CLOSE',
    ];

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
    if (this._currentScreen !== null) return;
    this._selectedIndex = (this._selectedIndex - 1 + this._menuKeys.length) % this._menuKeys.length;
    this._updateCursor();
  }

  moveDown() {
    if (this._currentScreen !== null) return;
    this._selectedIndex = (this._selectedIndex + 1) % this._menuKeys.length;
    this._updateCursor();
  }

  /** @return {string} key of the currently highlighted option */
  confirm() {
    return this._menuKeys[this._selectedIndex];
  }

  /**
   * Close sub-screen (if open) or close the whole menu.
   * @return {boolean} true if the whole menu was closed
   */
  back() {
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
    this._showSubPanel();
    this._clearSubTexts();

    const lines = this._getLines(type);

    lines.forEach((line, i) => {
      const style = i === 0 ? TEXT_STYLE_BOLD : TEXT_STYLE_BODY;
      const t = this.scene.add.text(SX + 16, SY + 16 + i * 22, line, style);
      this.add(t);
      this._subTexts.push(t);
    });

    // Back hint at bottom
    const hint = this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT);
    this.add(hint);
    this._subTexts.push(hint);
  }

  // ─── Sub-screen content ──────────────────────────────────────────────────

  _getLines(type) {
    switch (type) {
      case 'team':   return this._teamLines();
      case 'bag':    return this._bagLines();
      case 'user':   return this._userLines();
      default:       return [type.toUpperCase(), '', 'Not yet implemented.'];
    }
  }

  _teamLines() {
    if (!this._dex) {
      this._dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    }

    const lines = ['POKÉMON', ''];
    if (gameState.party.length === 0) {
      lines.push('No Pokémon in party.');
    } else {
      gameState.party.forEach((p, i) => {
        let name;
        try {
          name = this._dex.getPokemonById(p.species).species.toUpperCase();
        } catch {
          name = `#${p.species}`;
        }
        lines.push(`${i + 1}.  ${name.padEnd(12)}  Lv.${p.level}`);
      });
    }
    return lines;
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
