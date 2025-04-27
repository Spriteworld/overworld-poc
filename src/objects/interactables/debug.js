import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (Debug.functions.gameMap) {
      console.log('Interactables::debug');
    }

    if (Debug.grid === true) {
      this.showGrid();
    }

    if (Debug.objects === true) {
      this.#identifyObjects();
    }

    if (Debug.functions.outlineColliders === true) {
      this.#identifyColliders();
    }
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
        let text = this.scene.add.text(0, 0, obj.name, {
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

        let tile = this.scene.add.rectangle(obj.x, obj.y, obj.width, obj.height);
        tile.setOrigin(0,0);
        tile.setStrokeStyle(1, 0x1a65ac);
        var debugObj = this.scene.add.container(0,0, [
          tile,
          Phaser.Display.Align.In.TopCenter(text, this.scene.add.zone(obj.x-5, obj.y-15, obj.width+10, obj.height+10).setOrigin(0,0)),
        ]);
        debugObj.setDepth(9999999);
      })
    ;
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