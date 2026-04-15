import { getInputManager, getKeybindLabel } from './InputManager.js';
import store from '../store/index.js';
import { Pokedex, GAMES } from '@spriteworld/pokemon-data';
import { getGameDef } from '../data/gameDef.js';

// Lazily-built nat_dex_id → species name map shared across all TextBox instances.
let _speciesMap = null;
function getSpeciesName(natDexId) {
  if (!_speciesMap) {
    const dex = new Pokedex(GAMES.POKEMON_FIRE_RED);
    _speciesMap = {};
    for (const p of Object.values(dex.pokedex)) {
      if (p.nat_dex_id != null) _speciesMap[p.nat_dex_id] = p.species;
    }
  }
  return _speciesMap[Number(natDexId)] ?? `#${natDexId}`;
}

const CHAR_DELAY  = { normal: 30, fast: 10, instant: 0 }; // ms per character per speed
const CLOSE_DELAY = 500;  // ms after Z before textbox-disable fires
const BORDER_R    = 20;   // border radius
const PAD_X       = 16;   // horizontal inner padding
const PAD_Y       = 14;   // vertical inner padding
const DEPTH       = Number.MAX_SAFE_INTEGER - 10;

class TextBox {
  /**
   * @param {Phaser.Scene} scene - The Phaser scene this textbox belongs to.
   * @param {object} config - Configuration options.
   * @param {number} [config.fixedWidth=500] - Inner text area width in pixels.
   * @param {number} [config.fixedHeight=65] - Inner text area height in pixels.
   * @param {number} [config.wrapWidth] - Word-wrap width; defaults to fixedWidth.
   */
  constructor(scene, config) {
    this._scene = scene;

    const FW = config.fixedWidth  || 500;
    const FH = config.fixedHeight || 65;
    const ww = config.wrapWidth   || FW;

    const boxW = FW + PAD_X * 2;
    const boxH = FH + PAD_Y * 2;
    const bx   = Math.floor((scene.scale.width  - boxW) / 2);
    const by   = scene.scale.height - boxH - 20;

    this._bx   = bx;
    this._by   = by;
    this._boxW = boxW;
    this._boxH = boxH;

    // Background
    this._bg = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this._drawBg();

    // Text
    this._textObj = scene.add.text(bx + PAD_X, by + PAD_Y, '', {
      fontSize:    '20px',
      color:       '#ffffff',
      wordWrap:    { width: ww, useAdvancedWrap: false },
      maxLines:    2,
    })
      .setScrollFactor(0)
      .setDepth(DEPTH + 1)
      .setFixedSize(FW, FH);

    // "next page / done" indicator
    this._arrow = scene.add.text(
      bx + boxW - PAD_X - 4,
      by + boxH - PAD_Y - 2,
      '▼',
      { fontSize: '14px', color: '#c8a060' }
    )
      .setScrollFactor(0)
      .setDepth(DEPTH + 2)
      .setOrigin(1, 1)
      .setVisible(false);

    // State
    this._pages       = [];
    this._pageIdx     = 0;
    this._fullText    = '';
    this._charIdx     = 0;
    this._typing      = false;
    this._timer       = null;
    this._closeOnce   = null; // pending once('keydown-Z') for close

    // Input: skip or advance (driven by InputManager so mobile controls work too)
    this._keyHandler = () => {
      if (this._typing) {
        this._skipTyping();
      } else if (!this._isLastPage()) {
        this._typeNextPage();
      }
    };
    getInputManager()?.on('confirm', this._keyHandler);
    getInputManager()?.on('cancel',  this._keyHandler);

    // Hidden by default
    this._setChildrenVisible(false);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Begin displaying text, splitting it into pages and typing out the first page.
   * Accepts a plain string or an array of strings joined with newlines.
   * @param {string|string[]} text - The text to display.
   */
  start(text) {
    this._cancelPending();
    const raw = Array.isArray(text) ? text.join('\n') : text;

    const starters = getGameDef()?.starterMon;
    const str = raw
      .replace(/\{e\}/g, 'é')
      .replace(/\{E\}/g, 'É')
      .replace(/\{player\}/gi, store.state.game.playerName)
      .replace(/\{rival\}/gi, store.state.game.rivalName)
      .replace(/\{species:(\d+)\}/gi, (_, id) => getSpeciesName(id)?.toUpperCase())
      .replace(/\{starter:(\d+)\}/gi, (_, id) => getSpeciesName(starters?.[id])?.toUpperCase())
      .replace(/\{KEYBIND\.([^}]+)\}/gi, (_, action) => getKeybindLabel(action.toLowerCase()));
    this._pages   = this._paginate(str);
    this._pageIdx = 0;
    this._typeCurrentPage();
  }

  /**
   * Show or hide the textbox and all its child objects.
   * Hiding also cancels any in-progress typing or close timers.
   * @param {boolean} visible - Whether the textbox should be visible.
   */
  setVisible(visible) {
    this._setChildrenVisible(visible);
    if (!visible) {
      this._cancelPending();
      this._typing = false;
      this._arrow.setVisible(false);
    }
  }

  /**
   * Remove all textbox game objects and detach keyboard listeners.
   * Call this when the scene shuts down.
   */
  destroy() {
    this._cancelPending();
    getInputManager()?.off('confirm', this._keyHandler);
    getInputManager()?.off('cancel',  this._keyHandler);
    this._bg.destroy();
    this._textObj.destroy();
    this._arrow.destroy();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Redraws the rounded-rectangle background graphic.
   */
  _drawBg() {
    this._bg.clear();
    this._bg.fillStyle(0x000000, 1);
    this._bg.fillRoundedRect(this._bx, this._by, this._boxW, this._boxH, BORDER_R);
    this._bg.lineStyle(2, 0xffffff, 1);
    this._bg.strokeRoundedRect(this._bx, this._by, this._boxW, this._boxH, BORDER_R);
  }

  /**
   * Set visibility on background, text, and arrow objects.
   * The arrow is always hidden when visibility is false.
   * @param {boolean} v - Desired visibility state.
   */
  _setChildrenVisible(v) {
    this._bg.setVisible(v);
    this._textObj.setVisible(v);
    if (!v) {
      this._arrow.setVisible(false);
    }
  }

  /**
   * Split `text` into pages of at most 2 wrapped lines each.
   * @param {string} text - Raw text to paginate.
   * @returns {string[]} Array of page strings, one entry per two-line page.
   */
  _paginate(text) {
    const lines = [];
    for (const para of text.split('\n')) {
      const wrapped = this._textObj.getWrappedText(para);
      if (wrapped.length === 0) {
        lines.push('');
      } else {
        lines.push(...wrapped);
      }
    }
    const pages = [];
    for (let i = 0; i < lines.length; i += 2) {
      pages.push(lines.slice(i, i + 2).join('\n'));
    }
    return pages.length ? pages : [''];
  }

  /**
   * Begin character-by-character typing of the current page.
   * Resets the timer and clears existing text before starting.
   */
  _typeCurrentPage() {
    this._fullText = this._pages[this._pageIdx];
    this._charIdx  = 0;
    this._typing   = true;
    this._arrow.setVisible(false);
    this._textObj.setText('');

    if (this._timer) {
      this._timer.remove();
      this._timer = null;
    }

    const speed = store.state.game.textSpeed ?? 'normal';
    const delay = CHAR_DELAY[speed] ?? CHAR_DELAY.normal;

    if (delay === 0) {
      // Instant — reveal the whole page immediately.
      this._skipTyping();
      return;
    }

    this._timer = this._scene.time.addEvent({
      delay,
      repeat:   this._fullText.length - 1,
      callback: () => {
        this._charIdx++;
        this._textObj.setText(this._fullText.slice(0, this._charIdx));
        if (this._charIdx >= this._fullText.length) {
          this._onComplete();
        }
      },
    });
  }

  /**
   * Immediately reveal the full current page, skipping the typing animation.
   */
  _skipTyping() {
    if (this._timer) {
      this._timer.remove();
      this._timer = null;
    }
    this._textObj.setText(this._fullText);
    this._charIdx = this._fullText.length;
    this._typing  = false;
    this._onComplete();
  }

  /**
   * Advance to the next page and begin typing it.
   */
  _typeNextPage() {
    this._cancelPending();
    this._pageIdx++;
    this._typeCurrentPage();
  }

  /**
   * Returns true when the current page is the last one.
   * @returns {boolean}
   */
  _isLastPage() {
    return this._pageIdx >= this._pages.length - 1;
  }

  /**
   * Called when a page finishes typing. Shows the arrow indicator and,
   * on the last page, registers a one-shot Z listener to close the textbox.
   */
  _onComplete() {
    this._typing = false;
    this._arrow.setVisible(true);

    if (this._isLastPage()) {
      // Allow external code (e.g. yes_no script command) to intercept and suppress
      // the auto-close by emitting 'textbox-intercept' synchronously in response
      // to 'textbox-ready'.
      this._intercepted = false;
      const interceptHandler = () => { this._intercepted = true; };
      this._scene.game.events.once('textbox-intercept', interceptHandler);
      this._scene.game.events.emit('textbox-ready');
      // Clean up the intercept listener if nobody used it.
      this._scene.game.events.off('textbox-intercept', interceptHandler);
      if (this._intercepted) return;

      // Register a one-shot close listener on both confirm and cancel
      this._closeOnce = () => {
        const im = getInputManager();
        im?.off('confirm', this._closeOnce);
        im?.off('cancel',  this._closeOnce);
        this._closeOnce = null;
        this._scene.time.delayedCall(CLOSE_DELAY, () => {
          this._scene.game.events.emit('textbox-disable');
        });
      };
      const im = getInputManager();
      im?.on('confirm', this._closeOnce);
      im?.on('cancel',  this._closeOnce);
    }
  }

  /**
   * Cancel any in-flight typing timer and pending close listener.
   */
  _cancelPending() {
    if (this._timer) {
      this._timer.remove();
      this._timer = null;
    }
    if (this._closeOnce) {
      const im = getInputManager();
      im?.off('confirm', this._closeOnce);
      im?.off('cancel',  this._closeOnce);
      this._closeOnce = null;
    }
  }
}

var textBox = function (scene, x, y, config) {
  return new TextBox(scene, config || {});
};

export { textBox };
