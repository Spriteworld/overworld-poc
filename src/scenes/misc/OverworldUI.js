import Phaser from 'phaser';
import { textBox, toast, EventBus, createInputManager, getInputManager, Action } from '@Utilities';
import ChoicePrompt from '@Utilities/ChoicePrompt.js';
import { PauseMenu } from '@Objects';
import { gameState, saveGame } from '@Data/gameState.js';
import store from '../../store/index.js';
import { KEY_ITEMS } from '../../store/modules/bag.js';
import { Pokedex, GENDERS } from '@spriteworld/pokemon-data';
import { getGameDef } from '@Data/gameDef.js';

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

    // Input manager — created before textbox so textbox can register with it
    createInputManager(this);

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

    this._scriptDepth = 0;

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
      const isKey = KEY_ITEMS.has(name);
      store.commit('bag/PICKUP', { name, qty: isKey ? null : (qty ?? 1) });
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

    this.game.events.on('script-runner-start', () => {
      this._scriptDepth++;
      this.registry.set('player_input', false);
    });
    this.game.events.on('script-runner-end',   () => {
      this._scriptDepth = Math.max(0, this._scriptDepth - 1);
      // If the script ended without closing via a textbox (e.g. heal_party as
      // the last command), player-move-enable was never re-emitted from the
      // textbox-disable handler — do it here.
      if (this._scriptDepth === 0 && !this.textbox.visible) {
        EventBus.emit('player-move-enable');
        this.registry.set('player_input', true);
      }
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
      console.log('[OverworldUI] battle-start received, launching BattleScene2 with data=', data);
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

          this.game.events.once('battle-complete', ({ result, prizeMoney, tutorial } = {}) => {
            const battleScene = this.scene.get('BattleScene2');
            // Tutorial battles run on a stand-in trainer + synthetic inventory.
            // Skip every mutation that would touch the real save — party sync,
            // bag sync, prize money, and any future caught-flow side-effects.
            const isTutorial = tutorial === true || battleScene?.tutorial === true;

            if (!isTutorial && prizeMoney > 0) { store.commit('game/ADD_MONEY', prizeMoney); }
            const pokemon = battleScene?.config?.player?.team?.pokemon;
            if (!isTutorial && pokemon) {
              const team = pokemon.map(p => ({
                pid:                 p.pid,
                species:             p.pokemon?.nat_dex_id ?? null,
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
            if (!isTutorial && battleItems?.length) {
              store.commit('bag/SYNC_AFTER_BATTLE', battleItems);
            }

            // Check for any pending overworld evolutions (stone use out of battle,
            // or any that the battle Evolution state didn't process).
            // Tutorial battles never evolve their stand-in team.
            const evolvingPokemon = isTutorial ? [] : (pokemon ?? []).filter(p => p.readyToEvolve != null);
            const tilesetBaseUrl  = battleScene?.data?.tilesetBaseUrl ?? '';

            const runEvolutionQueue = (queue, onDone) => {
              if (queue.length === 0) { onDone(); return; }
              const p = queue[0];
              const remaining = queue.slice(1);
              const fromName  = p.getName?.() ?? String(p.species);
              const targetId  = p.readyToEvolve;
              let toName;
              try {
                const entry = new Pokedex(p.game ?? getGameDef().game).getPokemonById(targetId);
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
                  if (didEvolve) {
                    p.evolve(targetId);
                    store.commit('party/EVOLVE', { pid: p.pid, targetSpecies: targetId });
                  }
                  p.readyToEvolve = null;
                  // Re-sync the party after each evolution
                  const updatedTeam = (pokemon ?? []).map(mon => ({
                    pid:                 mon.pid,
                    species:             mon.pokemon?.nat_dex_id ?? null,
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
              const runWarp = () => this.tweens.add({
                targets: this.transitionRect,
                alpha: 1,
                duration: 250,
                onComplete: () => {
                  this.scene.stop('BattleScene2');
                  if (!isTutorial && result === 'lost') {
                    // White-out: restore party and warp to last heal location.
                    store.commit('party/RESTORE_ALL');
                    const healLoc = store.state.game.healLocation ?? { map: 'KantoWorld', x: 74, y: 278, charLayer: 'ground' };
                    this.scene.stop(mapName);
                    this.scene.start(healLoc.map, { playerLocation: { x: healLoc.x, y: healLoc.y, charLayer: healLoc.charLayer } });
                  } else {
                    this.scene.wake(mapName);
                  }
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

              // On a lost trainer battle, show the trainer's loss line (if any)
              // before the screen fades to white and we warp to the heal point.
              const wonText = battleScene?.config?.enemy?.trainerWonText;
              const isTrainerLoss = !isTutorial && result === 'lost' && battleScene?.config?.enemy?.isTrainer;
              if (isTrainerLoss && wonText) {
                this.game.events.emit('textbox-changedata', wonText);
                this.game.events.once('textbox-disable', runWarp);
              } else {
                this.time.delayedCall(2000, runWarp);
              }
            };

            runEvolutionQueue(evolvingPokemon, returnToMap);
          });
        },
      });
    });

    // ─── Key item self-use (e.g. Bicycle) ────────────────────────────────
    this.game.events.on('use-key-item', (itemName) => {
      if (itemName !== 'Bicycle') return;
      const mapName  = this.registry.get('map');
      const mapScene = mapName ? this.scene.get(mapName) : null;
      const player   = mapScene?.mapPlugins?.player?.player;
      if (!player) return;
      if (mapScene?.config?.inside) return;

      const inBike = player.stateMachine.currentState?.name === player.stateDef.BIKE;
      const nextState = inBike ? player.stateDef.IDLE : player.stateDef.BIKE;
      player.stateMachine.setState(nextState);
      store.commit('game/SET_ON_BIKE', !inBike);
    });

    // ─── Player sprite change (Options screen) ────────────────────────────
    this.game.events.on('player-sprite-change', (sprite) => {
      const mapName  = this.registry.get('map');
      const mapScene = mapName ? this.scene.get(mapName) : null;
      const player   = mapScene?.mapPlugins?.player?.player;
      if (!player) return;

      const inBike = player.stateMachine.currentState?.name === player.stateDef.BIKE;
      player.config.texture = sprite;
      if (inBike) {
        const bikeTexture = sprite + '_bike';
        if (mapScene.textures.exists(bikeTexture)) player.setTexture(bikeTexture);
      } else {
        player.setTexture(sprite);
        player.gridengine.setWalkingAnimationMapping(player.config.id, player.characterFramesDef());
      }
    });

    // ─── Overworld item use (e.g. Rare Candy) → evolution ────────────────
    this.game.events.on('overworld-item-result', ({ pid, readyToEvolve }) => {
      if (!readyToEvolve) return;

      const p = gameState.party.find(mon => mon.pid === pid);
      if (!p) return;

      if (this.pauseMenu.visible) this.pauseMenu.close();
      this.registry.set('player_input', false);

      const dex      = new Pokedex(getGameDef().game);
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

    // ─── Script teach-move interactive flow ───────────────────────────────
    this.game.events.on('overworld-teach-move', ({ pid, move, pp }) => {
      const mon = store.state.party.list.find(m => m.pid === pid);
      if (!mon) { this.game.events.emit('overworld-teach-move-complete'); return; }

      let monName = 'Pokémon';
      try {
        const entry = new Pokedex(getGameDef().game).getPokemonById(mon.species);
        monName = (entry?.species ?? monName).replace(/\b\w/g, c => c.toUpperCase());
      } catch { /* keep default */ }

      if (this.pauseMenu.visible) this.pauseMenu.close();
      this.registry.set('player_input', false);

      const finish = () => {
        this.registry.set('player_input', true);
        this.game.events.emit('overworld-teach-move-complete');
      };

      this.game.events.emit('textbox-changedata', `${monName} wants to learn ${move}!`);
      this.game.events.once('textbox-disable', () => {

        if (mon.moves.length < 4) {
          store.commit('party/REPLACE_MOVE', { pid, move, pp, replaceIdx: -1 });
          this.game.events.emit('textbox-changedata', `${monName} learned ${move}!`);
          this.game.events.once('textbox-disable', finish);
          return;
        }

        this.game.events.emit('textbox-changedata',
          `But ${monName} already knows four moves!\nShould a move be forgotten and replaced with ${move}?`);
        this.game.events.once('textbox-disable', () => {
          new ChoicePrompt(this, ['YES', 'NO'], (yn) => {
            if (yn !== 0) {
              this.game.events.emit('textbox-changedata', `${move} was not learned.`);
              this.game.events.once('textbox-disable', finish);
              return;
            }
            const moveNames = mon.moves.map(m => m.name).concat(['CANCEL']);
            new ChoicePrompt(this, moveNames, (choice) => {
              if (choice === moveNames.length - 1) {
                this.game.events.emit('textbox-changedata', `${move} was not learned.`);
                this.game.events.once('textbox-disable', finish);
                return;
              }
              const forgotten = mon.moves[choice].name;
              store.commit('party/REPLACE_MOVE', { pid, move, pp, replaceIdx: choice });
              this.game.events.emit('textbox-changedata',
                `1, 2, and... Poof!\n${monName} forgot ${forgotten}.\n\nAnd...\n${monName} learned ${move}!`);
              this.game.events.once('textbox-disable', finish);
            });
          });
        });
      });
    });

    // ─── Input manager ────────────────────────────────────────────────────
    const im = getInputManager();

    im.on(Action.UP,    () => { if (this.pauseMenu.visible) this.pauseMenu.moveUp(); });
    im.on(Action.DOWN,  () => { if (this.pauseMenu.visible) this.pauseMenu.moveDown(); });
    im.on(Action.LEFT,  () => { if (this.pauseMenu.visible) this.pauseMenu.moveLeft(); });
    im.on(Action.RIGHT, () => { if (this.pauseMenu.visible) this.pauseMenu.moveRight(); });
    im.on(Action.CONFIRM, () => {
      if (this.pauseMenu.visible) {
        // Suppress MENU action that may fire in the same keydown event (Enter = CONFIRM + MENU)
        this._suppressMenuOpen = true;
        this._handleMenuConfirm();
      }
    });
    im.on(Action.CANCEL, () => {
      if (this.pauseMenu.visible) {
        this._suppressMenuOpen = true;
        const closed = this.pauseMenu.back();
        if (closed) this.registry.set('player_input', true);
      }
    });
    im.on(Action.MENU, () => {
      if (this._suppressMenuOpen) {
        this._suppressMenuOpen = false;
        return;
      }
      if (!this.pauseMenu.visible && this.registry.get('player_input') !== false) {
        this.registry.set('player_input', false);
        this.pauseMenu.open();
      }
    });
    im.on(Action.USE_ITEM, () => {
      const registered = store.state.bag.registeredItem;
      if (registered && this.registry.get('player_input') !== false) {
        this.game.events.emit('use-key-item', registered);
      }
    });

    // ─── Temp: Space = 10× speed toggle ──────────────────────────────────────
    this.input.keyboard.on('keydown-SPACE', () => {
      const speed = (this.game.registry.get('gameSpeed') ?? 1) === 1 ? 10 : 1;
      this.game.registry.set('gameSpeed', speed);
      this.game.scene.getScenes(true).forEach(s => {
        if (s !== this) s.anims.globalTimeScale = speed;
      });
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
      case 'save': {
        gameState.currentMap = this.registry.get('map') ?? gameState.currentMap;
        const _mapName  = this.registry.get('map');
        const _mapScene = _mapName ? this.scene.get(_mapName) : null;
        const _player   = _mapScene?.mapPlugins?.player?.player;
        if (_player) {
          store.commit('game/SET_PLAYER_FACING', _player.getFacingDirection());
        }
        saveGame();
        this.toast.showMessage('Progress saved!');
        this.pauseMenu.close();
        this.registry.set('player_input', true);
        break;
      }
      case 'close':
        this.pauseMenu.close();
        this.registry.set('player_input', true);
        break;
    }
  }
}
