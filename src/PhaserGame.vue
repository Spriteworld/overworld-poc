<template>
  <div id="game-container" style="flex: 1 0 50%;"></div>
</template>

<script>
import { config } from '@Data'
import { Game, Tile } from '@Objects'
import { EventBus } from '@Utilities';
import Debug from '@Data/debug.js';

export default {
  name: 'PhaserGame',
  
  data() {
    return {
      game: null,
      scene: null,
    };
  },
  emits: ['current-active-scene', 'current-coords'],

  mounted() {
    this.game = new Game(config);
    this.game.config.debug = Debug;

    EventBus.on('current-scene-ready', (currentScene) => {
      this.$emit('current-active-scene', currentScene);
      this.scene = currentScene;
    });
    EventBus.on('player-move-complete', (player) => {
      this.$emit('current-coords', {
        x: parseInt(player.x / Tile.WIDTH),
        y: parseInt(player.y / Tile.HEIGHT),
      });
    });
  },

  unmounted() {
    if (this.game) {
      this.game.destroy(true);
      EventBus.off('current-scene-ready');
      EventBus.off('player-move-complete');
    }
  },
}
</script>