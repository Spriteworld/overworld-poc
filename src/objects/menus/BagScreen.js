import { gameState } from '@Data/gameState.js';
import { SX, SY, SH, TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT } from './layout.js';

export default class BagScreen {
  constructor(menu) {
    this.menu = menu;
  }

  build() {
    const { scene, reg } = this.menu;
    const { items, pokeballs, tms } = gameState.bag;
    const all = [...items, ...pokeballs, ...tms];

    reg(scene.add.text(SX + 16, SY + 16, 'BAG', TEXT_STYLE_BOLD));

    if (all.length === 0) {
      reg(scene.add.text(SX + 16, SY + 52, 'Bag is empty.', TEXT_STYLE_BODY));
    } else {
      all.forEach((entry, i) => {
        const line = `${(entry.name ?? 'Item').padEnd(16)}  x${entry.quantity ?? 1}`;
        reg(scene.add.text(SX + 16, SY + 52 + i * 22, line, TEXT_STYLE_BODY));
      });
    }

    reg(scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }
}
