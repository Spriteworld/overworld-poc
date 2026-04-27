<template>
  <div id="game-container" class="flex flex-grow h-full w-full object-contain overflow-hidden relative"></div>
</template>

<script>
import { config } from '@Data'
import { Game, Tile } from '@Objects'
import { EventBus } from '@Utilities';
import Debug from '@Data/debug.js';
import GameFlags from '@Data/gameFlags.js';

export default {
  name: 'PhaserGame',
  
  data() {
    return {
      game: null,
      scene: null,
    };
  },
  emits: [
    'current-active-scene', 
    'current-coords', 
    'player-move-disable', 
    'player-move-enable', 
    'debug'
  ],

  async mounted() {
    await document.fonts.ready;
    this.game = new Game(config);
    this.game.config.debug     = this._loadStored('spriteworld_debug',     Debug);
    this.game.config.gameFlags = this._loadStored('spriteworld_gameflags', GameFlags);

    EventBus.on('current-scene-ready', (currentScene) => {
      this.$emit('current-active-scene', currentScene);
      this.scene = currentScene;
    });
    EventBus.on('player-move-complete', (player) => {
      this.$emit('current-coords', {
        x: parseInt(player.x / Tile.WIDTH),
        y: parseInt(player.y / Tile.HEIGHT),
        layer: this.scene.gridEngine.getCharLayer('player'),
      });
    });
    EventBus.on('player-move-disable', () => {
      this.$emit('player-move-disable');
    });
    EventBus.on('player-move-enable', () => {
      this.$emit('player-move-enable');
    });
    EventBus.on('debug', (payload) => {
      this.$emit('debug', payload);
    });
  },

  methods: {
    /** Load a stored object from localStorage, merged over defaults so new keys always appear. */
    _loadStored(key, defaults) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { ...defaults };
        const saved = JSON.parse(raw);
        const result = {};
        for (const [k, v] of Object.entries(defaults)) {
          if (v !== null && typeof v === 'object') {
            result[k] = { ...v, ...(saved[k] ?? {}) };
          } else {
            result[k] = k in saved ? saved[k] : v;
          }
        }
        return result;
      } catch {
        return { ...defaults };
      }
    },
  },

  unmounted() {
    if (this.game) {
      this.game.destroy(true);
      EventBus.off('current-scene-ready');
      EventBus.off('player-move-complete');
      EventBus.off('player-move-disable');
      EventBus.off('player-move-enable');
      EventBus.off('debug');
    }
  },
}
</script>