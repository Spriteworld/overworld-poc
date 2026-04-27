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
    const fullW = 25 * Tile.WIDTH;
    const fullH = 19 * Tile.HEIGHT;
    const halfW = Math.floor(fullW / 2);

    const cam = this.cameras.main;
    cam.setViewport(0, 0, halfW, fullH);
    cam.setSize(halfW, fullH);

    const player = this.registry.get('player');
    const smoothCam = !!this.game.config.debug?.smoothCam;
    const lerp = smoothCam ? 0.3 : 1;
    const fox = player ? -(player.width / 2) : 0;
    const foy = player ? -(player.height / 2) : 0;

    this._camRight = this.cameras.add(halfW, 0, fullW - halfW, fullH);
    if (player) {
      this._camRight.startFollow(player, true, lerp, lerp);
      this._camRight.setFollowOffset(fox, foy);
    }
    this._camRight.setSize(fullW - halfW, fullH);

    // Move the WaterFx pipeline from the floor layer onto the left camera.
    // The water mask texture still limits the effect to water pixels, so the
    // visual result is the same — but now the right camera is pipeline-free.
    const floor = this.tilemaps?.floor;
    if (floor && this.waterFx?.pipeline) {
      floor.removePostPipeline(SHADER_KEYS.WATER);

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

  update(time, delta) {
    this.updateCharacters(time, delta);
  }

  destroy() {
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
