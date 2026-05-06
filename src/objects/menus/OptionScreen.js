import store from '../../store/index.js';
import { stopSfx, resumeBgm } from '@Utilities/AudioManager.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';
import { WINDOW_STYLES, WINDOW_STYLE_KEYS } from '../common/windowStyles.js';

const SPRITES = ['red', 'leaf', 'brendan', 'may'];
const SPRITE_LABELS = { red: 'Male (Red)', leaf: 'Female (Leaf)', brendan: 'Male (Brendan)', may: 'Female (May)' };

const TEXT_SPEEDS = ['normal', 'fast', 'instant'];
const TEXT_SPEED_LABELS = { normal: 'Normal', fast: 'Fast', instant: 'Instant' };

const UI_SCALES = [0.50, 0.60, 0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50];

const GROUPS = [
  {
    label: 'Game',
    options: [
      { key: 'character',       label: 'Character'        },
      { key: 'textSpeed',       label: 'Text Speed'       },
      { key: 'followerPokemon', label: 'Follower Pokémon'  },
      { key: 'alwaysRun',       label: 'Always Run',       requires: 'has_running_shoes' },
      { key: 'autoSurf',        label: 'Auto Surf',        requires: 'has_surf' },
    ],
  },
  {
    label: 'Graphics & Sound',
    options: [
      { key: 'bgmVolume',    label: 'BGM Vol'  },
      { key: 'sfxVolume',    label: 'SFX Vol'  },
      { key: 'uiScale',     label: 'UI Scale' },
    ],
  },
];

const ROW_H   = 28;
const LIST_Y  = SY + 36;
const VAL_X   = SX + SW - 16;
const GROUP_HEADER_H = 24;
const GROUP_GAP      = 10;

export default class OptionScreen {
  constructor(menu) {
    this.menu    = menu;
    this._cursor = 0;
  }

  show() {
    this._cursor = 0;
    this.build();
  }

  _visibleOptions() {
    const flags = store.state.game.gameFlags ?? {};
    const flat = [];
    for (const group of GROUPS) {
      for (const o of group.options) {
        if (!o.requires || flags[o.requires]) flat.push(o);
      }
    }
    return flat;
  }

  _layout() {
    const flags = store.state.game.gameFlags ?? {};
    const rows = [];
    let y = LIST_Y;
    GROUPS.forEach((group, gi) => {
      if (gi > 0) {
        rows.push({ type: 'sep', y: y + GROUP_GAP / 2 });
        y += GROUP_GAP;
      }
      rows.push({ type: 'header', label: group.label, y });
      y += GROUP_HEADER_H;
      for (const o of group.options) {
        if (o.requires && !flags[o.requires]) continue;
        rows.push({ type: 'option', ...o, y });
        y += ROW_H;
      }
    });
    return rows;
  }

  build() {
    const { scene, reg } = this.menu;

    reg(scene.add.text(SX + 16, SY + 4, 'OPTIONS', TEXT_STYLE_BOLD));

    const layout  = this._layout();
    let optionIdx = 0;

    for (const row of layout) {
      if (row.type === 'sep') {
        const g = scene.add.graphics();
        g.lineStyle(1, 0xaaaaaa);
        g.lineBetween(SX + 8, row.y, SX + SW - 8, row.y);
        reg(g);
      } else if (row.type === 'header') {
        reg(scene.add.text(SX + 16, row.y, row.label, { ...TEXT_STYLE_BODY, color: '#888888' }));
      } else {
        const isCursor = optionIdx === this._cursor;
        const prefix   = isCursor ? '▶ ' : '  ';
        const labelText = scene.add.text(SX + 16, row.y, prefix + row.label, TEXT_STYLE_BODY);
        reg(labelText);

        if (row.key === 'character') {
          const spriteKey = store.state.game.playerSprite;
          if (scene.textures.exists(spriteKey)) {
            const spriteScale = 0.5;
            const cropH       = 32;
            const spriteH     = cropH * spriteScale;
            const head = scene.add.sprite(
              SX + 16 + labelText.width + 4,
              row.y + (ROW_H - spriteH) / 2 - 5,
              spriteKey, 0
            );
            head.setCrop(0, 0, 32, cropH);
            head.setScale(spriteScale);
            head.setOrigin(0, 0);
            reg(head);
          }
        }

        const value = this._getValue(row.key);
        reg(scene.add.text(VAL_X, row.y, '◀ ' + value + ' ▶', TEXT_STYLE_BODY)).setOrigin(1, 0);
        optionIdx++;
      }
    }

    reg(scene.add.text(SX + SW - 16, SY + SH - 32,
      '▲▼ select   ◀▶ change   X  back', TEXT_STYLE_HINT)).setOrigin(1, 0);
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
    if (key === 'uiScale') {
      return Math.round(store.state.game.uiScale * 100) + '%';
    }
    if (key === 'windowStyle') {
      return WINDOW_STYLES[store.state.game.windowStyle]?.label ?? 'Default';
    }
    if (key === 'followerPokemon') {
      return store.state.game.gameFlags.follower_pokemon ? 'On' : 'Off';
    }
    if (key === 'alwaysRun') {
      return store.state.game.alwaysRun ? 'On' : 'Off';
    }
    if (key === 'autoSurf') {
      return store.state.game.autoSurf ? 'On' : 'Off';
    }
    return '';
  }

  nav(delta) {
    const len = this._visibleOptions().length;
    this._cursor = (this._cursor + delta + len) % len;
    this.menu._clearSubTexts();
    this.build();
  }

  cycle(delta) {
    const visible = this._visibleOptions();
    const { key } = visible[this._cursor];
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
    } else if (key === 'uiScale') {
      const cur  = store.state.game.uiScale;
      const idx  = UI_SCALES.reduce(
        (best, v, i) => Math.abs(v - cur) < Math.abs(UI_SCALES[best] - cur) ? i : best,
        0,
      );
      const next = UI_SCALES[Math.min(UI_SCALES.length - 1, Math.max(0, idx + delta))];
      store.commit('game/SET_UI_SCALE', next);
      this.menu.scene.game.events.emit('ui-scale-change', next);
    } else if (key === 'windowStyle') {
      const cur = store.state.game.windowStyle;
      const idx = WINDOW_STYLE_KEYS.indexOf(cur);
      const next = WINDOW_STYLE_KEYS[(idx + delta + WINDOW_STYLE_KEYS.length) % WINDOW_STYLE_KEYS.length];
      store.commit('game/SET_WINDOW_STYLE', next);
      this.menu.scene.game.events.emit('window-style-change', next);
    } else if (key === 'followerPokemon') {
      const next = !store.state.game.gameFlags.follower_pokemon;
      store.commit('game/PATCH_FLAGS', { follower_pokemon: next });
      this.menu.scene.game.events.emit('follower-pokemon-change', next);
    } else if (key === 'alwaysRun') {
      store.commit('game/SET_ALWAYS_RUN', !store.state.game.alwaysRun);
    } else if (key === 'autoSurf') {
      store.commit('game/SET_AUTO_SURF', !store.state.game.autoSurf);
    }
    this.menu._clearSubTexts();
    this.build();
  }

  confirm() {
    this.cycle(1);
  }
}
