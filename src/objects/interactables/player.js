import { Tile, Player } from '@Objects';
import { EventBus, getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;

    this.loadedPlayer = false;
    this.player = {};
    this.playerMon = {};
    this.hasPlayerMon = false;
    
    this.jumpTiles = [];
  }
  
  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::player');
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
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::player::addPlayerToScene', x, y);
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
    if (this.scene.game.config.debug.tests.timeOverlay === true) {
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
    //   this.hasPlayerMon = true;
    //   this.playerMon = this.scene.addMonToScene('025', x +1, y, {
    //     id: 'playerMon',
    //     follow: this.player.config.id,
    //     collides: false,
    //     move: false,
    //     spin: false,
    //   });
    // }

  }

  update(time, delta) {
    if (this.loadedPlayer) {
      // console.log(['sceneMap::update::player', this.scene])
      this.player.update(time, delta);
    }
    // if (this.scene.get('Preload').enablePlayerOWPokemon) {
    //   this.playerMon.update();
    // }    
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::player::event', this.scene])
    }

    let layerTransitions = this.scene.findInteractions('layerTransition');
    if (layerTransitions.length === 0) { return; }

    layerTransitions.forEach(tile => {
      let from = getPropertyValue(tile.properties, 'from');
      let to = getPropertyValue(tile.properties, 'to');

      this.scene.gridEngine.setTransition({
        x: tile.x / Tile.WIDTH,
        y: tile.y / Tile.HEIGHT,
      }, from, to);
    });
  }
};