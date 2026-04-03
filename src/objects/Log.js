import Phaser from 'phaser';

export default class extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene - The scene this log belongs to.
   * @param {number} x - Container x position in world coordinates.
   * @param {number} y - Container y position in world coordinates.
   * @param {Phaser.GameObjects.GameObject[]} [children] - Initial child objects.
   */
  constructor(scene, x, y, children) {
    super(scene, x, y, children);
    this.config = {};
    this.config.scene = scene;
    this.config.children = children || [];
    this.config.x = x;
    this.config.y = y;
    this.log = [];

    scene.add.existing(this);
  }

  /**
   * Append a new text line to the log, stacking it 20px below the previous entry.
   * @param {string} text - The text string to display.
   */
  addItem(text) {
    console.log('Log::add', text);

    let item = this.scene.add.text(
      0,
      (this.log.length * 20),
      text,
      {
        color: '#ffffff',
        align: 'left',
        font: '12px'
      }
    );

    this.log.push(item);
    this.add(item);
  }

  /**
   * Remove all tracked log entries from the internal array.
   * Note: does not destroy the underlying text objects.
   */
  clear() {
    this.log = [];
  }
}
