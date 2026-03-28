<template>
  <div class="flex flex-col overflow-hidden" style="height: 100vh; height: 100dvh;">
    <div class="flex flex-1 min-h-0">
      <PhaserGame
        ref="phaserRef"
        @current-active-scene="updateCurrentScene"
        @player-move-disable="disablePlayerMove"
        @player-move-enable="enablePlayerMove"
      />
    </div>
    <MobileControls class="lg:hidden" />
  </div>
</template>

<script>
import PhaserGame from './PhaserGame.vue';
import MobileControls from './components/MobileControls.vue';

export default {
  name: 'App',
  components: {
    PhaserGame, MobileControls,
  },

  data() {
    return {
      scene: {},
    };
  },

  methods: {
    updateCurrentScene(scene) {
      this.scene = scene;
    },
    disablePlayerMove() {
      let char = this.scene.characters?.get('player');
      char?.disableMovement();
    },
    enablePlayerMove() {
      let char = this.scene.characters?.get('player');
      char?.enableMovement();
    },
  },
};
</script>
