import Phaser from 'phaser';
import Debug from '@Data/debug.js';
import { Tile } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
    this.warps = [];
    this.player = {};
  }

  init() {
    if (Debug.functions.interactables.warp) {
      console.log('Interactables::warp', this.scene.config.mapName);
    }

    let warps = this.scene.findInteractions('warp');
    if (warps.length === 0) { return; }

    // empty the warps, and reset them to the current maps warps
    this.scene.registry.set('warps', []);
    warps.forEach((obj) => {
      this.scene.registry.get('warps').push({
        name: obj.id,
        x: obj.x / Tile.WIDTH,
        y: obj.y / Tile.HEIGHT,
        obj: obj
      });
    });
    this.warps = this.scene.registry.get('warps');
  }

  event() {
    if (Debug.functions.interactables.warp) {
      console.log(['Interactables::warp::event', this.scene])
    }

    // handle warp tiles
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.config['ignore-warp'] === true) { return; }

        this.handleWarps(char, exitTile, enterTile);
      });
  }

  handleWarps(char, exitTile, enterTile) {
    if (this.warps.length === 0) { return; }

    let warp = this.warps.find(p => p.x === enterTile.x && p.y === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }
    let playerLocation = {
      x: getPropertyValue(warpProps, 'warp-x', 0),
      y: getPropertyValue(warpProps, 'warp-y', 0),
      dir: getPropertyValue(warpProps, 'warp-dir', 'down'),
      charLayer: getPropertyValue(warpProps, 'layer', 'ground')
    };

    if (Debug.functions.interactables.warp) {
      console.log(['Interactables::warp::handleWarps', 'char is trying to warp', char.name, 'to', warpLocation]);
    }
    if (char.config.type !== 'player') {
      if (this.scene.registry.get('map') === warpLocation) {
        this.warpPlayerInMap(char, playerLocation);
      }
      char.visible = false;
      return;
    }

    char.disableMovement();
    this.scene.cameras.main.fadeOut(this.cameraFade, 0, 0, 0);
    this.scene.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      (cam, effect) => {
        // this.scene.game.events.emit('toast', warpLocation);
        // same map, we dont need to move scene
        if (this.scene.registry.get('map') === warpLocation) {
          this.warpPlayerInMap(char, playerLocation);
          this.scene.cameras.main.fadeIn(this.cameraFade, 0, 0, 0);
          char.enableMovement();
          return;
        }

        // new map!
        this.scene.registry.set('map', warpLocation);
        this.scene.scene.start(warpLocation, {
          playerLocation: playerLocation
        });
        char.enableMovement();
      }
    );
  }

  warpPlayerInMap(char, playerLocation) {
    let pos = {
      x: playerLocation.x,
      y: playerLocation.y
    };

    // move the player
    this.scene.gridEngine.setPosition(char.name, pos, playerLocation.layer);
    char.look(playerLocation.dir);

    if (this.scene.mapPlugins['player'].hasPlayerMon) {
      // get the pokemon to be in the right spot
      this.scene.gridEngine.setPosition(
        this.playerMon.config.id,
        char.getPosInBehindDirection(),
        playerLocation.layer
      );
    }
  }

}