import Phaser from 'phaser';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'TimeOverlay' });

    let hour = new Date().getHours();
    let mins = new Date().getMinutes();
    this.time = {
      morning: (hour >= 7 && (hour <= 10 && mins <= 59)),
      day: (hour >= 11 && (hour <= 18 && mins <= 59)),
      evening: (hour >= 19 && (hour <= 21 && mins <= 59)),
      night: (hour >= 22 || (hour <= 6 && mins <= 59)),
    };
  }

  init() {
    let { width, height } = this.sys.game.canvas;
    this.overlay = this.add.image(0, 0, 'blank')
      .setDisplayOrigin(0)
      .setDisplaySize(width, height)
    ;
  }

  create () {
    if (!this.game.config.debug.functions.timeOverlay) {
      return;
    }

    this.add.text(16, 16, 'Day', { fontSize: '32px', fill: '#000', stroke: '#000', strokeThickness: 2});
    this.add.text(416, 16, 'Evening', { fontSize: '32px', fill: '#000', stroke: '#000', strokeThickness: 2});
    let cam2overlay = this.add.image(400, 0, 'blank')
      .setOrigin(0)
      .setDisplaySize(400, 300)
    ;
    this.doEvening(cam2overlay);

    this.add.text(16, 316, 'Night', { fontSize: '32px', fill: '#000', stroke: '#000', strokeThickness: 2});
    let cam3overlay = this.add.image(0, 300, 'blank')
      .setOrigin(0)
      .setDisplaySize(400, 300)
    ;
    this.doNight(cam3overlay);

    this.add.text(416, 316, 'Morning', { fontSize: '32px', fill: '#000', stroke: '#000', strokeThickness: 2});
    let cam4overlay = this.add.image(400, 300, 'blank')
      .setOrigin(0)
      .setDisplaySize(400, 300)
    ;
    this.doMorning(cam4overlay);
  }

  doMorning(overlay) {
    overlay
      .setTint(0x0026b2)
      .setAlpha(0.15)
    ;
  }

  doEvening(overlay) {
    overlay
      .setTint(0xdd5416)
      .setAlpha(0.15)
    ;
  }

  doNight(overlay) {
    overlay
      .setTint(0x0026b2)
      .setAlpha(0.35)
    ;
  }

  update() {
    let hour = new Date().getHours();
    let mins = new Date().getMinutes();
    this.time = {
      morning: (hour >= 7 && (hour <= 10 && mins <= 59)),
      day: (hour >= 11 && (hour <= 18 && mins <= 59)),
      evening: (hour >= 19 && (hour <= 21 && mins <= 59)),
      night: (hour >= 22 || (hour <= 6 && mins <= 59)),
    };
    // console.log(hour, mins, this.time);


    if (!this.game.config.debug.functions.timeOverlay) {
      if (this.time.morning) {
        // console.log('timeoverlay::morning');
        this.doMorning(this.overlay);
        return;
      } else if (this.time.evening) {
        // console.log('timeoverlay::evening');
        this.doEvening(this.overlay);
        return;
      } else if (this.time.night) {
        // console.log('timeoverlay::night');
        this.doNight(this.overlay);
        return;
      } else {
        // console.log('timeoverlay::day');
        this.overlay.setAlpha(0);
        return;
      }
    } else {
      this.overlay.setAlpha(0);
    }
  }
}
