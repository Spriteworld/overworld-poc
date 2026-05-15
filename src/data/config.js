import Phaser from 'phaser';
import GridEngine from 'grid-engine';
import AnchorPlugin from 'phaser3-rex-plugins/plugins/anchor-plugin.js';
import AnimatedTiles from 'phaser-animated-tiles-phaser3.5/dist/AnimatedTiles';
import Scenes from '@Scenes';

import { BattleScene, EvolutionScene } from '@spriteworld/battle';
import { registerBattlePipelines } from '@Worlds/_base/shaders';

const config = {
  parent: 'game-container',
  type: Phaser.AUTO,
  width: 1920,
  height: 1024,
  pixelArt: true,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  input: {
    gamepad: true,
    touch: {
      capture: false,
    },
  },
  fps: {
    target: 30,
  },
  physics: {
    default: 'arcade',
    arcade: {debug: true}
  },
  plugins: {
    global: [
      { key: 'rexAnchor', plugin: AnchorPlugin, start: true },
    ],
    scene: [
      { key: 'gridEngine', plugin: GridEngine, mapping: 'gridEngine' },
      { key: 'animatedTiles', plugin: AnimatedTiles, mapping: 'animatedTiles' },
    ]
  },
  scene: [Scenes.Preload, BattleScene, EvolutionScene],
  callbacks: {
    postBoot: (game) => {
      registerBattlePipelines(game);
      game.canvas.style.width = '100%';
      game.canvas.style.height = '100%';
      window.dispatchEvent(new Event('resize'));
    }
  }
};

export default config;
