import { Tile, Player } from '@Objects';
import { EventBus, getPropertyValue } from '@Utilities';
import { gameState } from '@Data/gameState.js';
import store from '../../store/index.js';

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

    // Warp-location name supplied — find the matching warpLocation object on this map
    if (this.scene.config?.warpLocationName) {
      const locations = this.scene.findInteractions('warpLocation');
      const obj = locations.find(l => l.name === this.scene.config.warpLocationName);
      if (obj) {
        this.addPlayerToScene(
          parseInt(obj.x / Tile.WIDTH),
          parseInt(obj.y / Tile.HEIGHT),
          getPropertyValue(obj.properties ?? [], 'layer', undefined)
        );
        return;
      }
      console.warn(`Interactables::player — warpLocation "${this.scene.config.warpLocationName}" not found, falling back to playerSpawn`);
    }

    // Legacy: raw coordinate object (used by Preload scene save-game restore)
    if (Object.keys(this.scene.config?.playerLocation ?? {}).length !== 0) {
      const loc = this.scene.config.playerLocation;
      this.addPlayerToScene(loc.x, loc.y, loc.charLayer);
      return;
    }

    let spawn = this.scene.findInteractions('playerSpawn');
    if (spawn === null || spawn.length === 0) {
      // Fall back to the first warpLocation on the map
      const warps = this.scene.findInteractions('warpLocation');
      if (warps && warps.length > 0) {
        const w = warps[0];
        console.warn(`Interactables::player — no playerSpawn found, using warpLocation "${w.name}" as fallback`);
        this.addPlayerToScene(
          parseInt(w.x / Tile.WIDTH),
          parseInt(w.y / Tile.HEIGHT),
          getPropertyValue(w.properties ?? [], 'layer', undefined)
        );
        return;
      }
      throw 'No player spawn found';
    }
    if (spawn.length > 1) {
      throw 'Only 1 player spawn can be in the map.';
    }

    this.addPlayerToScene(spawn[0].x / Tile.WIDTH, spawn[0].y / Tile.HEIGHT);
  }

  addPlayerToScene(x, y, charLayer) {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::player::addPlayerToScene', x, y);
    }
    this.loadedPlayer = true;
    this.player = new Player({
      id: 'player',
      texture: store.state.game.playerSprite ?? 'red',
      x: x,
      y: y,
      scene: this.scene,
      ...(charLayer ? { 'char-layer': charLayer } : {}),
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

    if (this.scene.game.config.gameFlags.follower_pokemon) {
      this._spawnFollowerMon({ x, y });
    }

  }

  _spawnFollowerMon(pos) {
    const lead = gameState.party[0];
    if (!lead) return;
    const spawnPos = pos ?? this.scene.gridEngine?.getPosition('player') ?? { x: 0, y: 0 };
    this.hasPlayerMon = true;
    this.playerMon = this.scene.mapPlugins.pokemon.addToScene(
      'playerMon',
      String(lead.species),
      spawnPos,
      {
        id: 'playerMon',
        collides: false,
        move: false,
        spin: false,
      }
    );
  }

  _despawnFollowerMon() {
    if (this.playerMon) {
      this.playerMon.remove();
      this.playerMon = null;
    }
    this.hasPlayerMon = false;
  }

  update(time, delta) {
    if (this.loadedPlayer) {
      this.player.update(time, delta);
    }
    if (this.hasPlayerMon && this.playerMon) {
      this.playerMon.update(time, delta);
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::player::event', this.scene]);
    }

    const savedFacing = store.state.game.playerFacing;
    if (savedFacing && this.player) {
      this.player.look(savedFacing);
      // Re-apply animation mapping after turnTowards so the idle frame
      // for the restored direction is drawn immediately.
      const frameDef = store.state.game.onBike
        ? this.player.characterFramesBikeDef()
        : this.player.characterFramesDef();
      this.player.gridengine.setWalkingAnimationMapping(this.player.config.id, frameDef);
    }

    if (store.state.game.onBike && this.player?.stateMachine) {
      this.player.stateMachine.setState(this.player.stateDef.BIKE);
    }

    // Trail subscription: when the player moves, step the follower into the
    // tile the player just vacated (Gen 3 "walk-behind" behavior).
    this._followerTrailSub = this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile }) => {
        if (charId !== 'player' || !this.hasPlayerMon || !this.playerMon) return;
        const followerId = this.playerMon.config?.id ?? 'playerMon';
        if (!this.scene.gridEngine.hasCharacter(followerId)) return;
        this.scene.gridEngine.moveTo(followerId, exitTile, {
          noPathFoundStrategy: 'STOP',
          pathBlockedStrategy: 'STOP',
        });
      });

    this._onFollowerChange = (enabled) => {
      if (enabled) {
        if (!this.hasPlayerMon) this._spawnFollowerMon();
      } else {
        this._despawnFollowerMon();
      }
    };
    this.scene.game.events.on('follower-pokemon-change', this._onFollowerChange);

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

  destroy() {
    if (this._followerTrailSub) {
      this._followerTrailSub.unsubscribe();
      this._followerTrailSub = null;
    }
    if (this._onFollowerChange) {
      this.scene.game.events.off('follower-pokemon-change', this._onFollowerChange);
    }
  }
};