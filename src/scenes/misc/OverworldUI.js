import Phaser from 'phaser';
import { textBox, toast, EventBus } from '@Utilities';
// import {PauseMenu} from '@Objects';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'OverworldUI' });

    this.textbox = null;
  }

  preload () { }

  create () {

    // init some events
    let events = {
      'interactions': [],
      'warps': [],
      'textbox-active': false
    };
    Object.keys(events).forEach(eventKey => {
      if (this.registry.has(eventKey) === false) {
        this.registry.set(eventKey, events[eventKey]);
      }
    })

    // toast
    // this.toast = toast(this, 10, 10, {});

    // textbox
    if (this.textbox === null) {
      this.textbox = textBox(this, 100, 400, {
        wrapWidth: 500,
        fixedWidth: 500,
        fixedHeight: 65
      });
    }
    this.textbox.setVisible(false);

    // set pause menu
    // this.pauseMenu = new PauseMenu(this, 0, 0);
    // this.pauseMenu.setVisible(false);

    this.handleEvents();
  }

  destroy() {
    // this.toast.destroy();
    this.textbox.destroy();
    // this.pauseMenu.destroy();
  }

  handleEvents() {
    // this should trigger on map change
    // this.game.events.on('toast', (value) => {
    //   console.log('toast', value);
    //   this.toast.showMessage(value);
    // });

    this.game.events.on('textbox-disable', () => {
      this.textbox.setVisible(false);
      EventBus.emit('player-move-enable');
    });

    this.game.events.on('textbox-changedata', (value) => {
      this.textbox.start(value);
      this.textbox.setVisible(true);
      EventBus.emit('player-move-disable');
    });
  }
}
