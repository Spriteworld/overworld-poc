import Phaser from 'phaser';
import {
  makeTypeIcon, makeCategoryIcon,
  TYPE_ICON_W, TYPE_ICON_H,
  CATEGORY_ICON_W, CATEGORY_ICON_H,
} from './iconSheets.js';

/**
 * Combined type/move-category pill — a single rounded rect split diagonally
 * into two trapezoids. The left trapezoid (lighter grey) holds the type icon;
 * the right trapezoid (darker grey) holds the move-category icon. Each icon
 * is masked to its trapezoid so parts crossing the divider are clipped.
 *
 * Same greys as TypePill for visual consistency.
 */

export const TYPE_CAT_PILL_W = 56;
export const TYPE_CAT_PILL_H = 26;

const _RADIUS = 5;

/** Draw the pill at (x, y). `type` / `category` are string keys (case-insensitive). */
export function drawTypeCategoryPill(menu, x, y, type, category) {
  const { scene, reg } = menu;
  const W = TYPE_CAT_PILL_W;
  const H = TYPE_CAT_PILL_H;

  // Diagonal endpoints: 75% across top, 25% across bottom.
  const dTopX = x + W * 0.75;
  const dTopY = y;
  const dBotX = x + W * 0.25;
  const dBotY = y + H;

  const leftPoly = [
    { x: x,     y: y     },
    { x: dTopX, y: dTopY },
    { x: dBotX, y: dBotY },
    { x: x,     y: y + H },
  ];
  const rightPoly = [
    { x: dTopX, y: dTopY },
    { x: x + W, y: y     },
    { x: x + W, y: y + H },
    { x: dBotX, y: dBotY },
  ];

  // Body (darker grey — category side).
  const body = scene.add.graphics();
  body.fillStyle(0x2a2a2a, 1);
  body.fillRoundedRect(x, y, W, H, _RADIUS);
  reg(body);

  // Lighter grey overlay on the left trapezoid, pill-clipped.
  const light = scene.add.graphics();
  light.fillStyle(0x454545, 1);
  light.fillPoints(leftPoly, true);
  reg(light);
  light.setMask(_makeRoundedRectMask(scene, x, y, W, H, _RADIUS, light));

  // Icons anchored near each trapezoid's centroid.
  if (type) {
    const tX = x + Math.round(W * 0.27 - TYPE_ICON_W / 2);
    const tY = y + Math.round(H * 0.42 - TYPE_ICON_H / 2);
    const icon = makeTypeIcon(scene, tX, tY, type);
    if (icon) {
      icon.setMask(_makePolygonMask(scene, leftPoly, icon));
      reg(icon);
    }
  }
  if (category) {
    const cX = x + Math.round(W * 0.73 - CATEGORY_ICON_W / 2);
    const cY = y + Math.round(H * 0.58 - CATEGORY_ICON_H / 2);
    const icon = makeCategoryIcon(scene, cX, cY, category);
    if (icon) {
      icon.setMask(_makePolygonMask(scene, rightPoly, icon));
      reg(icon);
    }
  }

  // Diagonal divider line.
  const line = scene.add.graphics();
  line.lineStyle(1, 0x181818, 1);
  line.lineBetween(dTopX, dTopY, dBotX, dBotY);
  reg(line);
}

function _makePolygonMask(scene, points, owner) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillPoints(points, true);
  if (owner) owner.once('destroy', () => g.destroy());
  return new Phaser.Display.Masks.GeometryMask(scene, g);
}

function _makeRoundedRectMask(scene, x, y, w, h, r, owner) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(x, y, w, h, r);
  if (owner) owner.once('destroy', () => g.destroy());
  return new Phaser.Display.Masks.GeometryMask(scene, g);
}
