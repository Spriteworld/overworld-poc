<template>
  <div class="flex flex-col">
    <div class="flex flex-row text-white h-[10vh] overflow-y-scroll"><pre>
{{ JSON.stringify(debugContent, null, '\t') }}
    </pre></div>
    <div class="flex flex-row h-[90vh]">
      <div class="flex w-10/12">
        <PhaserGame 
          ref="phaserRef" 
          @current-active-scene="updateCurrentScene"
          @current-coords="(coords) => xy = coords"
          @player-move-disable="disablePlayerMove"
          @player-move-enable="enablePlayerMove"
          @debug="(payload) => debugContent = payload"
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
            <label>
              <input
                v-model="showDebug"
                type="checkbox"
              />
              Debug
            </label>
          </div>
          <div class="flex flex-col gap-1" v-if="showDebug">
            <ObjectCheckboxes :options="debug" @update:debug="updateDebugValue" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <div>
            <label>
              <input
                v-model="showGameFlags"
                name="showGameFlags"
                type="checkbox"
              />
              Game Flags
            </label>
          </div>
          <div class="flex flex-col gap-1" v-if="showGameFlags">
            <ObjectCheckboxes :options="gameFlags" @update:debug="updateGameFlag" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import PhaserGame from './PhaserGame.vue';
import Scenes from '@Scenes';
import Debug from '@Data/debug.js';
import GameFlags from '@Data/gameFlags.js';
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
      showGameFlags: false,
      debug: {},
      gameFlags: {},
      debugContent: {},
    };
  },

  created() {
    this.debug = Debug;
    this.gameFlags = GameFlags;
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
    updateGameFlag(updateObj) {
      let [key, value] = Object.entries(updateObj)[0];
      eval(`this.scene.game.config.gameFlags.${key} = ${value};`);
      this.reloadMap();
    },
    updateDebugValue(updateObj) {
      let [key, value] = Object.entries(updateObj)[0];
      eval(`this.scene.game.config.debug.${key} = ${value};`);
      this.reloadMap();
    },
    reloadMap() {
      let char = this.scene.characters.get('player');
      this.scene.mapPlugins['warp'].warpPlayerToMapWithoutFade(char, this.currentSceneName, {
        x: this.xy.x,
        y: this.xy.y,
        dir: char.getFacingDirection(),
        charLayer: char.layer,
      });
    },
    disablePlayerMove() {
      let char = this.scene.characters.get('player');
      char.disableMovement();
    },
    enablePlayerMove() {
      let char = this.scene.characters.get('player');
      char.enableMovement();
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