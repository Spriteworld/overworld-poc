import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.functions.interactables.light || this.scene.game.config.debug.functions.interactableShout) {
      console.log('Interactables::light');
    }
    let lights = this.scene.findInteractions('light');
    if (lights.length === 0) { return; }

    if (this.scene.game.config.debug.nighttimeLightsOnly === true) {
      if (this.scene.scene.get('TimeOverlay').time.day) {
        return;
      }
    }

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