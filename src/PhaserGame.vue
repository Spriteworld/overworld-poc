<template>
  <div id="game-container" style="flex: 1 0 50%;"></div>
</template>

<script>
import { config } from '@Data'
import { Game } from '@Objects'
import { EventBus } from '@Utilities'; 

export default {
  name: 'PhaserGame',
  
  data() {
    return {
      game: null,
      scene: null,
    };
  },
  emits: ['current-active-scene'],

  mounted() {
    this.game = new Game(config);

    EventBus.on('current-scene-ready', (currentScene) => {
      this.$emit('current-active-scene', currentScene);
      this.scene = currentScene;
    });
  },

  unmounted() {
    if (this.game) {
      this.game.destroy(true);
    }
  },
}
</script>