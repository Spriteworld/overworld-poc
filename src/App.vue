<template>
  <div class="flex flex-row">
    <div class="flex w-10/12 h-screen">
      <PhaserGame 
        ref="phaserRef" 
        @current-active-scene="updateCurrentScene"
        @current-coords="(coords) => xy = coords"
      />
    </div>
    <div class="flex flex-row gap-2 justify-center items-center text-white p-2 w-full">
      <div class="flex flex-col gap-1">
        <div>
          <p>Current Map: {{ currentSceneName }}</p>
          <p>Co-ords: {{ Object.values(xy).join(',') }}</p>
          <p>InGame Time: {{ ingameTime }}</p>
        </div>
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
      <div class="flex flex-col gap-1">
        <div>
          <input
            v-model="showDebug"
            type="checkbox"
          />
          Debug
        </div>
        <div class="flex flex-col gap-1" v-if="showDebug">
          <ObjectCheckboxes :options="debug" @update:debug="updateDebugValue" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import PhaserGame from './PhaserGame.vue';
import Scenes from '@Scenes';
import Debug from '@Data/debug.js';
import ObjectCheckboxes from './components/ObjectCheckboxes.vue';

export default {
  name: 'App',
  components: {
    PhaserGame, ObjectCheckboxes,
  },

  data() {
    return {
      currentSceneName: null,
      scene: {},
      xy: {
        x: 0,
        y: 0,
      },
      showDebug: false,
      debug: {}
    };
  },

  created() {
    this.debug = Debug;
  },

  methods: {
    updateCurrentScene(scene) {
      this.currentSceneName = scene.config.mapName;
      this.scene = scene;
      this.xy = {
        x: scene.characters.get('player').x,
        y: scene.characters.get('player').y,
      };
    },
    swapScene(sceneName) {
      let char = this.scene.characters.get('player');
      this.scene.mapPlugins['warp'].warpPlayerToMap(char, sceneName);
    },
    updateDebugValue(updateObj) {
      let [key, value] = Object.entries(updateObj)[0];
      eval(`this.scene.game.config.debug.${key} = ${value};`);

      let char = this.scene.characters.get('player');
      this.scene.mapPlugins['warp'].warpPlayerToMapWithoutFade(char, this.currentSceneName, {
        x: this.xy.x,
        y: this.xy.y,
        dir: char.getFacingDirection(),
        charLayer: char.layer,
      });
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
    ingameTime() {
      let hour = new Date().getHours();
      let mins = new Date().getMinutes();
      let time = {
        morning: (hour >= 7 && (hour <= 10 && mins <= 59)),
        day: (hour >= 11 && (hour <= 18 && mins <= 59)),
        evening: (hour >= 19 && (hour <= 21 && mins <= 59)),
        night: (hour >= 22 || (hour <= 6 && mins <= 59)),
      };

      return Object.entries(time)
        .filter(([_, value]) => {
          return value;
        })
        .map(([key, _]) => key)
        .join(', ')
      ;
    }
  },

};
</script>