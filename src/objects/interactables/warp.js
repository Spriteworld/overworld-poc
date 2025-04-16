import Phaser from 'phaser';
import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (Debug.functions.interactables.warp) {
      console.log('Interactables::initWarp');
    }
    let warps = this.scene.findInteractions('warp');
    if (warps.length === 0) { return; }

    warps.forEach((obj) => {
      this.scene.registry.get('warps').push({
        name: obj.id,
        x: obj.x / Tile.WIDTH,
        y: obj.y / Tile.HEIGHT,
        obj: obj
      });
    });
  }

  update(char, exitTile, enterTile) {
    let warps = this.scene.registry.get('warps');
    if (warps.length === 0) { return; }

    let warp = warps.find(p => p.x === enterTile.x && p.y === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }

    // this.player.disableMovement();
    this.cameras.main.fadeOut(this.cameraFade, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      (cam, effect) => {
        let playerLocation = {
          x: getPropertyValue(warpProps, 'warp-x', 0),
          y: getPropertyValue(warpProps, 'warp-y', 0),
          dir: getPropertyValue(warpProps, 'warp-dir', 'down'),
          charLayer: getPropertyValue(warpProps, 'layer', 'ground')
        };

        // same map, we dont need to move scene
        if (this.scene.registry.get('map') === warpLocation) {
          this.warpPlayerInMap(playerLocation);
          this.cameras.main.fadeIn(this.cameraFade, 0, 0, 0);
          // this.player.enableMovement();
          return;
        }

        // new map!
        this.scene.start(warpLocation, {
          playerLocation: playerLocation
        });
        // this.player.enableMovement();
      }
    );
  }

  warpPlayerInMap(playerLocation) {
    let pos = {
      x: playerLocation.x,
      y: playerLocation.y
    };

    // move the player
    this.gridEngine.setPosition(this.player.config.id, pos, playerLocation.layer);
    this.player.look(playerLocation.dir);

    // get the pokemon to be in the right spot
    this.gridEngine.setPosition(
      this.playerMon.config.id,
      this.player.getPosInBehindDirection(),
      playerLocation.layer
    );
  }

}