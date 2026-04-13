import Phaser from 'phaser';

const COPYRIGHT_LINES = [
  '\u00a9 1995-2003 Nintendo',
  'CREATURES inc. / GAME FREAK inc.',
  'TM and \u00ae are trademarks of Nintendo.',
  'Spriteworld is fan-made from the ground up, and is not affiliated with Nintendo, Creatures, or Game Freak.',
];

export default class CopyrightScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CopyrightScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(0xffffff);

    this.add.text(400, 290, COPYRIGHT_LINES.join('\n'), {
      fontFamily: 'Gen3',
      fontSize:   '13px',
      color:      '#000000',
      align:      'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);

    this.cameras.main.fadeIn(400, 255, 255, 255);
    this.cameras.main.once('camerafadeincomplete', () => {
      this.time.delayedCall(3000, () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('TitleScreen');
        });
      });
    });
  }
}
