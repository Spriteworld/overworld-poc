const CHAR_DELAY  = 30;   // ms per character
const CLOSE_DELAY = 500;  // ms after Z before textbox-disable fires
const BORDER_R    = 20;   // border radius
const PAD_X       = 16;   // horizontal inner padding
const PAD_Y       = 14;   // vertical inner padding
const DEPTH       = Number.MAX_SAFE_INTEGER - 10;

class TextBox {
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
      wordWrap:    { width: ww, useAdvancedWrap: true },
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

    // Keyboard: skip or advance
    this._keyHandler = () => {
      if (this._typing) {
        this._skipTyping();
      } else if (!this._isLastPage()) {
        this._typeNextPage();
      }
    };
    scene.input.keyboard.on('keydown-Z', this._keyHandler);

    // Hidden by default
    this._setChildrenVisible(false);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  start(text) {
    this._cancelPending();
    this._pages   = this._paginate(text);
    this._pageIdx = 0;
    this._typeCurrentPage();
  }

  setVisible(visible) {
    this._setChildrenVisible(visible);
    if (!visible) {
      this._cancelPending();
      this._typing = false;
      this._arrow.setVisible(false);
    }
  }

  destroy() {
    this._cancelPending();
    this._scene.input.keyboard.off('keydown-Z', this._keyHandler);
    this._bg.destroy();
    this._textObj.destroy();
    this._arrow.destroy();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _drawBg() {
    this._bg.clear();
    this._bg.fillStyle(0x000000, 1);
    this._bg.fillRoundedRect(this._bx, this._by, this._boxW, this._boxH, BORDER_R);
    this._bg.lineStyle(2, 0xffffff, 1);
    this._bg.strokeRoundedRect(this._bx, this._by, this._boxW, this._boxH, BORDER_R);
  }

  _setChildrenVisible(v) {
    this._bg.setVisible(v);
    this._textObj.setVisible(v);
    if (!v) this._arrow.setVisible(false);
  }

  /**
   * Split `text` into pages of at most 2 wrapped lines each.
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

  _typeCurrentPage() {
    this._fullText = this._pages[this._pageIdx];
    this._charIdx  = 0;
    this._typing   = true;
    this._arrow.setVisible(false);
    this._textObj.setText('');

    if (this._timer) { this._timer.remove(); this._timer = null; }

    this._timer = this._scene.time.addEvent({
      delay:    CHAR_DELAY,
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

  _skipTyping() {
    if (this._timer) { this._timer.remove(); this._timer = null; }
    this._textObj.setText(this._fullText);
    this._charIdx = this._fullText.length;
    this._typing  = false;
    this._onComplete();
  }

  _typeNextPage() {
    this._pageIdx++;
    this._typeCurrentPage();
  }

  _isLastPage() {
    return this._pageIdx >= this._pages.length - 1;
  }

  _onComplete() {
    this._typing = false;
    this._arrow.setVisible(true);

    if (this._isLastPage()) {
      // Register a one-shot close listener
      this._closeOnce = () => {
        this._closeOnce = null;
        this._scene.time.delayedCall(CLOSE_DELAY, () => {
          this._scene.game.events.emit('textbox-disable');
        });
      };
      this._scene.input.keyboard.once('keydown-Z', this._closeOnce);
    }
  }

  _cancelPending() {
    if (this._timer)     { this._timer.remove(); this._timer = null; }
    if (this._closeOnce) {
      this._scene.input.keyboard.off('keydown-Z', this._closeOnce);
      this._closeOnce = null;
    }
  }
}

var textBox = function (scene, x, y, config) {
  return new TextBox(scene, config || {});
};

export { textBox };
