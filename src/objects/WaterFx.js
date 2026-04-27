import Phaser from 'phaser';
import { SHADER_KEYS } from '@/shaders/keys.js';

const WATER_PROP_KEY = 'sw_water';

// Trail tuning ─────────────────────────────────────────────────────────────
// Each stamp is a thin ring outline that grows from R0 → R1 over its life
// while fading out — a faint expanding ripple shed off the surf mount.
const TRAIL_R0_PX         = 4;    // ring radius at birth
const TRAIL_R1_PX         = 28;   // ring radius at death
const TRAIL_LINE_W0       = 1.6;  // ring stroke width at birth
const TRAIL_LINE_W1       = 0.6;  // ring stroke width at death
const TRAIL_MAX_ALPHA     = 0.45; // peak ring opacity — keep faint
const TRAIL_STAMP_MIN_PX  = 14;   // larger gap so concentric rings stay visible
const TRAIL_LIFE_MS       = 1800; // longer life so the expansion reads
const TRAIL_MAX_POINTS    = 48;
const TRAIL_BEHIND_PX     = 18;   // shift stamp back from the mount, opposite facing

// Unit vectors pointing OPPOSITE the player's facing direction. Same
// convention as `_behindPlayerTile` in interactables/player.js.
const BEHIND_OFFSETS = {
  up:    { x:  0, y:  1 },
  down:  { x:  0, y: -1 },
  left:  { x:  1, y:  0 },
  right: { x: -1, y:  0 },
};

export default class WaterFx {
  /**
   * Animated water surface + surf wake. Built once per scene; bails out and
   * does nothing if the floor layer has no `sw_water` tiles.
   *
   *   - Builds a map-sized mask RT (red = water) once at construction.
   *   - Owns a map-sized trail RT that's redrawn each frame from a small
   *     ring buffer of fading "stamp" points.
   *   - Applies the water post-FX pipeline to the scene camera and pushes
   *     scroll / resolution / time uniforms each tick.
   *
   * Gated by `debug.waterFx`. Reflections continue to use the sprite-based
   * Reflection system; this pipeline runs after that compositing so the
   * displacement shimmer applies to reflection sprites for free.
   */
  constructor(scene) {
    this.scene  = scene;
    this.camera = scene.cameras.main;
    this._destroyed = false;

    const floor = scene.tilemaps?.floor;
    const map   = scene.config?.tilemap;
    if (!floor || !map) { this._noWater = true; return; }

    this._mapW = map.widthInPixels;
    this._mapH = map.heightInPixels;
    this._sceneKey = scene.sys.settings.key;
    this._maskKey  = `_water_mask_${this._sceneKey}`;
    this._trailKey = `_water_trail_${this._sceneKey}`;

    if (!this._buildMask(floor)) { this._noWater = true; return; }
    this._buildTrail();

    // Apply the post-FX to the floor layer rather than the camera so the
    // displacement / caustic / trail tint only touch water tile pixels,
    // not anything rendered above (player, mount, NPCs, reflections).
    this._target = floor;
    this._target.setPostPipeline(SHADER_KEYS.WATER);
    this.pipeline = this._target.getPostPipeline(SHADER_KEYS.WATER);
    if (!this.pipeline) { this._noWater = true; return; }

    this.pipeline.setCamera?.(this.camera);
    this.pipeline.setMaskTexture?.(this._maskKey);
    this.pipeline.setTrailTexture?.(this._trailKey);
    this.pipeline.setMapSize?.(this._mapW, this._mapH);

    // Reusable scratch graphics for redrawing the trail RT each frame.
    this._trailGfx = scene.make.graphics({ add: false });

    this._points  = [];
    this._lastStamp = null;
    this._timeSec = 0;
  }

  /**
   * One-time draw: every `sw_water` tile on the floor layer painted white
   * onto a map-sized RT, then registered under `_maskKey` so the pipeline
   * can bind it as a sampler. Returns false if no water exists.
   */
  _buildMask(floor) {
    const gfx = this.scene.make.graphics({ add: false });
    gfx.fillStyle(0xffffff, 1);
    let count = 0;
    floor.forEachTile(t => {
      if (t?.properties?.[WATER_PROP_KEY]) {
        gfx.fillRect(t.pixelX, t.pixelY, t.width, t.height);
        count++;
      }
    });
    if (count === 0) {
      gfx.destroy();
      return false;
    }

    // Remove any stale entry from a prior visit to this scene — destroy()
    // skips this on scene shutdown, so re-entering the same map would
    // otherwise hit "Texture key already in use".
    if (this.scene.textures.exists(this._maskKey)) this.scene.textures.remove(this._maskKey);

    const rt = this.scene.add.renderTexture(0, 0, this._mapW, this._mapH);
    rt.setVisible(false);
    rt.draw(gfx, 0, 0);
    rt.saveTexture(this._maskKey);
    gfx.destroy();

    this._maskRT = rt;
    return true;
  }

  _buildTrail() {
    if (this.scene.textures.exists(this._trailKey)) this.scene.textures.remove(this._trailKey);

    const rt = this.scene.add.renderTexture(0, 0, this._mapW, this._mapH);
    rt.setVisible(false);
    rt.saveTexture(this._trailKey);
    this._trailRT = rt;
  }

  /**
   * Per-frame tick. Fades existing trail points, optionally stamps a new one
   * at the player's position (only while in the SURF state), redraws the
   * trail RT, and updates pipeline uniforms.
   *
   * @param {number} time   Phaser time in ms
   * @param {number} delta  ms since last frame (already game-speed-scaled)
   */
  update(time, delta) {
    if (this._destroyed || this._noWater || !this.pipeline) return;

    this._timeSec = time / 1000;

    const player = this.scene.registry.get('player');
    const inSurf = !!(
      player &&
      player.stateMachine?.currentState?.name === player.stateDef?.SURF
    );

    if (inSurf) this._maybeStamp(player);
    this._fadeAndRedraw(delta);

    this.pipeline.setTime?.(this._timeSec);
    // World-pixel uResolution — see Darkness.js for the rationale.
    const zoom = this.camera.zoom || 1;
    this.pipeline.setResolution?.(this.camera.width / zoom, this.camera.height / zoom);
    this.pipeline.setScroll?.(this.camera.scrollX, this.camera.scrollY);
  }

  /**
   * Add a new full-life trail point anchored at the surf mount's position
   * (falling back to the player's center if the mount isn't available).
   * Gated by minimum-spacing so consecutive frames don't pile rings on top
   * of each other while the player is barely moving.
   */
  _maybeStamp(player) {
    // Use getCenter() — at runtime the player sprite's origin is (0, 0)
    // (something flips it after the Player constructor's setOrigin(0.5, 0.5)),
    // so player.x/y is the top-left, not the visual centre. getCenter()
    // computes the geometric centre regardless of origin.
    const c = player.getCenter ? player.getCenter() : { x: player.x, y: player.y };
    let x = c.x;
    let y = c.y;

    // Push the stamp back from the mount in the direction opposite facing,
    // so rings shed behind the rider rather than from underneath them.
    const facing = (player.getFacingDirection?.() || 'down').toLowerCase();
    const back   = BEHIND_OFFSETS[facing] || BEHIND_OFFSETS.down;
    x += back.x * TRAIL_BEHIND_PX;
    y += back.y * TRAIL_BEHIND_PX;

    const last = this._lastStamp;
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy < TRAIL_STAMP_MIN_PX * TRAIL_STAMP_MIN_PX) return;
    }
    this._points.push({ x, y, life: 1 });
    if (this._points.length > TRAIL_MAX_POINTS) this._points.shift();
    this._lastStamp = { x, y };
  }

  /**
   * Decay every trail point's life, drop the dead ones, and repaint the
   * trail RT from the survivors as expanding ring outlines (radius grows
   * R0 → R1 over life; opacity and stroke width both fall off). Cheap:
   * ≤ TRAIL_MAX_POINTS strokeCircles per frame.
   */
  _fadeAndRedraw(delta) {
    const decay = delta / TRAIL_LIFE_MS;
    const next = [];
    for (let i = 0; i < this._points.length; i++) {
      const p = this._points[i];
      p.life -= decay;
      if (p.life > 0) next.push(p);
    }
    this._points = next;

    const rt  = this._trailRT;
    const gfx = this._trailGfx;
    if (!rt || !gfx) return;

    rt.clear();
    if (next.length === 0) return;

    gfx.clear();
    for (let i = 0; i < next.length; i++) {
      const p = next[i];
      const age   = 1 - p.life;                                       // 0 fresh → 1 dead
      const r     = TRAIL_R0_PX + (TRAIL_R1_PX - TRAIL_R0_PX) * age;
      const w     = TRAIL_LINE_W0 + (TRAIL_LINE_W1 - TRAIL_LINE_W0) * age;
      const alpha = TRAIL_MAX_ALPHA * p.life;
      gfx.lineStyle(w, 0xffffff, alpha);
      gfx.strokeCircle(p.x, p.y, r);
    }
    rt.draw(gfx, 0, 0);
  }

  /**
   * Attach the water post-FX pipeline to a sprite so it picks up the same
   * displacement / caustic / trail effect as the floor layer. Reflection
   * sprites call this from their lazy _initRendering() so character
   * reflections ripple along with the water surface beneath them.
   */
  applyToSprite(sprite) {
    if (this._destroyed || this._noWater || !sprite || !sprite.setPostPipeline) return;
    sprite.setPostPipeline(SHADER_KEYS.WATER);
  }

  /** Texture-cache key for the binary water mask, or null if no water on this map. */
  getMaskKey() { return this._noWater || this._destroyed ? null : this._maskKey; }
  /** Map size in pixels, used by other shaders to compute mask UV from world coords. */
  getMapSize() { return [this._mapW, this._mapH]; }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Same teardown caveat as Reflection / Darkness: when the scene is
    // already shutting down we can't mutate the camera's pipeline list or
    // the texture cache without risking a mid-sweep splice.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;

    if (!sceneDown) {
      this.pipeline?.setCamera?.(null);
      try { this._target?.removePostPipeline(SHADER_KEYS.WATER); } catch (_) {}
      this._trailGfx?.destroy();
      this._maskRT?.destroy();
      this._trailRT?.destroy();
      // Drop the saved-texture entries so the next visit to this scene can
      // rebuild from scratch (map dimensions or water layout may have changed).
      try { this.scene?.textures?.remove(this._maskKey); }  catch (_) {}
      try { this.scene?.textures?.remove(this._trailKey); } catch (_) {}
    }

    this.scene    = null;
    this.camera   = null;
    this.pipeline = null;
    this._target  = null;
    this._maskRT  = null;
    this._trailRT = null;
    this._trailGfx = null;
    this._points   = null;
  }
}
