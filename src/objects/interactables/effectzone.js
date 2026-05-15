import * as Tile from '@Objects/Tile.js';
import { getPropertyValue } from '@Utilities';
import { SHADER_KEYS } from '@Worlds/_base/shaders/keys.js';
import Darkness from '@Objects/Darkness.js';
import RainFx, { RAIN_VARIANTS } from '@Objects/RainFx.js';
import FogFx, { FOG_VARIANTS } from '@Objects/FogFx.js';
import SandstormFx, { SANDSTORM_VARIANTS } from '@Objects/SandstormFx.js';
import SnowFx, { SNOW_VARIANTS } from '@Objects/SnowFx.js';
import SunlightFx, { SUNLIGHT_VARIANTS } from '@Objects/SunlightFx.js';

const EFFECT_TYPE_MAP = {
  darkness:       { category: 'darkness' },
  light_rain:     { category: 'rain',       cfg: RAIN_VARIANTS.light_rain },
  heavy_rain:     { category: 'heavy_rain', cfg: RAIN_VARIANTS.heavy_rain },
  fog:            { category: 'fog',        cfg: FOG_VARIANTS.fog },
  light_fog:      { category: 'fog',        cfg: FOG_VARIANTS.light_fog },
  sandstorm:      { category: 'sandstorm',  cfg: SANDSTORM_VARIANTS.sandstorm },
  snow:           { category: 'snow',       cfg: SNOW_VARIANTS.snow },
  heavy_snow:     { category: 'heavy_snow', cfg: SNOW_VARIANTS.heavy_snow },
  harsh_sunlight: { category: 'sunlight',   cfg: SUNLIGHT_VARIANTS.harsh_sunlight },
};

const FEATHER_SPREAD = 1.5; // mask-pixel spread per ring (1 mask px = 1 tile)

export default class {
  constructor(scene) {
    this.scene = scene;
    this._maskRTs = [];
    this._maskKeys = [];
  }

  init() {
    const zones = this.scene.findInteractions('effect_zone');
    if (zones.length === 0) return;

    const grouped = {};
    zones.forEach(obj => {
      const effectType = getPropertyValue(obj.properties, 'effect_type', null);
      if (!effectType) return;
      const entry = EFFECT_TYPE_MAP[effectType];
      if (!entry) return;
      if (!grouped[effectType]) grouped[effectType] = [];
      grouped[effectType].push(obj);
    });

    const map = this.scene.config.tilemap;
    const mapW = map.widthInPixels;
    const mapH = map.heightInPixels;
    const tilesW = map.width;
    const tilesH = map.height;

    for (const [effectType, objs] of Object.entries(grouped)) {
      const { category, cfg } = EFFECT_TYPE_MAP[effectType];

      if (category === 'darkness' && this.scene.darkness) continue;
      if (category === 'rain' && this.scene.rainFx) continue;
      if (category === 'heavy_rain' && this.scene.heavyRainFx) continue;
      if (category === 'fog' && this.scene.fogFx) continue;
      if (category === 'sandstorm' && this.scene.sandstormFx) continue;
      if (category === 'snow' && this.scene.snowFx) continue;
      if (category === 'heavy_snow' && this.scene.heavySnowFx) continue;
      if (category === 'sunlight' && this.scene.sunlightFx) continue;

      const feather = getPropertyValue(objs[0].properties, 'feather', 0);
      const maskKey = `_zone_mask_${this.scene.sys.settings.key}_${effectType}`;
      const maskRT = this._buildMask(objs, maskKey, tilesW, tilesH, feather);
      if (!maskRT) continue;

      this._maskRTs.push(maskRT);
      this._maskKeys.push(maskKey);

      if (category === 'darkness') {
        this.scene.darkness = new Darkness(this.scene);
        this.scene.darkness.setZoneMask(maskKey, mapW, mapH);
        const lightPlugin = this.scene.mapPlugins['light'];
        if (lightPlugin) {
          lightPlugin.getLights().forEach(light => {
            if (!light._darknessSpec) {
              light._darknessSpec = this.scene.darkness.registerLight(
                () => light.x,
                () => light.y,
                () => light.radius * 0.6,
              );
            }
          });
        }
      } else {
        if (!cfg) continue;

        let fx;
        switch (category) {
          case 'rain':
            fx = new RainFx(this.scene, cfg);
            this.scene.rainFx = fx;
            break;
          case 'heavy_rain':
            fx = new RainFx(this.scene, { ...cfg, shaderKey: SHADER_KEYS.HEAVY_RAIN });
            this.scene.heavyRainFx = fx;
            break;
          case 'fog':
            fx = new FogFx(this.scene, cfg);
            this.scene.fogFx = fx;
            break;
          case 'sandstorm':
            fx = new SandstormFx(this.scene, cfg);
            this.scene.sandstormFx = fx;
            break;
          case 'snow':
            fx = new SnowFx(this.scene, cfg);
            this.scene.snowFx = fx;
            break;
          case 'heavy_snow':
            fx = new SnowFx(this.scene, { ...cfg, shaderKey: SHADER_KEYS.HEAVY_SNOW });
            this.scene.heavySnowFx = fx;
            break;
          case 'sunlight':
            fx = new SunlightFx(this.scene, cfg);
            this.scene.sunlightFx = fx;
            break;
        }
        if (fx?.pipeline?.setZoneMask) {
          fx.pipeline.setZoneMask(maskKey, mapW, mapH);
        }
        if (fx?._puddlePipeline?.setZoneMask) {
          fx._puddlePipeline.setZoneMask(maskKey, mapW, mapH);
        }
      }
    }
  }

  _buildMask(objs, maskKey, tilesW, tilesH, feather) {
    const gfx = this.scene.make.graphics({ add: false });
    gfx.fillStyle(0xffffff, 1);

    objs.forEach(obj => {
      const shape = obj.polygon ?? obj.polyline ?? null;
      if (shape) {
        const abs = shape.map(pt => ({
          x: (obj.x + pt.x) / Tile.WIDTH,
          y: (obj.y + pt.y) / Tile.HEIGHT,
        }));
        gfx.beginPath();
        gfx.moveTo(abs[0].x, abs[0].y);
        for (let i = 1; i < abs.length; i++) gfx.lineTo(abs[i].x, abs[i].y);
        gfx.closePath();
        gfx.fillPath();
      } else {
        gfx.fillRect(
          obj.x / Tile.WIDTH,
          obj.y / Tile.HEIGHT,
          obj.width / Tile.WIDTH,
          obj.height / Tile.HEIGHT,
        );
      }
    });

    if (this.scene.textures.exists(maskKey)) this.scene.textures.remove(maskKey);

    const rt = this.scene.add.renderTexture(0, 0, tilesW, tilesH);
    rt.setVisible(false);

    if (feather > 0) {
      for (let ring = feather; ring >= 1; ring--) {
        const spread = ring * FEATHER_SPREAD;
        const alpha = 0.25 / ring;
        gfx.setAlpha(alpha);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          rt.draw(gfx, Math.cos(angle) * spread, Math.sin(angle) * spread);
        }
      }
    }

    gfx.setAlpha(1);
    rt.draw(gfx, 0, 0);

    rt.saveTexture(maskKey);
    gfx.destroy();

    return rt;
  }

  update() {}

  destroy() {
    this._maskKeys.forEach(key => {
      if (this.scene?.textures?.exists(key)) {
        this.scene.textures.remove(key);
      }
    });
    this._maskRTs.forEach(rt => rt?.destroy());
    this._maskRTs = [];
    this._maskKeys = [];
  }
}
