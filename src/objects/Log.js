import Phaser from 'phaser';

export default class extends Phaser.GameObjects.Container {
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

  clear() {
    this.log = [];
  }
}
