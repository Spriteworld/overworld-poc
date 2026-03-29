import Phaser from 'phaser';
import GridEngine from 'grid-engine';
import AnchorPlugin from 'phaser3-rex-plugins/plugins/anchor-plugin.js';
import AnimatedTiles from 'phaser-animated-tiles-phaser3.5/dist/AnimatedTiles';
import Scenes from '@Scenes';

import { BattleScene, EvolutionScene } from '@spriteworld/battle';

const config = {
  parent: 'game-container',
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  pixelArt: true,
  disableContextMenu: true,
  fps: {
    target: 30,
    forceSetTimeOut: true,
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
      game.canvas.style.width = '100%';
      game.canvas.style.height = '100%';
      game.canvas.style['object-fit'] = 'contain';
      window.dispatchEvent(new Event('resize'));
    }
  }
};

export default config;
