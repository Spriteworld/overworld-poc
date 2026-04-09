import Scenes from '@Scenes';
import { WORLD_FILE, WORLD_MAP_KEYS } from '@Maps';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const SKIP_SCENES = ['Preload', 'Base', 'OverworldUI', 'TimeOverlay'];
const TILE_PX = 32;

const TABS = ['WARP', 'DEBUG', 'FLAGS'];

const TAB_W    = Math.floor(SW / TABS.length);
const TAB_Y    = SY + 16;
const LIST_Y   = SY + 54;
const ROW_H    = 22;
const LABEL_W  = 300;
const MAX_ROWS = Math.floor((SH - LIST_Y - 28) / ROW_H);

/**
 * Debug screen for the pause menu.
 *
 * Tabs:
 *   WARP  — teleport to any zone in kanto.world (dynamic list)
 *   DEBUG — toggle game.config.debug booleans; reloads the map in-place
 *   FLAGS — toggle game.config.gameFlags booleans; reloads the map in-place
 *
 * Navigation:
 *   ◀/▶  switch tabs
 *   ▲/▼  scroll items within a tab
 *   Z    confirm (warp / toggle)
 *   X    back to main pause menu
 */
export default class DebugScreen {
  constructor(menu) {
    this._menu     = menu;
    this._scene    = menu.scene; // OverworldUI scene
    this._tabIndex = 0;
    this._cursor   = 0;
    this._top      = 0;
    this._items    = [];
  }

  /** Called by PauseMenu._transitionTo — resets to first tab. */
  build() {
    this._tabIndex = 0;
    this._cursor   = 0;
    this._top      = 0;
    this._loadTab();
    this._render();
  }

  // ─── Tab item construction ────────────────────────────────────────────────

  _loadTab() {
    const key = TABS[this._tabIndex];
    switch (key) {
      case 'WARP':  this._items = this._warpItems();  break;
      case 'DEBUG': this._items = this._debugItems(); break;
      case 'FLAGS': this._items = this._flagItems();  break;
    }
  }

  _warpItems() {
    const extra = [
      { type: 'warp', label: 'Test' },
    ];

    const maps = WORLD_FILE.maps;
    const minX  = Math.min(...maps.map(m => m.x));
    const minY  = Math.min(...maps.map(m => m.y));
    const world = maps.map(entry => {
      const label = WORLD_MAP_KEYS[entry.fileName] ?? entry.fileName;
      const tileX = Math.floor((entry.x - minX) / TILE_PX + (entry.width  / TILE_PX) / 2);
      const tileY = Math.floor((entry.y - minY) / TILE_PX + (entry.height / TILE_PX) / 2);
      return { type: 'warp-world', label, tileX, tileY };
    });

    return [...extra, ...world];
  }

  _debugItems() {
    const items = [];
    const dbg   = this._scene.game.config.debug || {};
    for (const [k, v] of Object.entries(dbg)) {
      if (typeof v === 'boolean') {
        items.push({ type: 'debug', key: k, label: k });
      } else if (v && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (typeof sv === 'boolean') {
            items.push({ type: 'debug', key: `${k}.${sk}`, label: `${k}.${sk}` });
          }
        }
      }
    }
    return items;
  }

  _flagItems() {
    const flags = this._scene.game.config.gameFlags || {};
    return Object.entries(flags)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([k]) => ({ type: 'flag', key: k, label: k }));
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  _render() {
    this._menu._clearSubTexts();

    const reg   = obj => this._menu.reg(obj);
    const scene = this._scene;

    // Tab bar
    TABS.forEach((label, i) => {
      const cx     = SX + i * TAB_W + TAB_W / 2;
      const active = i === this._tabIndex;
      const style  = active ? TEXT_STYLE_BOLD : { ...TEXT_STYLE_BODY, color: '#888888' };
      reg(scene.add.text(cx, TAB_Y, label, style)).setOrigin(0.5, 0);
      if (active) {
        const ul = scene.add.graphics();
        ul.lineStyle(2, 0x181818);
        ul.lineBetween(cx - 28, TAB_Y + 18, cx + 28, TAB_Y + 18);
        reg(ul);
      }
    });

    // Separator
    const sep = scene.add.graphics();
    sep.lineStyle(1, 0xaaaaaa);
    sep.lineBetween(SX + 8, LIST_Y - 6, SX + SW - 8, LIST_Y - 6);
    reg(sep);

    // Item rows
    const visible = this._items.slice(this._top, this._top + MAX_ROWS);

    if (visible.length === 0) {
      reg(scene.add.text(SX + 16, LIST_Y, 'Nothing here.', TEXT_STYLE_BODY));
    } else {
      visible.forEach((item, row) => {
        const y        = LIST_Y + row * ROW_H;
        const selected = this._top + row === this._cursor;
        const pfx      = selected ? '►' : ' ';
        const color    = selected ? '#f8e030' : '#181818';

        if (item.type === 'warp' || item.type === 'warp-world') {
          reg(scene.add.text(SX + 16, y, pfx + item.label, { ...TEXT_STYLE_BODY, color }));
        } else {
          const val      = this._read(item);
          const valLabel = val ? 'ON' : 'OFF';
          const valColor = val ? '#309030' : '#c03030';
          reg(scene.add.text(SX + 16,           y, pfx + item.label, { ...TEXT_STYLE_BODY, color }));
          reg(scene.add.text(SX + 16 + LABEL_W, y, valLabel,         { ...TEXT_STYLE_BODY, color: valColor }));
        }
      });
    }

    // Scroll arrows
    if (this._top > 0) {
      reg(scene.add.text(SX + SW - 24, LIST_Y, '▲', TEXT_STYLE_HINT));
    }
    if (this._top + MAX_ROWS < this._items.length) {
      reg(scene.add.text(SX + SW - 24, SY + SH - 44, '▼', TEXT_STYLE_HINT));
    }

    reg(scene.add.text(SX + 16, SY + SH - 22, '◀▶ tab   ▲▼ scroll   X  back', TEXT_STYLE_HINT));
  }

  // ─── Flag read / write ────────────────────────────────────────────────────

  _read(item) {
    const parts = item.key.split('.');
    const root  = item.type === 'debug'
      ? this._scene.game.config.debug
      : this._scene.game.config.gameFlags;
    let v = root;
    for (const p of parts) v = v?.[p];
    return !!v;
  }

  _write(item, val) {
    const parts = item.key.split('.');
    const root  = item.type === 'debug'
      ? this._scene.game.config.debug
      : this._scene.game.config.gameFlags;
    let obj = root;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = val;
  }

  _persist(item) {
    const storageKey = item.type === 'debug' ? 'spriteworld_debug' : 'spriteworld_gameflags';
    const data = item.type === 'debug'
      ? this._scene.game.config.debug
      : this._scene.game.config.gameFlags;
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  // ─── Navigation / interaction ─────────────────────────────────────────────

  tabNav(dir) {
    this._tabIndex = (this._tabIndex + dir + TABS.length) % TABS.length;
    this._cursor   = 0;
    this._top      = 0;
    this._loadTab();
    this._render();
  }

  nav(dir) {
    if (!this._items.length) return;
    this._cursor = (this._cursor + dir + this._items.length) % this._items.length;
    if (this._cursor < this._top)             this._top = this._cursor;
    if (this._cursor >= this._top + MAX_ROWS) this._top = this._cursor - MAX_ROWS + 1;
    this._render();
  }

  confirm() {
    if (!this._items.length) return;
    const item = this._items[this._cursor];

    if (item.type === 'warp-world') {
      const mapName  = this._scene.registry.get('map');
      const mapScene = this._scene.scene.get(mapName);
      if (!mapScene) return;
      const char = mapScene.characters.get('player');
      const loc = { x: item.tileX, y: item.tileY, charLayer: 'ground' };

      if (mapName === 'KantoWorld') {
        // Teleport within the merged world with a camera fade.
        char.disableMovement();
        mapScene.cameras.main.fadeOut(500, 0, 0, 0);
        mapScene.cameras.main.once('camerafadeoutcomplete', () => {
          mapScene.gridEngine.setPosition(char.name, { x: loc.x, y: loc.y }, loc.charLayer);
          char.look('down');
          mapScene.cameras.main.fadeIn(500, 0, 0, 0);
          char.enableMovement();
        });
      } else {
        // Start KantoWorld and place the player at the target zone.
        mapScene.scene.start('KantoWorld', { playerLocation: loc });
      }

      this._menu.close();
      this._scene.registry.set('player_input', true);
      return;
    }

    if (item.type === 'warp') {
      const mapName  = this._scene.registry.get('map');
      const mapScene = this._scene.scene.get(mapName);
      if (!mapScene) return;
      const char = mapScene.characters.get('player');
      mapScene.mapPlugins.warp.warpPlayerToMap(char, item.label);
      this._menu.close();
      this._scene.registry.set('player_input', true);
      return;
    }

    this._write(item, !this._read(item));
    this._persist(item);
    this._reloadMap();
    this._render();
  }

  _reloadMap() {
    const mapName  = this._scene.registry.get('map');
    const mapScene = this._scene.scene.get(mapName);
    if (!mapScene) return;
    const char  = mapScene.characters.get('player');
    const pos   = mapScene.gridEngine.getPosition('player');
    const layer = mapScene.gridEngine.getCharLayer('player');
    mapScene.mapPlugins.warp.warpPlayerToMapWithoutFade(char, mapName, {
      x:         pos.x,
      y:         pos.y,
      dir:       char.getFacingDirection(),
      charLayer: layer,
    });
  }
}
