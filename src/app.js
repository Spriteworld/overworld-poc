import '@/assets/app.css';

import Phaser from 'phaser';
import registerTiledJSONExternalLoader from 'phaser-tiled-json-external-loader';

import { config } from '@Data'
import { Game } from '@Objects'

registerTiledJSONExternalLoader(Phaser);

window.spriteworld = new Game(config);
