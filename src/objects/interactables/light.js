import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
    // Live list of pointlights created on this map. Read by Darkness +
    // TimeOverlayFx (the latter uses them to undo nighttime desaturation
    // in their area of effect).
    this.lights = [];
  }

  /** Active pointlights on this map. May be empty if no light objects, or
   *  if outdoor + day + nighttimeLightsOnly suppressed creation. */
  getLights() { return this.lights; }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::light');
    }
    let lights = this.scene.findInteractions('light');
    if (lights.length === 0) { return; }

    // The "nighttime only" debug toggle suppresses ambient outdoor torches
    // during the day, but dark caves (can_see=false) need their lights up
    // regardless of time-of-day — the darkness overlay is permanently on
    // there and skipping the lights would leave the metaball field with
    // only the player as a punch-through source.
    if (this.scene.game.config.debug.nighttimeLightsOnly === true && !this.scene.darkness) {
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

      // Track base radius/intensity on the light so script commands can
      // reset the glow tween cleanly without inheriting whatever phase the
      // existing tween left behind.
      light._darknessBase = { radius, intensity };

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
        light._darknessGlowOn = true;
      }

      if (this.scene.darkness) {
        // Stash the spec handle on the light so remove_light can unregister
        // it from the darkness overlay when destroying the pointlight.
        light._darknessSpec = this.scene.darkness.registerLight(
          () => light.x,
          () => light.y,
          () => light.radius * 0.6,
        );
      }

      this.lights.push(light);
      light.once('destroy', () => {
        const i = this.lights.indexOf(light);
        if (i >= 0) this.lights.splice(i, 1);
      });
    });
  }
};