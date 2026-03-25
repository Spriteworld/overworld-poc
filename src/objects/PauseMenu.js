import Phaser from 'phaser';
import { gameState } from '@Data/gameState.js';
import {
  MX, MY, MW, ITEM_H, PAD,
  SX, SY, SW, SH,
  TEXT_STYLE, TEXT_STYLE_BODY, TEXT_STYLE_BOLD, TEXT_STYLE_HINT,
} from './menus/layout.js';
import TeamScreen    from './menus/TeamScreen.js';
import TeamDetail    from './menus/TeamDetail.js';
import PokedexScreen from './menus/PokedexScreen.js';
import BagScreen     from './menus/BagScreen.js';
import UserScreen    from './menus/UserScreen.js';

const MENU_DEPTH = Number.MAX_SAFE_INTEGER - 100;

const MENU_KEYS   = ['pokedex', 'team', 'bag', 'user', 'option', 'save', 'close'];
const MENU_LABELS = ['POKÉDEX', 'POKÉMON', 'BAG', null /* playerName */, 'OPTION', 'SAVE', 'CLOSE'];

/**
 * Classic Pokémon-style pause menu living in OverworldUI's display list.
 *
 * Public API (called by OverworldUI keyboard handler):
 *   open(), close(), moveUp(), moveDown(), moveLeft(), moveRight(), confirm(), back()
 *
 * Each sub-screen is a separate class in src/objects/menus/.
 * Screens call menu._transitionTo(name) when they need to navigate.
 * Screens use menu.reg(obj) to register display objects.
 */
export default class PauseMenu extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene, 0, 0);
    this.name = 'PauseMenu';

    /** Shared Pokedex instance — created lazily, reused by all screens. */
    this.dex = null;

    // Bind reg so screens can safely destructure it without losing `this`
    this.reg = this.reg.bind(this);

    this._selectedIndex = 0;
    this._currentScreen = null; // null = main menu visible

    // ── Sub-screens ────────────────────────────────────────────────────
    this.teamScreen    = new TeamScreen(this);
    this.teamDetail    = new TeamDetail(this);
    this.pokedexScreen = new PokedexScreen(this);
    this.bagScreen     = new BagScreen(this);
    this.userScreen    = new UserScreen(this);

    // ── Persistent UI ──────────────────────────────────────────────────
    this._mainBg     = null;
    this._cursorText = null;
    this._mainTexts  = [];
    this._subBg      = null;
    this._subTexts   = [];

    this._buildMainPanel();
    this._buildSubPanel();

    this.setDepth(MENU_DEPTH);
    this.setVisible(false);
    scene.add.existing(this);
  }

  // ─── Display object registration ─────────────────────────────────────────

  /** Add a display object to the container and the sub-text cleanup list. */
  reg(obj) {
    this.add(obj);
    this._subTexts.push(obj);
    return obj;
  }

  // ─── Panel builders ──────────────────────────────────────────────────────

  _buildMainPanel() {
    const labels  = MENU_LABELS.map(l => l ?? gameState.playerName.toUpperCase());
    const panelH  = labels.length * ITEM_H + PAD * 2;

    this._mainBg = this.scene.add.graphics();
    this._mainBg.fillStyle(0xf8f8f8, 1);
    this._mainBg.fillRect(MX, MY, MW, panelH);
    this._mainBg.lineStyle(3, 0x181818, 1);
    this._mainBg.strokeRect(MX, MY, MW, panelH);
    this.add(this._mainBg);

    this._cursorText = this.scene.add.text(MX + PAD, MY + PAD, '▶', TEXT_STYLE);
    this.add(this._cursorText);

    labels.forEach((label, i) => {
      const t = this.scene.add.text(MX + PAD + 18, MY + PAD + i * ITEM_H, label, TEXT_STYLE);
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
    this._subBg.setAlpha(1);
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

  // ─── Screen transitions ──────────────────────────────────────────────────

  /**
   * Called by sub-screens to trigger a navigation change.
   * Also used by showSubScreen() from OverworldUI.
   */
  _transitionTo(name) {
    this._currentScreen = name;
    this._clearSubTexts();
    this._subBg.setAlpha(1);

    switch (name) {
      case 'team':
        this.teamScreen.rebuild();
        break;
      case 'team-submenu':
        this.teamScreen.buildWithSubMenu();
        break;
      case 'team-detail':
        this.teamDetail.build(this.teamScreen.subMenuSlot);
        break;
      case 'pokedex':
        this.pokedexScreen.rebuild();
        break;
      case 'bag':
        this.bagScreen.build();
        break;
      case 'user':
        this.userScreen.build();
        break;
      default:
        this._buildPlaceholderScreen(name);
        break;
    }
  }

  _buildPlaceholderScreen(name) {
    this.reg(this.scene.add.text(SX + 16, SY + 16, name.toUpperCase(), TEXT_STYLE_BOLD));
    this.reg(this.scene.add.text(SX + 16, SY + 52, 'Not yet implemented.', TEXT_STYLE_BODY));
    this.reg(this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }

  // ─── Public API ──────────────────────────────────────────────────────────

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
    switch (this._currentScreen) {
      case 'team':        this.teamScreen.nav('up');      return;
      case 'team-submenu':this.teamScreen.subMenuNav(-1); return;
      case 'team-detail': this.teamDetail.nav(-1);        return;
      case 'pokedex':     this.pokedexScreen.nav(-1);     return;
      case null: break;
      default: return;
    }
    this._selectedIndex = (this._selectedIndex - 1 + MENU_KEYS.length) % MENU_KEYS.length;
    this._updateCursor();
  }

  moveDown() {
    switch (this._currentScreen) {
      case 'team':        this.teamScreen.nav('down');   return;
      case 'team-submenu':this.teamScreen.subMenuNav(1); return;
      case 'team-detail': this.teamDetail.nav(1);        return;
      case 'pokedex':     this.pokedexScreen.nav(1);     return;
      case null: break;
      default: return;
    }
    this._selectedIndex = (this._selectedIndex + 1) % MENU_KEYS.length;
    this._updateCursor();
  }

  moveLeft() {
    if (this._currentScreen === 'team')        this.teamScreen.nav('left');
    if (this._currentScreen === 'team-detail') this.teamDetail.tabNav(-1);
    if (this._currentScreen === 'pokedex')     this.pokedexScreen.tabNav(-1);
  }

  moveRight() {
    if (this._currentScreen === 'team')        this.teamScreen.nav('right');
    if (this._currentScreen === 'team-detail') this.teamDetail.tabNav(1);
    if (this._currentScreen === 'pokedex')     this.pokedexScreen.tabNav(1);
  }

  /**
   * Returns the selected main-menu option key, or null when a sub-screen handles it.
   * @return {string|null}
   */
  confirm() {
    switch (this._currentScreen) {
      case 'team':         this.teamScreen.confirm();        return null;
      case 'team-submenu': this.teamScreen.subMenuConfirm(); return null;
      case null:           return MENU_KEYS[this._selectedIndex];
      default:             return null;
    }
  }

  /**
   * Navigate back one level.
   * @return {boolean} true if the whole menu was closed
   */
  back() {
    switch (this._currentScreen) {
      case 'team':
        if (this.teamScreen.selected !== null) {
          this.teamScreen.selected = null;
          this.teamScreen.rebuild();
          return false;
        }
        break;
      case 'team-submenu':
      case 'team-detail':
        this.teamScreen.subMenuSlot = null;
        this._transitionTo('team');
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

  /** Called by OverworldUI when a main-menu item is confirmed. */
  showSubScreen(type) {
    if (type === 'team')    this.teamScreen.reset();
    if (type === 'pokedex') this.pokedexScreen.reset();
    this._showSubPanel();
    this._transitionTo(type);
  }
}
