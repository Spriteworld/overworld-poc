import Phaser from 'phaser';

export const TYPE_COLORS = {
  normal:   0xA8A878, fire:     0xF08030, water:    0x6890F0,
  grass:    0x78C850, electric: 0xF8D030, ice:      0x98D8D8,
  fighting: 0xC03028, poison:   0xA040A0, ground:   0xE0C068,
  flying:   0xA890F0, psychic:  0xF85888, bug:      0xA8B820,
  rock:     0xB8A038, ghost:    0x705898, dragon:   0x7038F8,
  dark:     0x705848, steel:    0xB8B8D0,
};

const W = 44;
const H = 14;

/**
 * A coloured pill badge displaying a Pokémon type name.
 * Extends Container so it can be added to any scene or parent container.
 *
 * Usage:
 *   const badge = new TypeBadge(scene, x, y, 'grass');
 *   parentContainer.add(badge);
 */
export default class TypeBadge extends Phaser.GameObjects.Container {
  static WIDTH  = W;
  static HEIGHT = H;

  constructor(scene, x, y, type) {
    super(scene, x, y);

    const color = TYPE_COLORS[type.toLowerCase()] ?? 0x999999;

    const bg = scene.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(0, 0, W, H, 3);
    this.add(bg);

    const label = scene.add.text(W / 2, H / 2, type.toUpperCase(), {
      fontFamily: 'Gen3',
      fontSize: '11px',
      color: '#f8f8f8',
    });
    label.setOrigin(0.5, 0.5);
    this.add(label);

    scene.add.existing(this);
  }
}
