<template>
  <!-- Map overlay: game running -->
  <div v-if="active" class="fixed inset-0 flex flex-col bg-black">
    <div class="flex items-center gap-3 px-4 py-2 bg-gray-900 shrink-0">
      <button
        class="text-sm text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition"
        @click="close"
      >← Back</button>
      <span class="font-semibold text-white">{{ active.title }}</span>
      <span class="text-gray-500 text-sm font-mono">{{ active.scene }}</span>
      <div class="ml-auto flex gap-1 flex-wrap">
        <span
          v-for="tag in active.tags"
          :key="tag"
          class="text-[10px] bg-gray-700 rounded px-1.5 py-0.5 font-mono text-gray-300"
        >{{ tag }}</span>
      </div>
    </div>
    <PhaserGame class="flex-1 min-h-0" />
    <MobileControls class="lg:hidden shrink-0" />
    <div class="hidden lg:block shrink-0 px-4 py-1 bg-gray-900 text-xs text-gray-500 text-center">
      Arrow keys to move · Z to confirm · X to cancel · Esc closes
    </div>
  </div>

  <!-- Map picker -->
  <div v-else class="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-wide">Map Test Harness</h1>
      <p class="text-gray-400 text-sm mt-1">Configure flags then click Launch.</p>
    </header>

    <div v-for="group in MAPS" :key="group.category" class="mb-8">
      <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{{ group.category }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="m in group.maps"
          :key="m.scene"
          class="rounded-xl p-3 flex flex-col gap-2"
          :style="{ background: m.color }"
        >
          <!-- Title + tags -->
          <div>
            <div class="font-bold text-base">{{ m.title }}</div>
            <p class="text-xs text-white/70 leading-snug line-clamp-2 mt-0.5">{{ m.description }}</p>
          </div>

          <!-- State toggles -->
          <div v-if="Object.keys(m.state).length" class="flex flex-col gap-1 bg-black/20 rounded-lg px-2 py-1.5">
            <label
              v-for="(_, key) in m.state"
              :key="key"
              class="flex items-center gap-2 cursor-pointer select-none"
              @click.stop
            >
              <input
                type="checkbox"
                class="accent-white w-3.5 h-3.5"
                :checked="liveState[m.scene][key]"
                @change="liveState[m.scene][key] = $event.target.checked"
              />
              <span class="text-xs text-white/80 font-mono">{{ formatKey(key) }}</span>
            </label>
          </div>

          <!-- Tags + launch -->
          <div class="flex items-end justify-between gap-2 mt-auto">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="tag in m.tags"
                :key="tag"
                class="text-[10px] bg-black/30 rounded px-1.5 py-0.5 font-mono"
              >{{ tag }}</span>
            </div>
            <button
              class="shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 active:bg-white/10 transition rounded-lg px-3 py-1"
              @click="launch(m)"
            >Launch →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import PhaserGame from '@/PhaserGame.vue';
import MobileControls from '@/components/MobileControls.vue';
import { setStartScene, clearStartScene } from '@/data/startScene.js';
import { setStartFlags, clearStartFlags } from '@/data/startFlags.js';
import MAPS from './maps.js';

const allMaps = MAPS.flatMap(g => g.maps);

// Build a reactive copy of every map's state so toggles are independent.
const liveState = reactive(
  Object.fromEntries(allMaps.map(m => [m.scene, { ...m.state }]))
);

function formatKey(key) {
  return key.replace(/^has_/, '').replaceAll('_', ' ');
}

const active = ref(null);

function launch(map) {
  setStartFlags(liveState[map.scene]);
  setStartScene(map.scene);
  active.value = map;
  window.location.hash = map.scene;
}

function close() {
  active.value = null;
  clearStartFlags();
  clearStartScene();
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function onHashChange() {
  const scene = window.location.hash.slice(1);
  if (!scene) {
    if (active.value) close();
    return;
  }
  if (active.value?.scene === scene) return;
  const map = allMaps.find(m => m.scene === scene);
  if (map) {
    setStartFlags(liveState[map.scene]);
    setStartScene(map.scene);
    active.value = map;
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && active.value) close();
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('hashchange', onHashChange);
  const scene = window.location.hash.slice(1);
  if (scene) {
    const map = allMaps.find(m => m.scene === scene);
    if (map) launch(map);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('hashchange', onHashChange);
});
</script>
