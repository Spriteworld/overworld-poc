<template>
  <div class="flex flex-row">
    <div class="flex w-10/12 h-screen">
      <PhaserGame ref="phaserRef" @current-active-scene="updateCurrentScene" />
    </div>
    <div class="flex flex-col justify-center items-center text-white">
      <div>
        <p>Current Map: {{ currentSceneName }}</p>
      </div>
      <div>
        <div>Load Map</div>
        <div class="flex flex-col gap-1">
          <button
            v-for="scene in sceneList"
            :key="scene.name"      
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            @click="swapScene(scene.name)"
          >{{ scene.name }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Phaser from 'phaser';
import PhaserGame from './PhaserGame.vue';
import Scenes from '@Scenes';

export default {
  name: 'App',
  components: {
    PhaserGame,
  },

  data() {
    return {
      currentSceneName: null,
      scene: {}
    };
  },

  methods: {
    updateCurrentScene(scene) {
      this.currentSceneName = scene.config.mapName;
      this.scene = scene;
    },
    swapScene(sceneName) {
      this.scene.scene.start(sceneName);
    },
  },

  computed: {
    sceneList() {
      return Object.keys(Scenes)
        .map((sceneName) => ({
          name: sceneName,
          scene: Scenes[sceneName],
        }))
        .filter((scene) => {
          return !['Preload', 'Base', 'OverworldUI', 'TimeOverlay'].includes(scene.name);
        })
      ;
    },
  },

};
</script>