import Darkness from '@Objects/Darkness.js';
import { Tile } from '@Objects';

const GLOW_DURATION_MS  = 5000;
const GLOW_RADIUS_MULT  = 3;
const GLOW_INTENSITY_MULT = 2;

/**
 * Resolve a script-supplied radius into pixels. Defaults to tile units;
 * pass `pixels: true` to interpret the number as raw pixels instead.
 */
function resolveRadius(cmd) {
  const r = cmd.radius;
  if (typeof r !== 'number') return null;
  return cmd.pixels ? r : r * Tile.WIDTH;
}

/** Duck-test for a Phaser PointLight (no stable type tag is exported). */
function isPointLight(obj) {
  return !!obj
    && typeof obj.radius      === 'number'
    && typeof obj.intensity   === 'number'
    && typeof obj.attenuation === 'number';
}

/**
 * Walk all PointLight children currently on the scene and register each one
 * with the darkness overlay. Used when darkness is enabled mid-scene — the
 * Light interactable's init() ran earlier without a darkness instance to
 * register against, so the torches need to be rebound here.
 */
function registerExistingLights(scene) {
  if (!scene.darkness || !scene.children?.list) return;
  for (const obj of scene.children.list) {
    if (isPointLight(obj) && !obj._darknessSpec) {
      obj._darknessSpec = scene.darkness.registerLight(
        () => obj.x,
        () => obj.y,
        () => obj.radius * 0.6,
      );
    }
  }
}

/** Resolve `#rrggbb`, `0xrrggbb`, or `rrggbb` into a 24-bit integer. */
function parseColor(s) {
  if (typeof s === 'number') return s & 0xffffff;
  if (typeof s !== 'string') return null;
  const hex = s.replace(/^#/, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

function applyColor(light, hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  // Phaser PointLight.color exposes either setFromRGB({r,g,b}) (newer) or
  // setTo(r,g,b) (older). Fall back to direct assignment if neither exists.
  if (typeof light.color?.setFromRGB === 'function') {
    light.color.setFromRGB({ r, g, b });
  } else if (typeof light.color?.setTo === 'function') {
    light.color.setTo(r, g, b);
  } else if (light.color) {
    light.color.r = r; light.color.g = g; light.color.b = b;
  }
}

function startGlow(scene, light) {
  const baseR = light.radius;
  const baseI = light.intensity;
  light._darknessBase = { radius: baseR, intensity: baseI };
  light._darknessGlowOn = true;
  scene.tweens.add({
    targets:   light,
    radius:    baseR * GLOW_RADIUS_MULT,
    intensity: baseI * GLOW_INTENSITY_MULT,
    ease:      'Sine.easeInOut',
    yoyo:      true,
    repeat:    -1,
    duration:  GLOW_DURATION_MS,
  });
}

/**
 * Stop any tween currently driving this light. If a glow tween was active,
 * snap radius/intensity back to the captured base so subsequent set_light
 * tweens don't start from whatever phase the killed glow happened to be at.
 */
function stopAllTweens(scene, light) {
  scene.tweens.killTweensOf(light);
  if (light._darknessGlowOn && light._darknessBase) {
    light.radius    = light._darknessBase.radius;
    light.intensity = light._darknessBase.intensity;
  }
  light._darknessGlowOn = false;
}

export default {
  /**
   * Enable the darkness overlay on the current scene. Idempotent — does
   * nothing if darkness is already active.
   *
   * Optional fields:
   *   - radius:   initial player radius in tiles (or pixels if pixels:true)
   *   - duration: ms to tween into the radius (only applies if radius set)
   *   - pixels:   when true, treat `radius` as raw pixels
   */
  darkness_enable(runner, cmd) {
    const scene = runner._scene;
    if (!scene.darkness) {
      scene.darkness = new Darkness(scene);
      registerExistingLights(scene);
    }
    const px = resolveRadius(cmd);
    if (px != null) {
      scene.darkness.setRadius(px, cmd.duration ?? 0, () => runner._step());
      return;
    }
    runner._step();
  },

  /**
   * Disable the darkness overlay on the current scene. Idempotent.
   * Optional `duration` fades the player radius up to a wide value before
   * tearing the overlay down — gives a gentler "lights coming on" feel
   * than an instant cut.
   */
  darkness_disable(runner, cmd) {
    const scene = runner._scene;
    const dark  = scene.darkness;
    if (!dark) { runner._step(); return; }

    const finish = () => {
      dark.destroy();
      scene.darkness = null;
      runner._step();
    };

    const duration = cmd.duration ?? 0;
    if (duration > 0) {
      // Tween out: a very wide radius dissolves the dark areas, then we
      // detach the pipeline. Keeping the pipeline alive for the tween
      // avoids a one-frame snap-to-black at the start.
      const wide = Math.max(scene.cameras.main.width, scene.cameras.main.height) * 1.5;
      dark.setRadius(wide, duration, finish);
      return;
    }
    finish();
  },

  /**
   * Set the player's darkness radius. Requires darkness to already be
   * active. Same `radius` / `duration` / `pixels` fields as enable.
   */
  darkness_set_radius(runner, cmd) {
    const scene = runner._scene;
    const dark  = scene.darkness;
    if (!dark) {
      console.warn('[ScriptRunner] darkness_set_radius: no darkness on scene');
      runner._step();
      return;
    }
    const px = resolveRadius(cmd);
    if (px == null) {
      console.warn('[ScriptRunner] darkness_set_radius: missing "radius"');
      runner._step();
      return;
    }
    dark.setRadius(px, cmd.duration ?? 0, () => runner._step());
  },

  /**
   * Add a new pointlight to the scene (and register it with the darkness
   * overlay if active). Position fields default to tile coordinates; pass
   * `pixels: true` to use raw pixels instead. The position offset matches
   * the Tiled `light` object: horizontal centre of the tile, 1/4 down from
   * the top — same place Tiled-placed torches sit.
   */
  add_light(runner, cmd) {
    const scene = runner._scene;
    if (!cmd.name) {
      console.warn('[ScriptRunner] add_light: missing "name"');
      runner._step();
      return;
    }
    if (scene.children?.getByName?.(cmd.name)) {
      console.warn(`[ScriptRunner] add_light: name "${cmd.name}" already in use`);
      runner._step();
      return;
    }

    const tx = cmd.x ?? 0;
    const ty = cmd.y ?? 0;
    const px = cmd.pixels ? tx : tx * Tile.WIDTH  + Tile.WIDTH  / 2;
    const py = cmd.pixels ? ty : ty * Tile.HEIGHT + Tile.HEIGHT / 4;

    const radius      = cmd.radius      ?? 100;
    const intensity   = cmd.intensity   ?? 0.2;
    const attenuation = cmd.attenuation ?? 0.06;
    const colorHex    = parseColor(cmd.color) ?? 0xffffff;

    const light = scene.add
      .pointlight(px, py, colorHex, radius, intensity, attenuation)
      .setDepth(9999)
      .setName(cmd.name);

    light._darknessBase = { radius, intensity };
    if (cmd.glow) startGlow(scene, light);

    if (scene.darkness) {
      light._darknessSpec = scene.darkness.registerLight(
        () => light.x,
        () => light.y,
        () => light.radius * 0.6,
      );
    }

    runner._step();
  },

  /**
   * Remove a pointlight by name. Unregisters from the darkness overlay
   * and kills any tweens (including the glow loop). Idempotent — warns
   * but does not abort if the name doesn't exist.
   */
  remove_light(runner, cmd) {
    const scene = runner._scene;
    if (!cmd.name) {
      console.warn('[ScriptRunner] remove_light: missing "name"');
      runner._step();
      return;
    }
    const light = scene.children?.getByName?.(cmd.name);
    if (!isPointLight(light)) {
      console.warn(`[ScriptRunner] remove_light: "${cmd.name}" not found`);
      runner._step();
      return;
    }
    if (light._darknessSpec && scene.darkness) {
      scene.darkness.unregisterLight(light._darknessSpec);
      light._darknessSpec = null;
    }
    scene.tweens.killTweensOf(light);
    light.destroy();
    runner._step();
  },

  /**
   * Mutate an existing pointlight's settings. Numeric fields (`radius`,
   * `intensity`, `attenuation`) optionally tween over `duration` ms; color
   * is always applied instantly. Setting `glow` toggles the pulsing tween.
   *
   * Any in-flight tween on the light (including a running glow) is killed
   * before the new values are applied. If `glow` is omitted, the previous
   * glow state is restored after the tween settles using the post-set
   * radius/intensity as the new glow base.
   */
  set_light(runner, cmd) {
    const scene = runner._scene;
    if (!cmd.name) {
      console.warn('[ScriptRunner] set_light: missing "name"');
      runner._step();
      return;
    }
    const light = scene.children?.getByName?.(cmd.name);
    if (!isPointLight(light)) {
      console.warn(`[ScriptRunner] set_light: "${cmd.name}" not found`);
      runner._step();
      return;
    }

    const wasGlowing = !!light._darknessGlowOn;
    stopAllTweens(scene, light);

    if (cmd.color != null) {
      const c = parseColor(cmd.color);
      if (c != null) applyColor(light, c);
    }

    const wantGlow = cmd.glow ?? wasGlowing;
    const tweenProps = {};
    if (typeof cmd.radius      === 'number') tweenProps.radius      = cmd.radius;
    if (typeof cmd.intensity   === 'number') tweenProps.intensity   = cmd.intensity;
    if (typeof cmd.attenuation === 'number') tweenProps.attenuation = cmd.attenuation;

    const duration = cmd.duration ?? 0;
    const hasNumericChange = Object.keys(tweenProps).length > 0;

    const finishUp = () => {
      if (wantGlow) startGlow(scene, light);
      runner._step();
    };

    if (hasNumericChange && duration > 0) {
      scene.tweens.add({
        targets: light,
        ...tweenProps,
        duration,
        ease: 'Quad.easeOut',
        onComplete: finishUp,
      });
    } else {
      if (hasNumericChange) Object.assign(light, tweenProps);
      finishUp();
    }
  },
};
