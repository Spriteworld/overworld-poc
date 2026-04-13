import store from '../../store/index.js';
import { stopSfx, resumeBgm } from '@Utilities/AudioManager.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const SPRITES = ['red', 'leaf', 'brendan', 'may'];
const SPRITE_LABELS = { red: 'Male (Red)', leaf: 'Female (Leaf)', brendan: 'Male (Brendan)', may: 'Female (May)' };

const TEXT_SPEEDS = ['normal', 'fast', 'instant'];
const TEXT_SPEED_LABELS = { normal: 'Normal', fast: 'Fast', instant: 'Instant' };

const OPTIONS = [
  { key: 'character',  label: 'Character'  },
  { key: 'textSpeed',  label: 'Text Speed' },
  { key: 'bgmVolume',  label: 'BGM Vol'    },
  { key: 'sfxVolume',  label: 'SFX Vol'    },
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
      const isCursor  = i === this._cursor;
      const prefix    = isCursor ? '▶ ' : '  ';
      const rowY      = LIST_Y + i * ROW_H;
      const labelText = scene.add.text(SX + 16, rowY, prefix + label, TEXT_STYLE_BODY);
      reg(labelText);

      if (key === 'character') {
        const spriteKey = store.state.game.playerSprite;
        if (scene.textures.exists(spriteKey)) {
          const spriteScale = 0.5;
          const cropH       = 32;
          const spriteH     = cropH * spriteScale;
          const head = scene.add.sprite(
            SX + 16 + labelText.width + 4,
            rowY + (ROW_H - spriteH) / 2 - 5,
            spriteKey, 0
          );
          head.setCrop(0, 0, 32, cropH);
          head.setScale(spriteScale);
          head.setOrigin(0, 0);
          reg(head);
        }
      }

      const value = this._getValue(key);
      reg(scene.add.text(VAL_X, rowY, '◀ ' + value + ' ▶', TEXT_STYLE_BODY)).setOrigin(1, 0);
    });

    reg(scene.add.text(SX + 16, SY + SH - 22, '▲▼ select   ◀▶ change   X  back', TEXT_STYLE_HINT));
  }

  _getValue(key) {
    if (key === 'character') {
      return SPRITE_LABELS[store.state.game.playerSprite] ?? store.state.game.playerSprite;
    }
    if (key === 'textSpeed') {
      return TEXT_SPEED_LABELS[store.state.game.textSpeed] ?? store.state.game.textSpeed;
    }
    if (key === 'bgmVolume') {
      const v = store.state.game.bgmVolume;
      return '█'.repeat(v) + '░'.repeat(20 - v);
    }
    if (key === 'sfxVolume') {
      const v = store.state.game.sfxVolume;
      return '█'.repeat(v) + '░'.repeat(20 - v);
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
    } else if (key === 'textSpeed') {
      const idx  = TEXT_SPEEDS.indexOf(store.state.game.textSpeed);
      const next = TEXT_SPEEDS[(idx + delta + TEXT_SPEEDS.length) % TEXT_SPEEDS.length];
      store.commit('game/SET_TEXT_SPEED', next);
    } else if (key === 'bgmVolume') {
      const prev = store.state.game.bgmVolume;
      const next = Math.min(20, Math.max(0, prev + delta));
      store.commit('game/SET_BGM_VOLUME', next);
      this.menu.scene.game.events.emit('bgm-volume-change', next);
      if (prev === 0 && next > 0) resumeBgm(this.menu.scene);
    } else if (key === 'sfxVolume') {
      const next = Math.min(20, Math.max(0, store.state.game.sfxVolume + delta));
      store.commit('game/SET_SFX_VOLUME', next);
      if (next === 0) stopSfx(this.menu.scene);
    }
    this.menu._clearSubTexts();
    this.build();
  }

  /** Z confirm — same as cycling right. */
  confirm() {
    this.cycle(1);
  }
}
