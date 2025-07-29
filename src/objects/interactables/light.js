import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
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
      let radius = getPropertyValue(obj.properties, 'radius', 100);
      let intensity = getPropertyValue(obj.properties, 'intensity', 0.2);

      let light = this.scene.add
        .pointlight(
          obj.x + (Tile.WIDTH / 2),
          obj.y + (Tile.HEIGHT / 4),
          '0x'+getPropertyValue(obj.properties, 'color', '#ffffff').substr(1),
          radius,
          intensity,
          getPropertyValue(obj.properties, 'attenuation', 0.06)
        )
        .setDepth(9999)
        .setName(obj.name)
      ;

      let glow = getPropertyValue(obj.properties, 'glow', false);
      if (glow !== false) {
        this.scene.tweens.add({
          targets: light,
          radius: radius * 3,
          intensity: intensity * 2,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
          duration: 5000
        });
      }
    });
  }
};