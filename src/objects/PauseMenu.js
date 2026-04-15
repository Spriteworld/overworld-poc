import Phaser from 'phaser';
import { gameState } from '@Data/gameState.js';
import {
  MX, MY, MW, ITEM_H, PAD,
  SX, SY, SW, SH,
  TEXT_STYLE, TEXT_STYLE_BODY, TEXT_STYLE_BOLD, TEXT_STYLE_HINT,
} from './menus/layout.js';
import TeamScreen        from './menus/TeamScreen.js';
import TeamDetail        from './menus/TeamDetail.js';
import PokedexScreen     from './menus/PokedexScreen.js';
import BagScreen         from './menus/BagScreen.js';
import BagTeamPickScreen from './menus/BagTeamPickScreen.js';
import UserScreen        from './menus/UserScreen.js';
import OptionScreen      from './menus/OptionScreen.js';
import DebugScreen       from './menus/DebugScreen.js';


const MENU_DEPTH = Number.MAX_SAFE_INTEGER - 100;

const MENU_KEYS   = ['pokedex', 'team', 'bag', 'user', 'option', 'save', 'debug', 'close'];
const MENU_LABELS = ['POKÉDEX', 'POKÉMON', 'BAG', null /* playerName */, 'OPTION', 'SAVE', 'DEBUG', 'CLOSE'];

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
    this.teamScreen        = new TeamScreen(this);
    this.teamDetail        = new TeamDetail(this);
    this.pokedexScreen     = new PokedexScreen(this);
    this.bagScreen         = new BagScreen(this);
    this.bagTeamPickScreen = new BagTeamPickScreen(this);
    this.userScreen        = new UserScreen(this);
    this.optionScreen      = new OptionScreen(this);
    this.debugScreen       = new DebugScreen(this);

    /** Set by BagScreen.confirm() before transitioning to bag-team-pick. */
    this.pendingUseItem = null;

    // ── Persistent UI ──────────────────────────────────────────────────
    this._mainBg     = null;
    this._cursorText = null;
    this._mainTexts  = [];
    this._subBg      = null;
    this._subTexts   = [];

    this._rebuildMainPanel();
    this._buildSubPanel();

    this.setDepth(MENU_DEPTH);
    this.setVisible(false);
    scene.add.existing(this);
  }

  // ─── Display object registration ─────────────────────────────────────────

  /**
   * Add a display object to the container and track it for sub-screen cleanup.
   * @param {Phaser.GameObjects.GameObject} obj - The object to register.
   * @returns {Phaser.GameObjects.GameObject} The same object, for chaining.
   */
  reg(obj) {
    this.add(obj);
    this._subTexts.push(obj);
    return obj;
  }

  // ─── Panel builders ──────────────────────────────────────────────────────

  /** Returns the subset of menu items visible given current game flags and build env. */
  _activeItems() {
    const flags = this.scene.game.config.gameFlags ?? {};
    return MENU_KEYS
      .map((key, i) => ({ key, label: MENU_LABELS[i] ?? gameState.game.playerName.toUpperCase() }))
      .filter(({ key }) => {
        if (key === 'pokedex') return !!flags.has_pokedex;
        if (key === 'debug')   return !!import.meta.env.VITE_DEBUG;
        return true;
      });
  }

  /** Destroys any existing main-panel objects and rebuilds from current game flags. */
  _rebuildMainPanel() {
    this._mainBg?.destroy();
    this._cursorText?.destroy();
    this._mainTexts.forEach(t => t.destroy());
    this._mainTexts = [];

    const items  = this._activeItems();
    const panelH = items.length * ITEM_H + PAD * 2;

    this._mainBg = this.scene.add.graphics();
    this._mainBg.fillStyle(0xf8f8f8, 1);
    this._mainBg.fillRect(MX, MY, MW, panelH);
    this._mainBg.lineStyle(3, 0x181818, 1);
    this._mainBg.strokeRect(MX, MY, MW, panelH);
    this.add(this._mainBg);

    this._cursorText = this.scene.add.text(MX + PAD, MY + PAD, '▶', TEXT_STYLE);
    this.add(this._cursorText);

    items.forEach(({ label }, i) => {
      const t = this.scene.add.text(MX + PAD + 18, MY + PAD + i * ITEM_H, label, TEXT_STYLE);
      this.add(t);
      this._mainTexts.push(t);
    });
  }

  /** Builds the blank sub-panel background that sub-screens render inside. */
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

  /** Reveal the main item list and hide the sub-panel. */
  _showMainPanel() {
    this._mainBg.setVisible(true);
    this._cursorText.setVisible(true);
    this._mainTexts.forEach(t => t.setVisible(true));
    this._subBg.setAlpha(1);
    this._subBg.setVisible(false);
    this._clearSubTexts();
    this._updateCursor();
  }

  /** Hide the main item list and reveal the sub-panel. */
  _showSubPanel() {
    this._mainBg.setVisible(false);
    this._cursorText.setVisible(false);
    this._mainTexts.forEach(t => t.setVisible(false));
    this._subBg.setVisible(true);
  }

  /** Destroy and reset all sub-screen display objects. */
  _clearSubTexts() {
    this._subTexts.forEach(t => t.destroy());
    this._subTexts = [];
  }

  /** Move the cursor arrow to the row matching the current selected index. */
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
        this.bagScreen.show();
        break;
      case 'bag-team-pick':
        this.bagTeamPickScreen.cursor = 0;
        this.bagTeamPickScreen.build();
        break;
      case 'user':
        this.userScreen.build();
        break;
      case 'option':
        this.optionScreen.show();
        break;
      case 'debug':
        this.debugScreen.build();
        break;
      default:
        this._buildPlaceholderScreen(name);
        break;
    }
  }

  /**
   * Render a "not yet implemented" placeholder for screens without a real class.
   * @param {string} name - The screen name to display in the heading.
   */
  _buildPlaceholderScreen(name) {
    this.reg(this.scene.add.text(SX + 16, SY + 16, name.toUpperCase(), TEXT_STYLE_BOLD));
    this.reg(this.scene.add.text(SX + 16, SY + 52, 'Not yet implemented.', TEXT_STYLE_BODY));
    this.reg(this.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Open the pause menu, resetting selection to the top and showing the main panel.
   */
  open() {
    this._selectedIndex = 0;
    this._currentScreen = null;
    this._clearSubTexts();
    this._rebuildMainPanel();
    this._showMainPanel();
    this.setVisible(true);
  }

  /** Close the pause menu, hide all display objects, and re-enable player input. */
  close() {
    this._clearSubTexts();
    this._currentScreen = null;
    this.setVisible(false);
    this.scene.registry.set('player_input', true);
  }

  /** Navigate up in the current screen or main menu. */
  moveUp() {
    switch (this._currentScreen) {
      case 'team':        this.teamScreen.nav('up');      return;
      case 'team-submenu':this.teamScreen.subMenuNav(-1); return;
      case 'team-detail': this.teamDetail.nav(-1);        return;
      case 'pokedex':     this.pokedexScreen.nav(-1);     return;
      case 'bag':         this.bagScreen.nav(-1);             return;
      case 'bag-team-pick': this.bagTeamPickScreen.nav(-1);  return;
      case 'option':      this.optionScreen.nav(-1);         return;
      case 'debug':       this.debugScreen.nav(-1);          return;
      case null: break;
      default: return;
    }
    const len = this._activeItems().length;
    this._selectedIndex = (this._selectedIndex - 1 + len) % len;
    this._updateCursor();
  }

  /** Navigate down in the current screen or main menu. */
  moveDown() {
    switch (this._currentScreen) {
      case 'team':        this.teamScreen.nav('down');   return;
      case 'team-submenu':this.teamScreen.subMenuNav(1); return;
      case 'team-detail': this.teamDetail.nav(1);        return;
      case 'pokedex':     this.pokedexScreen.nav(1);     return;
      case 'bag':         this.bagScreen.nav(1);              return;
      case 'bag-team-pick': this.bagTeamPickScreen.nav(1);   return;
      case 'option':      this.optionScreen.nav(1);          return;
      case 'debug':       this.debugScreen.nav(1);           return;
      case null: break;
      default: return;
    }
    this._selectedIndex = (this._selectedIndex + 1) % this._activeItems().length;
    this._updateCursor();
  }

  /** Navigate left (tab/slot change) in screens that support it. */
  moveLeft() {
    if (this._currentScreen === 'team') {
      this.teamScreen.nav('left');
    }
    if (this._currentScreen === 'team-detail') {
      this.teamDetail.tabNav(-1);
    }
    if (this._currentScreen === 'pokedex') {
      this.pokedexScreen.tabNav(-1);
    }
    if (this._currentScreen === 'bag') {
      this.bagScreen.tabNav(-1);
    }
    if (this._currentScreen === 'option') {
      this.optionScreen.cycle(-1);
    }
    if (this._currentScreen === 'debug') {
      this.debugScreen.tabNav(-1);
    }
  }

  /** Navigate right (tab/slot change) in screens that support it. */
  moveRight() {
    if (this._currentScreen === 'team') {
      this.teamScreen.nav('right');
    }
    if (this._currentScreen === 'team-detail') {
      this.teamDetail.tabNav(1);
    }
    if (this._currentScreen === 'pokedex') {
      this.pokedexScreen.tabNav(1);
    }
    if (this._currentScreen === 'bag') {
      this.bagScreen.tabNav(1);
    }
    if (this._currentScreen === 'option') {
      this.optionScreen.cycle(1);
    }
    if (this._currentScreen === 'debug') {
      this.debugScreen.tabNav(1);
    }
  }

  /**
   * Returns the selected main-menu option key, or null when a sub-screen handles it.
   * @return {string|null}
   */
  confirm() {
    switch (this._currentScreen) {
      case 'team':           this.teamScreen.confirm();          return null;
      case 'team-submenu':   this.teamScreen.subMenuConfirm();   return null;
      case 'bag':            this.bagScreen.confirm();           return null;
      case 'bag-team-pick':  this.bagTeamPickScreen.confirm();   return null;
      case 'option':         this.optionScreen.confirm();        return null;
      case 'debug':          this.debugScreen.confirm();         return null;
      case null:             return this._activeItems()[this._selectedIndex].key;
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
      case 'bag':
        if (this.bagScreen.back()) return false; // consumed by submenu
        break;
      case 'bag-team-pick':
        this.pendingUseItem = null;
        this._transitionTo('bag');
        return false;
      case 'debug':
        if (this.debugScreen._dirty) {
          this.close();
          this.debugScreen._reloadMap();
          return true;
        }
        break;
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
