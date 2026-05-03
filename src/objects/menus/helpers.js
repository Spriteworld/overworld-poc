import { BasePokemon, EXPERIENCE_TABLES, GROWTH } from '@spriteworld/pokemon-data';
import TypeBadge from '../common/TypeBadge.js';
import { makeStatusIcon, STATUS_ICON_W, STATUS_ICON_H } from '../common/iconSheets.js';
import { TEXT_STYLE_SM } from './layout.js';
import { getGameDef } from '@Data/gameDef.js';

// Re-export pieces that have moved into dedicated common/ modules, so existing
// callers importing from this file keep working.
export { getMoveMeta } from '../common/moveMeta.js';
export {
  drawTypePills, measureTypePillWidth, measureTypePillsWidth,
  TYPE_PILL_H, TYPE_PILL_GAP,
} from '../common/TypePill.js';
export {
  drawTypeCategoryPill, TYPE_CAT_PILL_W, TYPE_CAT_PILL_H,
} from '../common/TypeCategoryPill.js';
export {
  drawMovesPanel, drawMoveRow, MOVES_PANEL_ROW_H,
} from '../common/MovesPanel.js';

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
  let entry = null;
  try { entry = dex.getPokemonById(mon.species); } catch { /* unknown species id */ }

  let maxHp = mon.level * 3 + 10;
  try { maxHp = new BasePokemon({ ...mon }).getMaxHp(); } catch { /* invalid mon — fall back */ }

  return { entry, maxHp, types: entry?.types ?? [] };
}

/** Draw an HP bar row into the menu container. */
export function drawHpRow(menu, x, y, width, currentHp, maxHp, hpRatio) {
  const { scene, reg } = menu;
  const labelW  = 20;
  const hpColor = hpRatio > 0.5 ? 0x48c050 : hpRatio > 0.25 ? 0xf0c040 : 0xe04040;

  // Text keeps its original optical centre; the bar graphic shifts down by
  // 3px to land on the Gen3 glyph's visual mid-line (the font has extra
  // whitespace above the glyph).
  const textCy = y + 7;
  const barTop = y + 6;

  const hpLabel = scene.add.text(x, textCy, 'HP', { ...TEXT_STYLE_SM, color: '#444444' });
  hpLabel.setOrigin(0, 0.5);
  reg(hpLabel);

  const barX = x + labelW + 2;
  const barW = width - labelW - 2 - 52;
  const track = scene.add.graphics();
  track.fillStyle(0xaaaaaa, 1);
  track.fillRoundedRect(barX, barTop, barW, 8, 3);
  track.fillStyle(hpColor, 1);
  track.fillRoundedRect(barX, barTop, Math.max(2, barW * hpRatio), 8, 3);
  reg(track);

  const hpNums = scene.add.text(x + width, textCy, `${currentHp}/${maxHp}`, { ...TEXT_STYLE_SM, align: 'right' });
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
  if (level < (getGameDef().maxLevel ?? 100)) {
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

/** Return the first active status key on a mon, or null. */
export function getActiveStatus(mon) {
  const s = mon?.status;
  if (!s) return null;
  for (const [k, v] of Object.entries(s)) if (v > 0) return k;
  return null;
}

/**
 * Draw a status icon (from the `statuses` spritesheet) centred vertically at `cy`
 * with its left edge at `x`. Returns the width drawn.
 */
export function drawStatusBadge(menu, x, cy, statusKey) {
  const { scene, reg } = menu;
  const icon = makeStatusIcon(scene, x, Math.round(cy - STATUS_ICON_H / 2), statusKey);
  if (!icon) return 0;
  reg(icon);
  return STATUS_ICON_W;
}

/** Draw a 5-point star graphic centred at (cx, cy). */
function _drawStar(scene, cx, cy, rOuter, color) {
  const rInner = rOuter * 0.45;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillPoints(points, true);
  g.lineStyle(1, 0x8a6400, 1);
  g.strokePoints(points, true);
  return g;
}

/**
 * Draw inline shiny (gold star) + pokerus (PKRS sheet icon) centred vertically at `cy`.
 * Left edge starts at `x`. Returns total width consumed.
 */
export function drawMonIndicators(menu, x, cy, mon) {
  const { scene, reg } = menu;
  let dx = x;

  if (mon?.shiny) {
    const R = 6;
    reg(_drawStar(scene, dx + R, cy, R, 0xf0c020));
    dx += R * 2 + 4;
  }

  if (mon?.pokerus) {
    const icon = makeStatusIcon(scene, dx, Math.round(cy - STATUS_ICON_H / 2), 'PKRS');
    if (icon) {
      reg(icon);
      dx += STATUS_ICON_W + 4;
    }
  }

  return dx - x;
}

/** Draw type badge(s) into the menu container. */
export function drawTypeBadges(menu, x, y, types, opts = {}) {
  (types ?? []).slice(0, 2).forEach((type, ti) => {
    menu.reg(new TypeBadge(menu.scene, x + ti * (TypeBadge.WIDTH + 4), y, type, opts));
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
