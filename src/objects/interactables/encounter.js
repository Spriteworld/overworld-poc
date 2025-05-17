import Debug from '@Data/debug.js';
import { ObjectTypes, Tile } from '@Objects';
import { getValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;

    this.disabled = false;
  }

  init() {
    if (this.scene.game.config.debug.functions.interactables.grass || this.scene.game.config.debug.functions.interactableShout) {
      console.log('Interactables::encounter');
    }
    if (this.disabled) { return;  }

    let encounterTiles = this.scene.findInteractions('encounters');
    if (encounterTiles.length === 0) { return; }

    encounterTiles.forEach(obj => {

      let tiles = [];
      if (typeof obj.polygon === 'undefined') {
        let width = parseInt(obj.width / Tile.WIDTH);
        let height = parseInt(obj.height / Tile.HEIGHT);
        // console.log('encounterTiles', obj, obj.x / Tile.WIDTH, obj.y / Tile.HEIGHT);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            let objCopy = JSON.parse(JSON.stringify(obj));
            objCopy.x = (objCopy.x / Tile.WIDTH) + x;
            objCopy.y = (objCopy.y / Tile.HEIGHT) + y;
            tiles.push({
              x: objCopy.x, 
              y: objCopy.y,
            });
          }
        }
      } else {
        console.log('encounterTiles::polygon', obj.name, obj.polygon);
        let polygon = obj.polygon;

        for (let i = 0; i < polygon.length; i++) {
          let point = polygon[i];
          console.log('encounterTiles::polygon', point, {
            x: (obj.x + point.x) / Tile.WIDTH,
            y: (obj.y + point.y) / Tile.HEIGHT,
          });
          tiles.push({
            x: (obj.x + point.x) / Tile.WIDTH,
            y: (obj.y + point.y) / Tile.HEIGHT,
          });
        }
      }

      tiles.forEach(obj => {
        this.scene.add
          .rectangle(
            obj.x * Tile.WIDTH, obj.y * Tile.HEIGHT,
            Tile.WIDTH, Tile.HEIGHT,
            0x00ff30, 0.5
          )
          .setOrigin(0,0)
          .setDepth(99)
        ;
      })
    });
  }
};