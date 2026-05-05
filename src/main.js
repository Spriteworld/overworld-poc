import '@Data/gameDefs/index.js';

import App from './App.vue';
import { createApp } from 'vue';
import store from './store/index.js';

import '@/assets/app.css';

import Phaser from 'phaser';
import registerTiledJSONExternalLoader from 'phaser-tiled-json-external-loader';

import { resolveWorldAtBoot, loadWorld } from '@/worlds/manifest.js';

registerTiledJSONExternalLoader(Phaser);

async function boot() {
  const worldId = resolveWorldAtBoot();
  if (worldId) await loadWorld(worldId);

  createApp(App)
    .use(store)
    .mount('#app');
}

boot();
