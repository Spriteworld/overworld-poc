import store from '../../store/index.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const SPRITES = ['red', 'leaf'];
const SPRITE_LABELS = { red: 'Male (Red)', leaf: 'Female (Leaf)' };

const OPTIONS = [
  { key: 'character', label: 'Character' },
];

const ROW_H   = 28;
const LIST_Y  = SY + 52;
const VAL_X   = SX + SW - 16;

export default class OptionScreen {
  constructor(menu) {
    this.menu    = menu;
    this._cursor = 0;
  }

  show() {
    this._cursor = 0;
    this.build();
  }

  build() {
    const { scene, reg } = this.menu;

    reg(scene.add.text(SX + 16, SY + 4, 'OPTIONS', TEXT_STYLE_BOLD));

    const sep = scene.add.graphics();
    sep.lineStyle(1, 0xaaaaaa);
    sep.lineBetween(SX + 8, LIST_Y - 8, SX + SW - 8, LIST_Y - 8);
    reg(sep);

    OPTIONS.forEach(({ key, label }, i) => {
      const isCursor = i === this._cursor;
      const prefix   = isCursor ? '▶ ' : '  ';
      reg(scene.add.text(SX + 16, LIST_Y + i * ROW_H, prefix + label, TEXT_STYLE_BODY));

      const value = this._getValue(key);
      reg(scene.add.text(VAL_X, LIST_Y + i * ROW_H, '◀ ' + value + ' ▶', TEXT_STYLE_BODY)).setOrigin(1, 0);
    });

    reg(scene.add.text(SX + 16, SY + SH - 22, '▲▼ select   ◀▶ change   X  back', TEXT_STYLE_HINT));
  }

  _getValue(key) {
    if (key === 'character') {
      return SPRITE_LABELS[store.state.game.playerSprite] ?? store.state.game.playerSprite;
    }
    return '';
  }

  nav(delta) {
    this._cursor = (this._cursor + delta + OPTIONS.length) % OPTIONS.length;
    this.menu._clearSubTexts();
    this.build();
  }

  /** Cycle the focused option's value (left = -1, right = +1). */
  cycle(delta) {
    const { key } = OPTIONS[this._cursor];
    if (key === 'character') {
      const idx  = SPRITES.indexOf(store.state.game.playerSprite);
      const next = SPRITES[(idx + delta + SPRITES.length) % SPRITES.length];
      store.commit('game/SET_PLAYER_SPRITE', next);
      this.menu.scene.game.events.emit('player-sprite-change', next);
    }
    this.menu._clearSubTexts();
    this.build();
  }

  /** Z confirm — same as cycling right. */
  confirm() {
    this.cycle(1);
  }
}
