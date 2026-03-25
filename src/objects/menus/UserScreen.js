import { gameState, getPlaytime } from '@Data/gameState.js';
import { SX, SY, SH, TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT } from './layout.js';

export default class UserScreen {
  constructor(menu) {
    this.menu = menu;
  }

  build() {
    const { scene, reg } = this.menu;

    const secs = Math.floor(getPlaytime());
    const h    = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m    = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s    = (secs % 60).toString().padStart(2, '0');
    const map  = this.menu.scene.registry.get('map') ?? gameState.currentMap;

    const lines = [
      gameState.playerName.toUpperCase(),
      '',
      `Playtime:  ${h}:${m}:${s}`,
      `Location:  ${map}`,
    ];

    lines.forEach((line, i) => {
      const style = i === 0 ? TEXT_STYLE_BOLD : TEXT_STYLE_BODY;
      reg(scene.add.text(SX + 16, SY + 16 + i * 22, line, style));
    });

    reg(scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }
}
