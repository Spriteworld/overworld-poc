import Phaser from 'phaser';
import store from '../../store/index.js';
import { getGameDef } from '@Data/gameDef.js';

const CX = 400;
const CY = 260;
const BALL_R = 110;

const NAVY     = 0x1a1a2e;
const WHITE    = 0xffffff;
const ORANGE   = 0xFF8C00;
const BLACK    = 0x000000;
const YELLOW   = '#f8e030';
const COL_NORM = '#ffffff';
const COL_SEL  = '#f8e030';

export default class TitleScreen extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScreen' });
  }

  create() {
    this.cameras.main.setBackgroundColor(NAVY);

    this._drawBall();

    this.add.text(CX, 400, 'POKÉMON SPRITEWORLD', {
      fontFamily: 'Gen3',
      fontSize:   '28px',
      color:      COL_NORM,
    }).setOrigin(0.5, 0.5);

    this._pressText = this.add.text(CX, 448, '— Press any button —', {
      fontFamily: 'Gen3',
      fontSize:   '14px',
      color:      YELLOW,
    }).setOrigin(0.5, 0.5);

    this._blinkEvent = this.time.addEvent({
      delay:    500,
      loop:     true,
      callback: () => { this._pressText.setVisible(!this._pressText.visible); },
    });

    this._menuGroup   = [];
    this._cursorText  = null;
    this._state       = 'idle';
    this._cursorIdx   = 0;

    this._keys = {
      up:      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      confirm: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      enter:   this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      cancel:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      esc:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    this.input.keyboard.on('keydown', this._onAnyKey, this);
  }

  update() {
    if (this._state === 'idle') {
      const pad = this.input.gamepad?.getPad(0);
      if (pad?.buttons.some(b => b.pressed)) {
        this._activate();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this._keys.up)) {
      this._moveCursor(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this._keys.down)) {
      this._moveCursor(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this._keys.confirm) ||
        Phaser.Input.Keyboard.JustDown(this._keys.enter)) {
      this._select();
    }
    if (Phaser.Input.Keyboard.JustDown(this._keys.cancel) ||
        Phaser.Input.Keyboard.JustDown(this._keys.esc)) {
      this._cancel();
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Called on any keydown while in idle state. */
  _onAnyKey() {
    if (this._state !== 'idle') return;
    this._activate();
  }

  /** Transition from idle → show the main menu. */
  _activate() {
    this._state = 'menu';
    this._blinkEvent.remove(false);
    this._pressText.setVisible(false);
    this._showMainMenu();
  }

  _showMainMenu() {
    this._clearMenu();
    this._cursorIdx = 0;
    const hasSave = localStorage.getItem('sw_game') !== null;
    const items   = hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
    this._buildMenu(items, 420, 28);
  }

  _showConfirmMenu() {
    this._clearMenu();
    this._cursorIdx = 0;
    this._buildMenu(['YES', 'NO'], 420, 28);

    this.add.text(CX, 400, 'Delete save data?', {
      fontFamily: 'Gen3',
      fontSize:   '16px',
      color:      COL_NORM,
    }).setOrigin(0.5, 0.5).setName('confirmLabel');

    this._menuGroup.push(this.children.getByName('confirmLabel'));
  }

  /**
   * @param {string[]} items
   * @param {number}   startY
   * @param {number}   spacing
   */
  _buildMenu(items, startY, spacing) {
    this._menuItems = items;

    this._itemTexts = items.map((label, i) => {
      return this.add.text(CX + 16, startY + i * spacing, label, {
        fontFamily: 'Gen3',
        fontSize:   '18px',
        color:      i === 0 ? COL_SEL : COL_NORM,
      }).setOrigin(0.5, 0.5);
    });

    this._cursorText = this.add.text(
      CX + 16 - this._itemTexts[0].width / 2 - 18,
      startY,
      '▶',
      { fontFamily: 'Gen3', fontSize: '18px', color: COL_SEL },
    ).setOrigin(0.5, 0.5);

    this._menuGroup.push(...this._itemTexts, this._cursorText);
  }

  _clearMenu() {
    this._menuGroup.forEach(obj => obj?.destroy());
    this._menuGroup  = [];
    this._itemTexts  = [];
    this._cursorText = null;
    this._menuItems  = [];
  }

  _moveCursor(dir) {
    const len = this._menuItems.length;
    const prev = this._cursorIdx;
    this._cursorIdx = (this._cursorIdx + dir + len) % len;

    this._itemTexts[prev].setStyle({ color: COL_NORM });
    this._itemTexts[this._cursorIdx].setStyle({ color: COL_SEL });

    const targetText = this._itemTexts[this._cursorIdx];
    this._cursorText.setPosition(
      targetText.x - targetText.width / 2 - 18,
      targetText.y,
    );
  }

  _select() {
    const chosen = this._menuItems[this._cursorIdx];

    if (this._state === 'menu') {
      if (chosen === 'CONTINUE') {
        this._startGame();
      } else if (chosen === 'NEW GAME') {
        const hasSave = localStorage.getItem('sw_game') !== null;
        if (hasSave) {
          this._state = 'confirm';
          this._showConfirmMenu();
        } else {
          this._newGame();
        }
      }
    } else if (this._state === 'confirm') {
      if (chosen === 'YES') {
        store.dispatch('clearSave').then(() => this._newGame());
      } else {
        this._state = 'menu';
        this._showMainMenu();
      }
    }
  }

  _cancel() {
    if (this._state === 'confirm') {
      this._state = 'menu';
      this._showMainMenu();
      return;
    }
    if (this._state === 'menu') {
      this._state = 'menu';
      this._clearMenu();
      this._state = 'idle';
      this._pressText.setVisible(true);
      this._blinkEvent = this.time.addEvent({
        delay:    500,
        loop:     true,
        callback: () => { this._pressText.setVisible(!this._pressText.visible); },
      });
    }
  }

  /** Boot into the loaded save. */
  _startGame() {
    const map  = store.state.game.currentMap || getGameDef().overworldScene;
    const tile = store.state.game.playerTile;
    const playerLocation = (tile && (tile.x || tile.y))
      ? { x: tile.x, y: tile.y, charLayer: tile.charLayer }
      : {};
    this._launch(map, playerLocation);
  }

  /** Start a completely fresh game. */
  _newGame() {
    this._launch('HeroHouseF2', { x: 2, y: 6, charLayer: 'ground' });
  }

  _launch(sceneKey, playerLocation) {
    this.scene.start(sceneKey, { playerLocation });
    this.scene.start('OverworldUI');
    this.scene.bringToTop('OverworldUI');
    if (this.game.config.debug?.time) {
      this.scene.start('TimeOverlay');
      this.scene.bringToTop('TimeOverlay');
    }
  }

  // ─── Premier Ball ─────────────────────────────────────────────────────────

  _drawBall() {
    // White base circle
    const base = this.add.graphics();
    base.fillStyle(WHITE, 1);
    base.fillCircle(CX, CY, BALL_R);

    // Orange band, masked to the circle
    const band = this.add.graphics();
    band.fillStyle(ORANGE, 1);
    band.fillRect(CX - BALL_R, CY - 17, BALL_R * 2, 34);

    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(WHITE, 1);
    maskShape.fillCircle(CX, CY, BALL_R);
    band.setMask(maskShape.createGeometryMask());

    // Outline, divider line, and button drawn on top
    const fg = this.add.graphics();

    fg.lineStyle(5, BLACK, 1);
    fg.strokeCircle(CX, CY, BALL_R);

    fg.lineStyle(3, BLACK, 1);
    fg.lineBetween(CX - BALL_R, CY, CX + BALL_R, CY);

    fg.fillStyle(WHITE, 1);
    fg.fillCircle(CX, CY, 14);
    fg.lineStyle(4, BLACK, 1);
    fg.strokeCircle(CX, CY, 14);
  }
}
