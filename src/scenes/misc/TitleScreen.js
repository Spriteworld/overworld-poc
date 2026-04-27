import Phaser from 'phaser';
import store, { listSaves, saveOptions } from '../../store/index.js';
import { getGameDef, setGameDef } from '@Data/gameDef.js';
import * as gameDefPresets from '@Data/gameDefs/index.js';
import { initRng } from '@Utilities/rng.js';
import { getInputManager } from '@Utilities';

const BALL_R = 110;

const NAVY     = 0x1a1a2e;
const WHITE    = 0xffffff;
const ORANGE   = 0xFF8C00;
const BLACK    = 0x000000;
const YELLOW   = '#f8e030';
const COL_NORM = '#ffffff';
const COL_SEL  = '#f8e030';
const COL_DIM  = '#9a9a9a';
const COL_OFF  = '#555555';

const MENU_FONT     = { fontFamily: 'Gen3', fontSize: '18px', color: COL_NORM };
const CAPTION_FONT  = { fontFamily: 'Gen3', fontSize: '14px', color: COL_DIM };
const TITLE_FONT    = { fontFamily: 'Gen3', fontSize: '28px', color: COL_NORM };

// ── Settings rows — shared spec shape for wizard + options ─────────────────
//   { key, label, values[], format(v) }

const WIZARD_FIELDS = [
  {
    key: 'id', label: 'Preset',
    values: ['kanto', 'nuzlocke', 'randomizer'],
    format: (v) => ({ kanto: 'Kanto Classic', nuzlocke: 'Nuzlocke', randomizer: 'Randomizer' }[v]),
  },
  {
    key: 'availablePokemon', label: 'Pool',
    values: ['gen_1', 'gen_2', 'gen_3'],
    format: (v) => ({ gen_1: 'Gen 1', gen_2: 'Gen 2', gen_3: 'Gen 3' }[v]),
  },
  {
    key: 'expRateMultiplier', label: 'EXP rate',
    values: [0.5, 1.0, 1.5, 2.0, 3.0],
    format: (v) => `${v.toFixed(1).replace(/\.0$/, '')}x`,
  },
  { key: 'maxIvs',          label: 'Max IVs',        values: [false, true], format: (v) => v ? 'On' : 'Off' },
  { key: 'infiniteTMs',     label: 'Infinite TMs',   values: [false, true], format: (v) => v ? 'On' : 'Off' },
  { key: 'owEncounters',    label: 'OW encounters',  values: [false, true], format: (v) => v ? 'On' : 'Off' },
  { key: 'catchingGivesExp',label: 'EXP on catch',   values: [false, true], format: (v) => v ? 'On' : 'Off' },
];

const OPTION_FIELDS = [
  {
    key: 'textSpeed', label: 'Text speed',
    values: ['instant', 'fast', 'normal'],
    format: (v) => ({ instant: 'Instant', fast: 'Fast', normal: 'Normal' }[v]),
  },
  {
    key: 'bgmVolume', label: 'BGM volume',
    values: [0, 5, 10, 15, 20],
    format: (v) => v === 0 ? 'Off' : `${v * 5}%`,
  },
  {
    key: 'sfxVolume', label: 'SFX volume',
    values: [0, 5, 10, 15, 20],
    format: (v) => v === 0 ? 'Off' : `${v * 5}%`,
  },
  {
    key: 'alwaysRun', label: 'Always run',
    values: [false, true],
    format: (v) => v ? 'On' : 'Off',
  },
  {
    key: 'autoSurf', label: 'Auto surf',
    values: [false, true],
    format: (v) => v ? 'On' : 'Off',
  },
];

export default class TitleScreen extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScreen' });
  }

  get _cx() { return this.scale.width / 2; }
  get _cy() { return Math.min(this.scale.height * 0.38, 260); }

  /** Scene init data: `{ skipIdle: true }` jumps straight to the main menu. */
  init(data) {
    this._skipIdle = !!data?.skipIdle;
  }

  create() {
    this.cameras.main.setBackgroundColor(NAVY);

    // Idle-state presentation (ball + title + press text) is a separate
    // screen from the main menu. On activation, everything in `_idleGroup`
    // is destroyed and the menu layout takes over, with its own title
    // header at the top.
    this._idleGroup   = [];
    this._menuGroup   = [];
    this._menuHeader  = null;
    this._cursorText  = null;
    this._state       = 'idle';
    this._cursorIdx   = 0;
    this._menuItems   = [];
    this._itemTexts   = [];
    this._selectedSlot = null;
    this._slotSummaries = [];
    this._wizardValues = null;
    this._optionValues = null;

    this._keys = {
      up:      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right:   this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      confirm: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      enter:   this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      cancel:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      esc:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    this._imQueue = [];
    const im = getInputManager();
    if (im) {
      const enqueue = (action) => () => this._imQueue.push(action);
      this._imBindings = [
        ['up',      enqueue('up')],
        ['down',    enqueue('down')],
        ['left',    enqueue('left')],
        ['right',   enqueue('right')],
        ['confirm', enqueue('confirm')],
        ['cancel',  enqueue('cancel')],
        ['menu',    enqueue('confirm')],
      ];
      for (const [action, cb] of this._imBindings) im.on(action, cb);
    }

    if (this._skipIdle) {
      // VITE_SKIP_INTRO path: draw the menu screen directly.
      this._enterMenuLayout();
      this._showMainMenu();
    } else {
      this._drawIdleScreen();
    }
    // Idle → mainMenu uses polling (not a keydown listener) so the keypress
    // that activates the menu can't race with JustDown() on the same tick.
  }

  update() {
    const q = this._imQueue;
    const hasIM = (action) => {
      const idx = q.indexOf(action);
      if (idx === -1) return false;
      q.splice(idx, 1);
      return true;
    };

    if (this._state === 'idle') {
      const pad = this.input.gamepad?.getPad(0);
      const K  = this._keys;
      const anyJustDown =
        Phaser.Input.Keyboard.JustDown(K.confirm) ||
        Phaser.Input.Keyboard.JustDown(K.enter)   ||
        Phaser.Input.Keyboard.JustDown(K.cancel)  ||
        Phaser.Input.Keyboard.JustDown(K.esc)     ||
        Phaser.Input.Keyboard.JustDown(K.up)      ||
        Phaser.Input.Keyboard.JustDown(K.down)    ||
        Phaser.Input.Keyboard.JustDown(K.left)    ||
        Phaser.Input.Keyboard.JustDown(K.right);
      if (anyJustDown || q.length > 0 || pad?.buttons.some(b => b.pressed)) {
        q.length = 0;
        this._activate();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this._keys.up)    || hasIM('up'))    this._moveCursor(-1);
    if (Phaser.Input.Keyboard.JustDown(this._keys.down)  || hasIM('down'))  this._moveCursor(1);
    if (Phaser.Input.Keyboard.JustDown(this._keys.left)  || hasIM('left'))  this._cycleValue(-1);
    if (Phaser.Input.Keyboard.JustDown(this._keys.right) || hasIM('right')) this._cycleValue(1);

    if (Phaser.Input.Keyboard.JustDown(this._keys.confirm) ||
        Phaser.Input.Keyboard.JustDown(this._keys.enter)   ||
        hasIM('confirm')) {
      this._select();
    }
    if (Phaser.Input.Keyboard.JustDown(this._keys.cancel) ||
        Phaser.Input.Keyboard.JustDown(this._keys.esc)    ||
        hasIM('cancel')) {
      this._cancel();
    }
    q.length = 0;
  }

  // ─── Press-start ──────────────────────────────────────────────────────────

  _drawIdleScreen() {
    const ball = this._drawBall();
    this._idleGroup.push(...ball);
    const titleY = this._cy + BALL_R + 30;
    this._idleGroup.push(
      this.add.text(this._cx, titleY, 'POKÉMON SPRITEWORLD', TITLE_FONT).setOrigin(0.5, 0.5)
    );
    this._pressText = this.add.text(this._cx, titleY + 48, '— Press any button —', {
      fontFamily: 'Gen3', fontSize: '14px', color: YELLOW,
    }).setOrigin(0.5, 0.5);
    this._idleGroup.push(this._pressText);
    this._startBlink();
  }

  _activate() {
    this._blinkEvent?.remove(false);
    this._enterMenuLayout();
    this._showMainMenu();
  }

  /**
   * Tear down the idle-state presentation and draw the menu-screen title
   * header. Called on first activation (from idle) and also directly from
   * create() when the scene is entered with `skipIdle: true`. Idempotent.
   */
  _enterMenuLayout() {
    this._idleGroup.forEach(o => o?.destroy());
    this._idleGroup = [];
    this._pressText = null;
    if (!this._menuHeader) {
      this._menuHeader = this.add.text(this._cx, 96, 'POKÉMON SPRITEWORLD', {
        fontFamily: 'Gen3', fontSize: '22px', color: COL_NORM,
      }).setOrigin(0.5, 0.5);
    }
  }

  _startBlink() {
    this._blinkEvent = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { this._pressText?.setVisible(!this._pressText.visible); },
    });
  }

  // ─── Main menu ────────────────────────────────────────────────────────────

  _showMainMenu() {
    this._state = 'mainMenu';
    this._clearMenu();
    this._cursorIdx = 0;
    this._buildMenu(['CONTINUE', 'NEW GAME', 'OPTIONS'], 220, 36);
  }

  // ─── Continue / slot picker ───────────────────────────────────────────────

  _showContinuePicker() {
    this._state = 'continuePicker';
    this._clearMenu();
    this._cursorIdx = this._firstFilledIndex() ?? 0;
    this._slotSummaries = listSaves();
    const labels = this._slotSummaries.map((s) => this._slotLabel(s));
    this._buildMenu(labels, 220, 32);
    // Dim rows that are empty so user knows they can't continue them.
    this._slotSummaries.forEach((s, i) => {
      if (s.empty) this._itemTexts[i].setColor(COL_OFF);
    });
  }

  _firstFilledIndex() {
    const saves = listSaves();
    for (let i = 0; i < saves.length; i++) if (!saves[i].empty) return i;
    return null;
  }

  // ─── New Game slot picker ─────────────────────────────────────────────────

  _showNewGameSlotPicker() {
    this._state = 'newGameSlotPicker';
    this._clearMenu();
    this._cursorIdx = 0;
    this._slotSummaries = listSaves();
    const labels = this._slotSummaries.map((s) => this._slotLabel(s));
    this._buildMenu(labels, 220, 32);
  }

  _showOverwriteConfirm() {
    this._state = 'overwriteConfirm';
    this._clearMenu();
    this._cursorIdx = 1; // default to NO
    const label = this.add.text(this._cx, 220, 'Overwrite this save?', {
      fontFamily: 'Gen3', fontSize: '16px', color: COL_NORM,
    }).setOrigin(0.5, 0.5);
    this._menuGroup.push(label);
    this._buildMenu(['YES', 'NO'], 270, 32);
  }

  // ─── New Game wizard ──────────────────────────────────────────────────────

  _showWizard(slot) {
    this._state = 'wizard';
    this._clearMenu();
    this._cursorIdx = 0;
    this._selectedSlot = slot;
    this._wizardValues = this._presetValues('kanto');
    this._caption = this.add.text(this._cx, 140, `NEW GAME — Slot ${slot}`, CAPTION_FONT)
      .setOrigin(0.5, 0.5);
    this._menuGroup.push(this._caption);
    this._renderSettingsScreen(WIZARD_FIELDS, this._wizardValues, { extraRow: 'START' });
  }

  _presetValues(presetId) {
    const preset = gameDefPresets[presetId] ?? gameDefPresets.kanto;
    const out = { id: presetId };
    for (const f of WIZARD_FIELDS) {
      if (f.key === 'id') continue;
      out[f.key] = preset[f.key] ?? f.values[0];
    }
    return out;
  }

  _finaliseWizard() {
    const slot = this._selectedSlot;
    const values = this._wizardValues;

    // Build effective gameDef: start from the chosen preset, then overlay
    // the wizard's per-field picks so individual tweaks stick.
    const preset = gameDefPresets[values.id] ?? gameDefPresets.kanto;
    const effective = { ...preset };
    for (const f of WIZARD_FIELDS) {
      if (f.key === 'id') continue;
      effective[f.key] = values[f.key];
    }
    setGameDef(effective);

    const startScene = effective.startScene;
    const startTile  = { ...effective.startTile };

    store.dispatch('clearSave', slot).then(() => {
      store.commit('game/SET_ACTIVE_SLOT', slot);
      localStorage.setItem('sw_active_slot', String(slot));
      initRng(store.state.game.seed);
      store.commit('game/SET_MAP', startScene);
      store.commit('game/SET_PLAYER_TILE', startTile);
      store.dispatch('saveGame');
      this._launch(startScene, startTile);
    });
  }

  // ─── Options screen ───────────────────────────────────────────────────────

  _showOptions() {
    this._state = 'options';
    this._clearMenu();
    this._cursorIdx = 0;
    const g = store.state.game;
    this._optionValues = {
      textSpeed: g.textSpeed,
      bgmVolume: g.bgmVolume,
      sfxVolume: g.sfxVolume,
      alwaysRun: g.alwaysRun,
      autoSurf:  g.autoSurf,
    };
    this._caption = this.add.text(this._cx, 140,
      '◀ ▶ to change · X to return', CAPTION_FONT)
      .setOrigin(0.5, 0.5);
    this._menuGroup.push(this._caption);
    this._renderSettingsScreen(OPTION_FIELDS, this._optionValues);
  }

  _commitOptions() {
    // Apply to Vuex and persist globally.
    store.commit('game/APPLY_OPTIONS', this._optionValues);
    saveOptions(store);
  }

  // ─── Generic settings renderer ────────────────────────────────────────────

  /**
   * Render a left-aligned list of `LABEL:   value` rows for settings-style
   * screens (wizard + options). When `opts.extraRow` is set, appends a plain
   * action row at the bottom ("START" for the wizard).
   *
   * Rows are drawn in a two-column layout so labels line up. LEFT/RIGHT
   * cycles `valuesObj[field.key]` through `field.values`; a single action row
   * is selected with CONFIRM.
   */
  _renderSettingsScreen(fields, valuesObj, opts = {}) {
    this._fields = fields;
    this._extraRow = opts.extraRow || null;
    const rows = fields.length + (this._extraRow ? 1 : 0);
    this._menuItems = new Array(rows);
    this._itemTexts = [];

    const startY  = 180;
    const spacing = 26;
    const cx = this._cx;
    const labelX  = cx - 110;
    const valueX  = cx + 40;

    fields.forEach((f, i) => {
      const y = startY + i * spacing;
      const label = this.add.text(labelX, y, `${f.label}:`, {
        ...MENU_FONT, color: COL_NORM,
      }).setOrigin(0, 0.5);
      const value = this.add.text(valueX, y, `◀ ${f.format(valuesObj[f.key])} ▶`, {
        ...MENU_FONT, color: COL_NORM,
      }).setOrigin(0, 0.5);
      this._menuGroup.push(label, value);
      this._itemTexts.push({ label, value, kind: 'setting', field: f });
    });

    if (this._extraRow) {
      const y = startY + fields.length * spacing + 8;
      const action = this.add.text(cx, y, this._extraRow, {
        ...MENU_FONT, color: COL_NORM,
      }).setOrigin(0.5, 0.5);
      this._menuGroup.push(action);
      this._itemTexts.push({ label: null, value: action, kind: 'action' });
    }

    this._highlightSettingsRow();
    this._placeCursor();
  }

  _highlightSettingsRow() {
    if (!this._itemTexts?.length) return;
    this._itemTexts.forEach((row, i) => {
      const sel = i === this._cursorIdx;
      if (row.kind === 'setting') {
        row.label.setColor(sel ? COL_SEL : COL_NORM);
        row.value.setColor(sel ? COL_SEL : COL_NORM);
      } else {
        row.value.setColor(sel ? COL_SEL : COL_NORM);
      }
    });
  }

  _placeCursor() {
    this._cursorText?.destroy();
    const row = this._itemTexts[this._cursorIdx];
    if (!row) return;
    const anchor = row.label ?? row.value;
    this._cursorText = this.add.text(
      anchor.x - 18, anchor.y, '▶',
      { fontFamily: 'Gen3', fontSize: '18px', color: COL_SEL },
    ).setOrigin(0.5, 0.5);
    this._menuGroup.push(this._cursorText);
  }

  // ─── Plain vertical menu (strings-only) ───────────────────────────────────

  _buildMenu(items, startY, spacing) {
    this._menuItems = items;
    this._itemTexts = items.map((label, i) => {
      return this.add.text(this._cx, startY + i * spacing, label, {
        ...MENU_FONT,
        color: i === this._cursorIdx ? COL_SEL : COL_NORM,
      }).setOrigin(0.5, 0.5);
    });
    const sel = this._itemTexts[this._cursorIdx];
    this._cursorText = this.add.text(
      sel.x - sel.width / 2 - 18, sel.y, '▶',
      { fontFamily: 'Gen3', fontSize: '18px', color: COL_SEL },
    ).setOrigin(0.5, 0.5);
    this._menuGroup.push(...this._itemTexts, this._cursorText);
  }

  _clearMenu() {
    this._menuGroup.forEach(obj => obj?.destroy());
    this._menuGroup  = [];
    this._itemTexts  = [];
    this._menuItems  = [];
    this._cursorText = null;
    this._caption    = null;
    this._fields     = null;
    this._extraRow   = null;
  }

  // ─── Input dispatch ───────────────────────────────────────────────────────

  _moveCursor(dir) {
    if (!this._itemTexts?.length) return;
    const len = this._itemTexts.length;
    const prev = this._cursorIdx;
    this._cursorIdx = (this._cursorIdx + dir + len) % len;
    if (this._fields || this._extraRow) {
      this._highlightSettingsRow();
      this._placeCursor();
    } else {
      // Plain string menu — recolour + reposition cursor.
      const prevText = this._itemTexts[prev];
      const selText  = this._itemTexts[this._cursorIdx];
      if (this._state === 'continuePicker' && this._slotSummaries[prev]?.empty) {
        prevText.setColor(COL_OFF);
      } else {
        prevText.setColor(COL_NORM);
      }
      if (this._state === 'continuePicker' && this._slotSummaries[this._cursorIdx]?.empty) {
        selText.setColor(COL_OFF);
      } else {
        selText.setColor(COL_SEL);
      }
      this._cursorText.setPosition(selText.x - selText.width / 2 - 18, selText.y);
    }
  }

  _cycleValue(dir) {
    if (!this._fields) return;
    const row = this._itemTexts[this._cursorIdx];
    if (!row || row.kind !== 'setting') return;
    const field = row.field;
    const vals = field.values;
    const current = this._currentValuesObj();
    const curIdx = Math.max(0, vals.indexOf(current[field.key]));
    const next = vals[(curIdx + dir + vals.length) % vals.length];
    current[field.key] = next;

    // Wizard-only: changing the preset row re-initialises every other field
    // from that preset's defaults. Options screen doesn't need this.
    if (this._state === 'wizard' && field.key === 'id') {
      const preset = this._presetValues(next);
      this._wizardValues = preset;
      // Re-render with new values.
      this._reRenderSettings();
      return;
    }

    row.value.setText(`◀ ${field.format(next)} ▶`);

    if (this._state === 'options') {
      // Live-apply for immediate feel; persisted on exit.
      store.commit('game/APPLY_OPTIONS', { [field.key]: next });
    }
  }

  _currentValuesObj() {
    return this._state === 'wizard' ? this._wizardValues : this._optionValues;
  }

  _reRenderSettings() {
    // Destroy and rebuild. Preserves cursor position.
    const savedCursor = this._cursorIdx;
    const savedState  = this._state;
    this._clearMenu();
    this._cursorIdx = savedCursor;
    this._state = savedState;
    if (savedState === 'wizard') {
      this._caption = this.add.text(this._cx, 140, `NEW GAME — Slot ${this._selectedSlot}`, CAPTION_FONT)
        .setOrigin(0.5, 0.5);
      this._menuGroup.push(this._caption);
      this._renderSettingsScreen(WIZARD_FIELDS, this._wizardValues, { extraRow: 'START' });
    } else {
      this._caption = this.add.text(this._cx, 140, '◀ ▶ to change · X to return', CAPTION_FONT)
        .setOrigin(0.5, 0.5);
      this._menuGroup.push(this._caption);
      this._renderSettingsScreen(OPTION_FIELDS, this._optionValues);
    }
  }

  _select() {
    switch (this._state) {
      case 'mainMenu': {
        const chosen = this._menuItems[this._cursorIdx];
        if (chosen === 'CONTINUE') this._showContinuePicker();
        else if (chosen === 'NEW GAME') this._showNewGameSlotPicker();
        else if (chosen === 'OPTIONS') this._showOptions();
        return;
      }
      case 'continuePicker': {
        const slot = this._cursorIdx + 1;
        const summary = this._slotSummaries[this._cursorIdx];
        if (summary.empty) return; // can't continue an empty slot
        this._continueSlot(slot);
        return;
      }
      case 'newGameSlotPicker': {
        const slot = this._cursorIdx + 1;
        this._selectedSlot = slot;
        const summary = this._slotSummaries[this._cursorIdx];
        if (summary.empty) this._showWizard(slot);
        else this._showOverwriteConfirm();
        return;
      }
      case 'overwriteConfirm': {
        const chosen = this._menuItems[this._cursorIdx];
        if (chosen === 'YES') this._showWizard(this._selectedSlot);
        else this._showNewGameSlotPicker();
        return;
      }
      case 'wizard': {
        const row = this._itemTexts[this._cursorIdx];
        if (row?.kind === 'action') this._finaliseWizard();
        return;
      }
      case 'options': {
        // No action rows — CONFIRM is a no-op; exit with CANCEL.
        return;
      }
    }
  }

  _cancel() {
    switch (this._state) {
      case 'mainMenu':        return; // top of the stack; nothing to cancel to
      case 'continuePicker':  return this._showMainMenu();
      case 'newGameSlotPicker': return this._showMainMenu();
      case 'overwriteConfirm':  return this._showNewGameSlotPicker();
      case 'wizard':            return this._showNewGameSlotPicker();
      case 'options':
        this._commitOptions();
        return this._showMainMenu();
    }
  }

  // ─── Game actions ─────────────────────────────────────────────────────────

  async _continueSlot(slot) {
    const ok = await store.dispatch('loadGame', slot);
    if (!ok) return; // empty slot shouldn't reach here, defensive
    initRng(store.state.game.seed);
    const map  = store.state.game.currentMap || getGameDef().overworldScene;
    const tile = store.state.game.playerTile;
    const playerLocation = (tile && (tile.x || tile.y))
      ? { x: tile.x, y: tile.y, charLayer: tile.charLayer }
      : {};
    this._launch(map, playerLocation);
  }

  _cleanupIM() {
    const im = getInputManager();
    if (im && this._imBindings) {
      for (const [action, cb] of this._imBindings) im.off(action, cb);
    }
    this._imBindings = null;
  }

  _launch(sceneKey, playerLocation) {
    this._cleanupIM();
    this.scene.start(sceneKey, { playerLocation });
    this.scene.start('OverworldUI');
    this.scene.bringToTop('OverworldUI');
    if (this.game.config.debug?.time) {
      this.scene.start('TimeOverlay');
      this.scene.bringToTop('TimeOverlay');
    }
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  _slotLabel(summary) {
    const head = `SLOT ${summary.slot}`;
    if (summary.empty) return `${head}    — EMPTY —`;
    const name = (summary.playerName || 'PLAYER').toUpperCase();
    const map  = this._prettyMap(summary.currentMap);
    const pt   = this._formatPlaytime(summary.playtime);
    return `${head}    ${name} · ${map} · ${pt}`;
  }

  _formatPlaytime(sec) {
    const s = Math.max(0, Math.floor(sec ?? 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  _prettyMap(key) {
    if (!key) return '?';
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  }

  // ─── Premier Ball ─────────────────────────────────────────────────────────

  /** Draws the premier ball and returns every graphics object so the
   *  caller can destroy them when leaving idle. */
  _drawBall() {
    const cx = this._cx;
    const cy = this._cy;

    const base = this.add.graphics();
    base.fillStyle(WHITE, 1);
    base.fillCircle(cx, cy, BALL_R);

    const band = this.add.graphics();
    band.fillStyle(ORANGE, 1);
    band.fillRect(cx - BALL_R, cy - 17, BALL_R * 2, 34);

    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(WHITE, 1);
    maskShape.fillCircle(cx, cy, BALL_R);
    band.setMask(maskShape.createGeometryMask());

    const fg = this.add.graphics();
    fg.lineStyle(5, BLACK, 1);
    fg.strokeCircle(cx, cy, BALL_R);
    fg.lineStyle(3, BLACK, 1);
    fg.lineBetween(cx - BALL_R, cy, cx + BALL_R, cy);
    fg.fillStyle(WHITE, 1);
    fg.fillCircle(cx, cy, 14);
    fg.lineStyle(4, BLACK, 1);
    fg.strokeCircle(cx, cy, 14);

    return [base, band, fg, maskShape];
  }
}
