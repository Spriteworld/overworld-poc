import Debug from '@Data/debug.js';
import { Tile, Player } from '@Objects';

export default class {
  constructor(scene) {
    this.scene = scene;

    this.loadedPlayer = false;
    this.player = {};
    this.playerMon = {};

    this.jumpTiles = [];
  }
  
  init() {
    this.scene.eventPlugins.set('player', this.event.bind(this));
    if (Debug.functions.gameMap) {
      console.log('GameMap::initPlayer');
    }

    if (Object.keys(this.scene.config?.playerLocation).length != 0) {
      this.addPlayerToScene(this.scene.config.playerLocation.x, this.scene.config.playerLocation.y);
      return;
    }

    let spawn = this.scene.findInteractions('playerSpawn');
    if (typeof spawn === null || spawn.length === 0) {
      throw 'No player spawn found';
    }
    if (spawn.length > 1) {
      throw 'Only 1 player spawn can be in the map.';
    }

    this.addPlayerToScene(spawn[0].x / Tile.WIDTH, spawn[0].y / Tile.HEIGHT);
  }

  addPlayerToScene(x, y) {
    // this.tintTile(this.config.tilemap,
    //   this.config.playerLocation.length > 0 ? this.config.playerLocation.x : x,
    //   this.config.playerLocation.length > 0 ? this.config.playerLocation.y : y,
    //   random_rgba()
    // );

    if (Debug.functions.gameMap) {
      console.log('GameMap::addPlayerToScene', x, y);
    }
    this.loadedPlayer = true;
    this.player = new Player({
      id: 'player',
      texture: 'red',
      x: x,
      y: y,
      scene: this.scene,
      'seen-radius': 3,
    });
    this.scene.registry.set('player', this.player);
    this.scene.cameras.main.startFollow(this.player, true, 1);
    this.scene.cameras.main.setFollowOffset(-(this.player.width/2), -(this.player.height/2));
    this.scene.cameras.main.setSize(25 * Tile.WIDTH, 19 * Tile.HEIGHT);

    // debug for time overlay stuffs
    if (Debug.functions.timeOverlay === true) {
      this.scene.cameras.main.setSize(400, 300);

      // evening
      let cam2 = this.scene.cameras.add(400, 0, 400, 300);
      cam2.startFollow(this.player, true);
      cam2.setFollowOffset(-this.player.width, -this.player.height);

      // night
      let cam3 = this.scene.cameras.add(0, 300, 400, 300);
      cam3.startFollow(this.player, true);
      cam3.setFollowOffset(-this.player.width, -this.player.height);

      // morning
      let cam4 = this.scene.cameras.add(400, 300, 400, 300);
      cam4.startFollow(this.player, true);
      cam4.setFollowOffset(-this.player.width, -this.player.height);
    }

    // if (this.scene.get('Preload').enablePlayerOWPokemon) {
    //   this.playerMon = this.scene.addMonToScene('025', x +1, y, {
    //     id: 'playerMon',
    //     follow: this.player.config.id,
    //     collides: false,
    //     move: false,
    //     spin: false,
    //   });
    // }
  }

  event() {
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        // check for jump ledges
        // this.handleJumps(char, exitTile, enterTile);
      });
  }

  handleJumps(char, exitTile, enterTile) {
    if (this.jumpTiles.length === 0) { return; }

    let isJumpTile = this.jumpTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isJumpTile) {
      char.stateMachine.setState(char.stateDef.JUMP_LEDGE);
    }
  }
};