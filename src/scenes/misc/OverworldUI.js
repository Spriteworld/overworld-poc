import Phaser from 'phaser';
import { textBox, toast, EventBus } from '@Utilities';
import { PauseMenu } from '@Objects';
import { gameState, saveGame } from '@Data/gameState.js';
import store from '../../store/index.js';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'OverworldUI' });

    this.textbox = null;
    this.toast   = null;
    this.pauseMenu = null;
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
    });

    // toast notification
    this.toast = toast(this, 10, 10, {});

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
      .rectangle(400, 300, 800, 600, 0xffffff)
      .setAlpha(0)
      .setDepth(Number.MAX_SAFE_INTEGER);

    // pause menu
    this.pauseMenu = new PauseMenu(this);

    this.handleEvents();
  }

  destroy() {
    this.textbox.destroy();
    this.pauseMenu.destroy();
  }

  handleEvents() {
    this.game.events.on('item-pickup', (name) => {
      store.commit('bag/PICKUP', name);
    });

    this.game.events.on('toast', (value) => {
      this.toast.showMessage(value);
    });

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
      // Close menu if somehow open when battle fires
      if (this.pauseMenu.visible) {
        this.pauseMenu.close();
      }
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

          // launch() defers the start to the next frame, where BattleScene2
          // lands on top of the stack. Wait for it to start before bringing
          // OverworldUI (and its white overlay) back on top, then fade out.
          this.scene.get('BattleScene2').events.once('start', () => {
            this.scene.bringToTop('OverworldUI');
            this.tweens.add({
              targets: this.transitionRect,
              alpha: 0,
              duration: 300,
              delay: 100,
            });
          });

          this.game.events.once('battle-complete', () => {
            const battleScene = this.scene.get('BattleScene2');
            const pokemon = battleScene?.config?.player?.team?.pokemon;
            if (pokemon) {
              const team = pokemon.map(p => ({
                pid:                 p.pid,
                currentHp:           p.currentHp,
                exp:                 p.exp ?? 0,
                level:               p.level,
                readyToEvolve:       p.readyToEvolve       ?? null,
                pendingMovesToLearn: p.pendingMovesToLearn  ?? [],
                moves:               p.moves.map(m => ({ name: m.name, pp: { max: m.pp.max, current: m.pp.current } })),
              }));
              store.commit('party/SYNC_AFTER_BATTLE', team);
            }
            this.time.delayedCall(2000, () => {
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

    // ─── Pause menu keyboard ──────────────────────────────────────────────
    this.input.keyboard.on('keydown', (event) => {
      if (this.pauseMenu.visible) {
        switch (event.code) {
          case 'ArrowUp':    this.pauseMenu.moveUp();    break;
          case 'ArrowDown':  this.pauseMenu.moveDown();  break;
          case 'ArrowLeft':  this.pauseMenu.moveLeft();  break;
          case 'ArrowRight': this.pauseMenu.moveRight(); break;
          case 'KeyZ':
          case 'Enter':
            if (!event.repeat) this._handleMenuConfirm();
            break;
          case 'KeyX':
          case 'Escape':
            if (!event.repeat) {
              const closed = this.pauseMenu.back();
              if (closed) this.registry.set('player_input', true);
            }
            break;
        }
      } else if (event.code === 'Enter' && !event.repeat) {
        if (this.registry.get('player_input') !== false) {
          this.registry.set('player_input', false);
          this.pauseMenu.open();
        }
      }
    });
  }

  _handleMenuConfirm() {
    const option = this.pauseMenu.confirm();
    if (!option) return; // handled internally (e.g. team screen)
    switch (option) {
      case 'pokedex':
      case 'option':
        this.pauseMenu.showSubScreen(option);
        break;
      case 'team':
      case 'bag':
      case 'user':
        this.pauseMenu.showSubScreen(option);
        break;
      case 'save':
        gameState.currentMap = this.registry.get('map') ?? gameState.currentMap;
        saveGame();
        this.toast.showMessage('Progress saved!');
        this.pauseMenu.close();
        this.registry.set('player_input', true);
        break;
      case 'close':
        this.pauseMenu.close();
        this.registry.set('player_input', true);
        break;
    }
  }
}
