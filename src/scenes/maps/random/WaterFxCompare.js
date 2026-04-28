import { GameMap, Tile } from '@Objects';
import { KantoRoute21Map } from '@Maps';
import { SHADER_KEYS } from '@/shaders/keys.js';
import store from '@/store/index.js';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'WaterFxCompare',
      map: KantoRoute21Map,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    store.commit('game/SET_ON_SURF', true);
    this.loadMap();
    this.createCharacters();
    this._setupSplitView();
  }

  _setupSplitView() {
    // Split the full canvas in half so the comparison fills the screen at
    // any resolution. Hardcoded 25×19 tiles (= 800×608) used to match the
    // old 800x600 canvas; at 1920×1024 it left most of the screen blank.
    this._applySplitLayout();
    this.scale.on('resize', this._onResize, this);

    const player = this.registry.get('player');
    const smoothCam = !!this.game.config.debug?.smoothCam;
    const lerp = smoothCam ? 0.3 : 1;
    const fox = player ? -(player.width / 2) : 0;
    const foy = player ? -(player.height / 2) : 0;

    const halfW = Math.floor(this.scale.width / 2);
    const fullH = this.scale.height;
    this._camRight = this.cameras.add(halfW, 0, this.scale.width - halfW, fullH);
    if (player) {
      this._camRight.startFollow(player, true, lerp, lerp);
      this._camRight.setFollowOffset(fox, foy);
    }

    // Match zoom on both cameras so left + right show the same world content.
    const targetTilesWide = 22; // half of the standard ~42-tile target
    const zoom = Math.max(1, halfW / (targetTilesWide * Tile.WIDTH));
    this.cameras.main.setZoom(zoom);
    this._camRight.setZoom(zoom);

    // Move the WaterFx pipeline from the floor layer onto the left camera.
    // The water mask texture still limits the effect to water pixels, so the
    // visual result is the same — but now the right camera is pipeline-free.
    const floor = this.tilemaps?.floor;
    if (floor && this.waterFx?.pipeline) {
      floor.removePostPipeline(SHADER_KEYS.WATER);

      const cam = this.cameras.main;
      cam.setPostPipeline(SHADER_KEYS.WATER);
      const pipe = cam.getPostPipeline(SHADER_KEYS.WATER);
      if (pipe) {
        this.waterFx.pipeline = pipe;
        this.waterFx._target = cam;
        this.waterFx.camera = cam;
        pipe.setCamera?.(cam);
        pipe.setMaskTexture?.(this.waterFx.getMaskKey?.());
        pipe.setTrailTexture?.(this.waterFx._trailKey);
        const [mw, mh] = this.waterFx.getMapSize?.() ?? [0, 0];
        pipe.setMapSize?.(mw, mh);
      }
    }
  }

  _applySplitLayout() {
    const fullW = this.scale.width;
    const fullH = this.scale.height;
    const halfW = Math.floor(fullW / 2);
    this.cameras.main.setViewport(0, 0, halfW, fullH);
    this.cameras.main.setSize(halfW, fullH);
    if (this._camRight) {
      this._camRight.setViewport(halfW, 0, fullW - halfW, fullH);
      this._camRight.setSize(fullW - halfW, fullH);
    }
  }

  _onResize() {
    this._applySplitLayout();
    const halfW = Math.floor(this.scale.width / 2);
    const targetTilesWide = 22;
    const zoom = Math.max(1, halfW / (targetTilesWide * Tile.WIDTH));
    this.cameras.main.setZoom(zoom);
    this._camRight?.setZoom(zoom);
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }

  destroy() {
    this.scale.off('resize', this._onResize, this);
    if (this._camRight) {
      const status = this.sys?.settings?.status;
      const sceneDown = typeof status === 'number' && status >= 8;
      if (!sceneDown) {
        try { this.cameras.remove(this._camRight); } catch (_) {}
      }
      this._camRight = null;
    }
  }
}
