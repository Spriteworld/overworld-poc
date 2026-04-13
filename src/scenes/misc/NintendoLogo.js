import Phaser from 'phaser';

export default class NintendoLogo extends Phaser.Scene {
  constructor() {
    super({ key: 'NintendoLogo' });
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);

    const logo = this.add.text(400, -60, 'Nintendo', {
      fontFamily: 'Gen3',
      fontSize:   '48px',
      color:      '#ffffff',
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets:  logo,
      y:        280,
      duration: 500,
      ease:     'Linear',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('CopyrightScene');
          });
        });
      },
    });
  }
}
