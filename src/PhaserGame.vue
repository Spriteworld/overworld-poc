<template>
  <div id="game-container" style="flex: 1 0 50%;"></div>
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

  mounted() {
    this.game = new Game(config);
    this.game.config.debug = Debug;
    this.game.config.gameFlags = GameFlags;

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