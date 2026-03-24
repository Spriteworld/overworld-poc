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

    // full-screen overlay used for encounter transitions
    this.transitionRect = this.add
      .rectangle(400, 300, 800, 600, 0xffffff, 0)
      .setDepth(Number.MAX_SAFE_INTEGER);

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

    this.game.events.on('battle-start', (data) => {
      const mapName = this.registry.get('map');
      this.registry.set('player_input', false);

      // 3 white flashes, then hold white and cut to battle
      this.tweens.add({
        targets: this.transitionRect,
        alpha: 1,
        duration: 80,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          this.transitionRect.setAlpha(1);
          this.scene.sleep(mapName);
          this.scene.launch('BattleScene2', data);
          // render OverworldUI (and its overlay) on top of BattleScene2
          this.scene.bringToTop('OverworldUI');

          // fade the white overlay out to reveal the battle scene
          this.tweens.add({
            targets: this.transitionRect,
            alpha: 0,
            duration: 300,
            delay: 100,
          });

          this.game.events.once('battle-complete', () => {
            this.time.delayedCall(1, () => {
              // fade to white, then swap back to overworld
              this.tweens.add({
                targets: this.transitionRect,
                alpha: 1,
                duration: 250,
                onComplete: () => {
                  this.scene.stop('BattleScene2');
                  this.scene.wake(mapName);
                  this.tweens.add({
                    targets: this.transitionRect,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                      this.registry.set('player_input', true);
                    },
                  });
                },
              });
            });
          });
        },
      });
    });
  }
}
