import { BasePokemon } from '@spriteworld/pokemon-data';
import TypeBadge from '../TypeBadge.js';
import { TEXT_STYLE_SM } from './layout.js';

/** Returns slot bg/border colors for a given interaction state. */
export function slotColors(state) {
  switch (state) {
    case 'selected': return { bg: 0xfff5cc, border: 0xffcc00, lw: 3 };
    case 'cursor':   return { bg: 0xdce8f0, border: 0x3399ff, lw: 3 };
    case 'target':   return { bg: 0xd4f0d4, border: 0x44aa44, lw: 3 };
    default:         return { bg: 0xdce8f0, border: 0x181818, lw: 2 };
  }
}

/** Resolve species entry, maxHp, and types from a party mon config. */
export function resolveMonData(dex, mon) {
  try {
    const entry = dex.getPokemonById(mon.species);
    const bp    = new BasePokemon({ ...mon });
    return { entry, maxHp: bp.getMaxHp(), types: entry.types ?? [] };
  } catch {
    return { entry: null, maxHp: mon.level * 3 + 10, types: [] };
  }
}

/** Draw an HP bar row into the menu container. */
export function drawHpRow(menu, x, y, width, currentHp, maxHp, hpRatio) {
  const { scene, reg } = menu;
  const labelW  = 20;
  const hpColor = hpRatio > 0.5 ? 0x48c050 : hpRatio > 0.25 ? 0xf0c040 : 0xe04040;

  reg(scene.add.text(x, y, 'HP', { ...TEXT_STYLE_SM, color: '#444444' }));

  const barX = x + labelW + 2;
  const barW = width - labelW - 2 - 52;
  const track = scene.add.graphics();
  track.fillStyle(0xaaaaaa, 1);
  track.fillRoundedRect(barX, y + 3, barW, 8, 3);
  track.fillStyle(hpColor, 1);
  track.fillRoundedRect(barX, y + 3, Math.max(2, barW * hpRatio), 8, 3);
  reg(track);

  const hpNums = scene.add.text(x + width, y, `${currentHp}/${maxHp}`, { ...TEXT_STYLE_SM, align: 'right' });
  hpNums.setOrigin(1, 0);
  reg(hpNums);
}

/** Draw type badge(s) into the menu container. */
export function drawTypeBadges(menu, x, y, types) {
  (types ?? []).slice(0, 2).forEach((type, ti) => {
    menu.reg(new TypeBadge(menu.scene, x + ti * (TypeBadge.WIDTH + 4), y, type));
  });
}

/** Draw a mini Pokéball graphic centred at (cx, cy). Returns the Graphics object. */
export function drawMiniBall(scene, cx, cy, r) {
  const g = scene.add.graphics();
  g.fillStyle(0xee1111, 1);
  g.beginPath(); g.arc(cx, cy, r, Math.PI, 0, false); g.closePath(); g.fillPath();
  g.fillStyle(0xffffff, 1);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI, false); g.closePath(); g.fillPath();
  g.lineStyle(1, 0x111111, 1);
  g.strokeCircle(cx, cy, r);
  g.lineBetween(cx - r, cy, cx + r, cy);
  g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 2);
  g.lineStyle(1, 0x111111, 1); g.strokeCircle(cx, cy, 2);
  return g;
}
