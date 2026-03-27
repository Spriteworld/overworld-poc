import { BasePokemon, EXPERIENCE_TABLES, GROWTH } from '@spriteworld/pokemon-data';
import TypeBadge from '../common/TypeBadge.js';
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

  const barMidY = y + 3 + 4; // vertical centre of the 8px bar

  const hpLabel = scene.add.text(x, barMidY, 'HP', { ...TEXT_STYLE_SM, color: '#444444' });
  hpLabel.setOrigin(0, 0.5);
  reg(hpLabel);

  const barX = x + labelW + 2;
  const barW = width - labelW - 2 - 52;
  const track = scene.add.graphics();
  track.fillStyle(0xaaaaaa, 1);
  track.fillRoundedRect(barX, y + 3, barW, 8, 3);
  track.fillStyle(hpColor, 1);
  track.fillRoundedRect(barX, y + 3, Math.max(2, barW * hpRatio), 8, 3);
  reg(track);

  const hpNums = scene.add.text(x + width, barMidY, `${currentHp}/${maxHp}`, { ...TEXT_STYLE_SM, align: 'right' });
  hpNums.setOrigin(1, 0.5);
  reg(hpNums);
}

/** Draw an EXP bar row into the menu container. */
export function drawExpRow(menu, x, y, width, mon, entry) {
  const { scene, reg } = menu;
  const growth = entry?.growth ?? GROWTH.MEDIUM_FAST;
  const table  = EXPERIENCE_TABLES[growth] ?? EXPERIENCE_TABLES[GROWTH.MEDIUM_FAST];
  const level  = mon.level ?? 1;
  const exp    = mon.exp   ?? 0;

  let ratio = 1;
  if (level < 100) {
    const lo = table[level - 1] ?? 0;
    const hi = table[level]     ?? lo + 1;
    // Default exp to the level floor so uninitialized mons show 0% rather than negative
    ratio = hi > lo ? Math.max(0, Math.min(1, ((exp || lo) - lo) / (hi - lo))) : 0;
  }

  const labelW = 24;
  const barX   = x + labelW + 2;
  const barW   = width - labelW - 2;

  reg(scene.add.text(x, y, 'EXP', { ...TEXT_STYLE_SM, color: '#444444' }));

  const track = scene.add.graphics();
  track.fillStyle(0xaaaaaa, 1);
  track.fillRoundedRect(barX, y + 3, barW, 5, 2);
  if (ratio > 0) {
    track.fillStyle(0x4848f8, 1);
    track.fillRoundedRect(barX, y + 3, Math.max(2, barW * ratio), 5, 2);
  }
  reg(track);
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
