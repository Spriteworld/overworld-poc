import App from './App.vue';
import { createApp } from 'vue';
import store from './store/index.js';

import '@/assets/app.css';

import Phaser from 'phaser';
import registerTiledJSONExternalLoader from 'phaser-tiled-json-external-loader';

registerTiledJSONExternalLoader(Phaser);

createApp(App)
  .use(store)
  .mount('#app');