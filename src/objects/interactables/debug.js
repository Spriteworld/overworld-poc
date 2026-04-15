import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue, checkOnlyIf } from '@Utilities';
import store from '../../store/index.js';

export default class {
  constructor(scene) {
    this.scene = scene;
    this._coordsText = null;
    this._onlyIfEntries = []; // { textObj, name, onlyIf, onlyIfKey, onlyIfVal, type, op }
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::debug');
    }

    if (this.scene.game.config.debug.grid === true) {
      this.showGrid();
    }

    if (this.scene.game.config.debug.objects === true) {
      this.#identifyObjects();
    }

    if (this.scene.game.config.debug.tests.outlineColliders === true) {
      this.#identifyColliders();
    }

    if (this.scene.game.config.debug.playerCoords === true) {
      const cam = this.scene.cameras.main;
      this._coordsText = this.scene.add.text(
        cam.width - 6, cam.height - 6,
        '',
        { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }
      )
        .setOrigin(1, 1)
        .setScrollFactor(0)
        .setDepth(9999999);
    }

    // Register click-to-move listener unconditionally so the flag can be
    // toggled from the debug menu without requiring a map reload.
    this.scene.input.on('pointerdown', this.#onPointerDown, this);
    this.scene.events.once('shutdown', () => {
      this.scene.input.off('pointerdown', this.#onPointerDown, this);
    });
  }

  #onPointerDown(pointer) {
    if (!this.scene.game.config.debug.clickToMove) return;
    // Phaser's displayScale is a uniform (height-based) scale, which is wrong
    // when the canvas is stretched asymmetrically via CSS. Also, object-fit:contain
    // adds letterbox bars that must be subtracted before scaling.
    const canvas     = this.scene.game.canvas;
    const rect       = canvas.getBoundingClientRect();
    const event      = pointer.event;
    const gameAspect = canvas.width / canvas.height;
    const boxAspect  = rect.width   / rect.height;

    // Compute the actual rendered content area within the element box.
    let contentW, contentH, offsetX, offsetY;
    if (gameAspect > boxAspect) {
      // Width-constrained: letterbox bars on top and bottom.
      contentW = rect.width;
      contentH = rect.width / gameAspect;
      offsetX  = 0;
      offsetY  = (rect.height - contentH) / 2;
    } else {
      // Height-constrained: pillarbox bars on left and right.
      contentH = rect.height;
      contentW = rect.height * gameAspect;
      offsetX  = (rect.width - contentW) / 2;
      offsetY  = 0;
    }

    const clickX = event.clientX - rect.left - offsetX;
    const clickY = event.clientY - rect.top  - offsetY;
    if (clickX < 0 || clickY < 0 || clickX > contentW || clickY > contentH) return;

    const gameX = (clickX / contentW) * canvas.width;
    const gameY = (clickY / contentH) * canvas.height;
    const world = this.scene.cameras.main.getWorldPoint(gameX, gameY);
    const tileX = Math.floor(world.x / Tile.WIDTH);
    const tileY = Math.floor(world.y / Tile.HEIGHT);
    this.scene.gridEngine.setPosition('player', { x: tileX, y: tileY });
  }

  showGrid() {
    this.scene.add.grid(
      0, 0,
      this.scene.config.tilemap.widthInPixels,
      this.scene.config.tilemap.heightInPixels,
      Tile.WIDTH,
      Tile.HEIGHT
    )
      .setOrigin(0, 0)
      .setOutlineStyle(0x000000)
      .setAlpha(0.4)
      .setDepth(9999999)
    ;

  }

  #identifyObjects() {
    let colors = {};
    Object.values(ObjectTypes).forEach((obj) => {
      colors[obj.name] = obj.color;
    });

    Object.values(this.scene.config.tilemap.getObjectLayer('interactions').objects)
      .forEach((obj) => {
        if (obj.visible === false) { return; }
        let bgc = (getValue(colors, obj.type, '000'))
          .replace('#', '')
          .substr(-6);
        let label = obj.name;
        let onlyIfEntry = null;
        if (obj.type === 'trigger' || obj.type === 'on-interact') {
          const onlyIf = this.scene.getPropertyFromTile(obj, 'only_if') ?? null;
          const onlyIfKey = onlyIf?.key ?? null;
          const onlyIfVal = onlyIf && (Array.isArray(onlyIf.value) ? onlyIf.value : (onlyIf.value != null ? [onlyIf.value] : [])).map(v => (v && typeof v === 'object' ? v.value : v));
          if (onlyIf && (onlyIfKey || onlyIfVal.length)) {
            const type = onlyIf.type || 'flag';
            const op   = onlyIf.comparison ?? 'eq';
            onlyIfEntry = { name: obj.name, onlyIf, onlyIfKey, onlyIfVal, type, op };
            label += this.#onlyIfLabel(onlyIfEntry);
          }
        }
        let text = this.scene.add.text(0, 0, label, {
            font: '9px',
            align: 'justify',
            padding: 3,
            color: bgc === '000' ? '#fff' : '#000',
            backgroundColor: '#'+bgc,
            shadow: {
              stroke: '#000',
              offsetX: 1,
              offsetY: 1,
            }
          })
        ;

        let tile = null;
        if (typeof obj.polygon !== 'undefined') {
          tile = this.scene.add
            .polygon(
              obj.x, obj.y,
              obj.polygon,
            )
          ;
        } else {
          tile = this.scene.add.rectangle(obj.x, obj.y, obj.width, obj.height);
        }

        tile.setOrigin(0,0);
        tile.setStrokeStyle(1, 0x1a65ac);
        var debugObj = this.scene.add.container(0,0, [
          tile,
          Phaser.Display.Align.In.TopCenter(text, this.scene.add.zone(obj.x-5, obj.y-15, obj.width+10, obj.height+10).setOrigin(0,0)),
        ]);
        debugObj.setDepth(9999999);
        if (onlyIfEntry) {
          onlyIfEntry.textObj = text;
          this._onlyIfEntries.push(onlyIfEntry);
        }
      })
    ;
  }

  #onlyIfLabel(entry) {
    const { onlyIf, onlyIfKey, onlyIfVal, type, op } = entry;
    const passes  = checkOnlyIf(onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {});
    const keyPart = onlyIfKey ? `${onlyIfKey} ` : '';
    const vals    = onlyIfVal.join(', ');
    const valPart = vals ? `(${vals})` : '';
    let currentPart = '';
    if (onlyIfKey) {
      const currentVal = type === 'variable'
        ? ((this.scene.mapVars ?? {})[onlyIfKey] ?? 0)
        : (store.state.game.gameFlags[onlyIfKey] ?? false);
      currentPart = `  [${onlyIfKey} = ${currentVal}]`;
    }
    return `\n[only_if] ${type} ${keyPart}${op}${valPart ? ' ' + valPart : ''}\n→ ${passes ? '✓ pass' : '✗ fail'}${currentPart}`;
  }

  debugObject(obj, value) {
    let colors = {};
    Object.values(ObjectTypes).forEach((obj) => {
      colors[obj.name] = obj.color;
    });

    let bgc = (getValue(colors, obj.type, '000'))
      .replace('#', '')
      .substr(-6);
    let text = this.scene.add.text(0, 0, value, {
        font: '10px',
        align: 'justify',
        padding: 3,
        color: bgc === '000' ? '#fff' : '#000',
        backgroundColor: '#'+bgc,
        shadow: {
          stroke: '#000',
          offsetX: 1,
          offsetY: 1,
        }
      })
    ;

    let tile = this.scene.add.rectangle(obj.x, obj.y, obj.width, obj.height);
    tile.setOrigin(0,0);
    tile.setStrokeStyle(1, 0x1a65ac);
    var debugObj = this.scene.add.container(0,0, [
      tile,
      Phaser.Display.Align.In.TopCenter(text, this.scene.add.zone(obj.x-5, obj.y-15, obj.width+10, obj.height+10).setOrigin(0,0)),
    ]);
    debugObj.setDepth(9999999);
  }

  update() {
    if (this._coordsText) {
      const pos = this.scene.gridEngine.getPosition('player');
      const variant = this.scene.game.config.debug.playerVariant
        ? (this.scene.config?.variant ?? null)
        : null;
      this._coordsText.setText(variant ? `${pos.x}, ${pos.y} [${variant}]` : `${pos.x}, ${pos.y}`);
    }
    for (const entry of this._onlyIfEntries) {
      entry.textObj.setText(entry.name + this.#onlyIfLabel(entry));
    }
  }

  #identifyColliders() {
    console.log('Interactables::debug::identifyColliders', this.scene.config.tilemap.width, this.scene.config.tilemap.height);
    for (let x = 0; x < this.scene.config.tilemap.width; x++) {
      for (let y = 0; y < this.scene.config.tilemap.height; y++) {
        var props = this.scene.getTileProperties(x, y);
        var check = [
          props.get('ge_collide') || false,
          props.get('ge_collide_left') || false,
          props.get('ge_collide_right') || false,
          props.get('ge_collide_up') || false,
          props.get('ge_collide_down') || false,
        ].includes(true);
        if (!check) { continue; }
    
        this.scene.add.rectangle(x * Tile.WIDTH, y * Tile.HEIGHT, Tile.WIDTH, Tile.HEIGHT)
          .setFillStyle(0xC9BA0F, 1)
          .setOrigin(0,0)
          .setDepth(9999999)
          .setAlpha(0.5)
        ;
      }
    }
  }
}