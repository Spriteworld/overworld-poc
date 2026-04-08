import Phaser from 'phaser';
import { textBox, toast, EventBus } from '@Utilities';
import { PauseMenu } from '@Objects';
import { gameState, saveGame } from '@Data/gameState.js';
import store from '../../store/index.js';
import { Pokedex, GAMES, GENDERS } from '@spriteworld/pokemon-data';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'OverworldUI' });

    this.textbox = null;
    this.toast   = null;
    this.pauseMenu = null;
  }

  /** Phaser preload lifecycle hook — no assets to load for this scene. */
  preload () { }

  /**
   * Phaser create lifecycle hook.
   * Initialises the toast, textbox, transition overlay, and pause menu,
   * then registers all game-event listeners.
   */
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

  /** Clean up the textbox and pause menu when the scene is destroyed. */
  destroy() {
    this.textbox.destroy();
    this.pauseMenu.destroy();
  }

  /**
   * Register all game-level event listeners (item pickup, toast, map enter,
   * textbox control, battle transitions, overworld evolution, and keyboard input).
   */
  handleEvents() {
    this.game.events.on('item-pickup', (payload) => {
      const name = typeof payload === 'string' ? payload : payload.name;
      const qty  = typeof payload === 'object'  ? payload.qty : null;
      store.commit('bag/PICKUP', { name, qty: qty ?? 1 });
      const display = name.replace(/\b\w/g, c => c.toUpperCase());
      const msg = qty != null
        ? `You found ${qty} x\n${display}!`
        : `You received\na ${display}!`;
      this.game.events.emit('textbox-changedata', msg);
    });

    this.game.events.on('toast', (value) => {
      this.toast.showMessage(value);
    });

    this.game.events.on('map-enter', (mapName) => {
      // KantoWorld uses location-zone detection instead of scene-name toasts.
      if (mapName === 'KantoWorld') return;
      const display = mapName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Za-z])(\d)/g, '$1 $2');
      this.toast.showMessage(display);
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

    this.game.events.on('computer-open', ({ type }) => {
      EventBus.emit('player-move-disable');
      this.game.events.emit('computer-ui-open', { type });
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

          // The white overlay (alpha 1) hides everything while BattleScene2
          // initialises on the next frame. Bring OverworldUI back on top now
          // so the overlay stays visible, then fade it out. The 100ms delay
          // gives BattleScene2 enough time to start before it becomes visible.
          this.scene.bringToTop('OverworldUI');
          this.tweens.add({
            targets: this.transitionRect,
            alpha: 0,
            duration: 300,
            delay: 100,
          });

          this.game.events.once('battle-complete', () => {
            const battleScene = this.scene.get('BattleScene2');
            const pokemon = battleScene?.config?.player?.team?.pokemon;
            if (pokemon) {
              const team = pokemon.map(p => ({
                pid:                 p.pid,
                currentHp:           p.currentHp,
                exp:                 p.exp ?? null,
                level:               p.level,
                readyToEvolve:       p.readyToEvolve       ?? null,
                pendingMovesToLearn: p.pendingMovesToLearn  ?? [],
                moves:               p.moves.map(m => ({ name: m.name, pp: { max: m.pp.max, current: m.pp.current } })),
              }));
              store.commit('party/SYNC_AFTER_BATTLE', team);
            }
            const battleItems = battleScene?.config?.player?.inventory?.items;
            if (battleItems?.length) {
              store.commit('bag/SYNC_AFTER_BATTLE', battleItems);
            }

            // Check for any pending overworld evolutions (stone use out of battle,
            // or any that the battle Evolution state didn't process).
            const evolvingPokemon = (pokemon ?? []).filter(p => p.readyToEvolve != null);
            const tilesetBaseUrl  = battleScene?.data?.tilesetBaseUrl ?? '';

            const runEvolutionQueue = (queue, onDone) => {
              if (queue.length === 0) { onDone(); return; }
              const p = queue[0];
              const remaining = queue.slice(1);
              const fromName  = p.getName?.() ?? String(p.species);
              const targetId  = p.readyToEvolve;
              let toName;
              try {
                const entry = new Pokedex(p.game ?? GAMES.POKEMON_FIRE_RED).getPokemonById(targetId);
                toName = (entry.species ?? `#${targetId}`).replace(/\b\w/g, c => c.toUpperCase());
              } catch {
                toName = `#${targetId}`;
              }
              this.scene.launch('EvolutionScene', {
                fromSpecies:    p.species,
                toSpecies:      targetId,
                fromName,
                toName,
                shiny:          p.isShiny  ?? false,
                gender:         p.gender   ?? null,
                tilesetBaseUrl,
                canCancel:      false,
                onComplete: (didEvolve) => {
                  if (didEvolve) p.evolve(targetId);
                  p.readyToEvolve = null;
                  // Re-sync the party after each evolution
                  const updatedTeam = (pokemon ?? []).map(mon => ({
                    pid:                 mon.pid,
                    currentHp:           mon.currentHp,
                    exp:                 mon.exp ?? null,
                    level:               mon.level,
                    readyToEvolve:       mon.readyToEvolve       ?? null,
                    pendingMovesToLearn: mon.pendingMovesToLearn  ?? [],
                    moves:               mon.moves.map(m => ({ name: m.name, pp: { max: m.pp.max, current: m.pp.current } })),
                  }));
                  store.commit('party/SYNC_AFTER_BATTLE', updatedTeam);
                  runEvolutionQueue(remaining, onDone);
                },
              });
            };

            const returnToMap = () => {
              this.time.delayedCall(2000, () => {
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
            };

            runEvolutionQueue(evolvingPokemon, returnToMap);
          });
        },
      });
    });

    // ─── Overworld item use (e.g. Rare Candy) → evolution ────────────────
    this.game.events.on('overworld-item-result', ({ pid, readyToEvolve }) => {
      if (!readyToEvolve) return;

      const p = gameState.party.find(mon => mon.pid === pid);
      if (!p) return;

      if (this.pauseMenu.visible) this.pauseMenu.close();
      this.registry.set('player_input', false);

      const dex      = new Pokedex(GAMES.POKEMON_FIRE_RED);
      const targetId = readyToEvolve;

      let fromName, toName;
      try {
        const fromEntry = dex.getPokemonById(p.species);
        fromName = (fromEntry.species ?? `#${p.species}`).replace(/\b\w/g, c => c.toUpperCase());
      } catch { fromName = `#${p.species}`; }
      try {
        const toEntry = dex.getPokemonById(targetId);
        toName = (toEntry.species ?? `#${targetId}`).replace(/\b\w/g, c => c.toUpperCase());
      } catch { toName = `#${targetId}`; }

      this.scene.launch('EvolutionScene', {
        fromSpecies:    p.species,
        toSpecies:      targetId,
        fromName,
        toName,
        shiny:          p.isShiny  ?? false,
        gender:         p.gender   ?? null,
        tilesetBaseUrl: '',
        canCancel:      true,
        onComplete: (didEvolve) => {
          if (didEvolve) {
            store.commit('party/EVOLVE', { pid, targetSpecies: targetId });
          } else {
            store.commit('party/CLEAR_READY_TO_EVOLVE', pid);
          }
          this.registry.set('player_input', true);
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

  /**
   * Called when the player presses confirm while the pause menu is open.
   * Delegates to the active sub-screen or routes the selected main-menu key.
   */
  _handleMenuConfirm() {
    const option = this.pauseMenu.confirm();
    if (!option) {
      return; // handled internally (e.g. team screen)
    }
    switch (option) {
      case 'pokedex':
      case 'option':
      case 'debug':
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
