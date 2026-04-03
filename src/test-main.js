import { createApp } from 'vue';
import store from './store/index.js';
import TestMapPage from './test-map/TestMapPage.vue';

import '@/assets/app.css';

import Phaser from 'phaser';
import registerTiledJSONExternalLoader from 'phaser-tiled-json-external-loader';

registerTiledJSONExternalLoader(Phaser);

createApp(TestMapPage)
  .use(store)
  .mount('#app');
