import Phaser from 'phaser';
import { makeTypeIcon, TYPE_ICON_W, TYPE_ICON_H } from './iconSheets.js';

// Legacy colour table kept for callers that still need a colour per type
// (header gradients, bar tints, etc.).
export const TYPE_COLORS = {
  normal:   0xA8A878, fire:     0xF08030, water:    0x6890F0,
  grass:    0x78C850, electric: 0xF8D030, ice:      0x98D8D8,
  fighting: 0xC03028, poison:   0xA040A0, ground:   0xE0C068,
  flying:   0xA890F0, psychic:  0xF85888, bug:      0xA8B820,
  rock:     0xB8A038, ghost:    0x705898, dragon:   0x7038F8,
  dark:     0x705848, steel:    0xB8B8D0,
};

/**
 * Container that renders a single type icon from the `types` spritesheet.
 * Kept as a class for backward-compat with existing call sites and for the
 * static WIDTH / HEIGHT used by layout code.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.circle=false] - When true, draws a white circle
 *                                        behind the icon (used on the Pokédex
 *                                        screen so the badge reads clearly
 *                                        over the gradient header).
 */
export default class TypeBadge extends Phaser.GameObjects.Container {
  static WIDTH  = TYPE_ICON_W;
  static HEIGHT = TYPE_ICON_H;

  constructor(scene, x, y, type, opts = {}) {
    super(scene, x, y);
    if (opts.circle) {
      const r = Math.min(TYPE_ICON_W, TYPE_ICON_H) / 2;
      const bg = scene.add.graphics();
      bg.fillStyle(0xffffff, 1);
      bg.fillCircle(TYPE_ICON_W / 2, TYPE_ICON_H / 2, r);
      this.add(bg);
    }
    this.add(makeTypeIcon(scene, 0, 0, type));
    scene.add.existing(this);
  }
}
