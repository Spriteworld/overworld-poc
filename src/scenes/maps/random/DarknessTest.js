import { GameMap, Tile } from '@Objects';
import { DarknessTestMap } from '@Maps';

const RANDOM_LIGHT_COUNT = 5;

const PALETTES = [
  '#FF6600', '#4488FF', '#FF4444', '#44FF88',
  '#FFDD44', '#FF88FF', '#88FFFF', '#FFAA00',
  '#FF2200', '#FFFFFF', '#7FFFD4', '#FFB347',
];

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'DarknessTest',
      map: DarknessTestMap,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    this.loadMap();
    this.createCharacters();
    this._addRandomLights();
  }

  _addRandomLights() {
    if (!this.darkness) return;

    const mapW = this.config.map.width;
    const mapH = this.config.map.height;

    for (let i = 0; i < RANDOM_LIGHT_COUNT; i++) {
      const tx = 2 + Math.floor(Math.random() * (mapW - 4));
      const ty = 2 + Math.floor(Math.random() * (mapH - 4));
      const px = tx * Tile.WIDTH + Tile.WIDTH / 2;
      const py = ty * Tile.HEIGHT + Tile.HEIGHT / 4;
      const color = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const radius = 50 + Math.floor(Math.random() * 100);
      const intensity = 0.1 + Math.random() * 0.2;
      const light = this.add
        .pointlight(px, py, '0x' + color.substr(1), radius, intensity, 0.06)
        .setDepth(9999);

      if (i === 0) {
        this.tweens.add({
          targets: light,
          radius: radius * 3,
          intensity: intensity * 2,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
          duration: 5000,
        });
      }

      this.darkness.registerLight(
        () => light.x,
        () => light.y,
        () => light.radius * 0.6,
      );
    }
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }
}
