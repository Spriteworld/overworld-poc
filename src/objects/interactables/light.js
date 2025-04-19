import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (Debug.functions.interactables.light) {
      console.log('Interactables::light');
    }
    let lights = this.scene.findInteractions('light');
    if (lights.length === 0) { return; }

    lights.forEach(obj => {
      this.scene.add
        .pointlight(
          obj.x + (Tile.WIDTH / 2),
          obj.y + (Tile.HEIGHT / 4),
          '0x'+getPropertyValue(obj.properties, 'color', '#ffffff').substr(1),
          getPropertyValue(obj.properties, 'radius', 100),
          getPropertyValue(obj.properties, 'intensity', 0.2),
          getPropertyValue(obj.properties, 'attenuation', 0.06)
        )
        .setDepth(9999)
        .setName(obj.name)
      ;
    });
  }
};