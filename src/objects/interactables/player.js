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
      reflect: true,
      tid: store.state.game.trainerId,
      ...(charLayer ? { 'char-layer': charLayer } : {}),
    });
    this.scene.registry.set('player', this.player);
    const smoothCam = !!this.scene.game.config.debug?.smoothCam;
    const lerp = smoothCam ? 0.3 : 1;
    this.scene.cameras.main.startFollow(this.player, true, lerp, lerp);
    this.scene.cameras.main.setFollowOffset(-(this.player.width/2), -(this.player.height/2));
    this.scene.cameras.main.setSize(25 * Tile.WIDTH, 19 * Tile.HEIGHT);
    if (smoothCam) {
      // Snap to the player on scene entry so the lerp doesn't pan in from (0,0).
      // `this.player.x/y` are still tile indices here — GridEngine moves the sprite to
      // real pixel coords later in GameMap.createCharacters(), so we compute the pixel
      // position directly from the tile coords passed in.
      this.scene.cameras.main.centerOn(
        x * Tile.WIDTH  + this.player.width  / 2,
        y * Tile.HEIGHT + this.player.height / 2
      );
    }

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

    if (store.state.game.gameFlags.follower_pokemon && !store.state.game.onBike) {
      this._spawnFollowerMon({ x, y });
    }

  }

  _spawnFollowerMon(pos) {
    const lead = gameState.party[0];
    if (!lead) return;
    const playerPos = pos ?? this.scene.gridEngine?.getPosition('player') ?? { x: 0, y: 0 };
    const facing = store.state.game.playerFacing ?? 'down';
    const behind = { up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } }[facing];
    const spawnPos = { x: playerPos.x + behind.x, y: playerPos.y + behind.y };
    this.hasPlayerMon = true;
    this.playerMon = this.scene.mapPlugins.pokemon.addToScene(
      'playerMon',
      String(lead.species),
      spawnPos,
      {
        id: 'playerMon',
        collides: { collidesWithTiles: true, collisionGroups: [] },
        move: false,
        spin: false,
        reflect: true,
        'facing-direction': facing,
      }
    );
  }

  _behindPlayerTile(playerTile) {
    const ge = this.scene.gridEngine;
    const facing = ge.getFacingDirection('player');
    const offset = { up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } }[facing] ?? { x: 0, y: 1 };
    return { x: playerTile.x + offset.x, y: playerTile.y + offset.y };
  }

  _teleportFollowerBehind(playerTile) {
    const ge = this.scene.gridEngine;
    const followerId = this.playerMon?.config?.id ?? 'playerMon';
    if (!ge?.hasCharacter(followerId)) return;
    ge.setPosition(followerId, this._behindPlayerTile(playerTile), ge.getCharLayer('player'));
  }

  _walkFollowerBehind(playerTile) {
    const ge = this.scene.gridEngine;
    const followerId = this.playerMon?.config?.id ?? 'playerMon';
    if (!ge?.hasCharacter(followerId)) return;
    ge.setSpeed(followerId, ge.getSpeed('player'));
    ge.moveTo(followerId, this._behindPlayerTile(playerTile), {
      noPathFoundStrategy: 'CLOSEST_REACHABLE',
      pathBlockedStrategy: 'STOP',
    });
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
    // tile the player just vacated (Gen 3 "walk-behind" behavior). Match the
    // player's current speed so the follower keeps up when running. If the
    // follower falls too far behind (warp, long sprint), snap it in behind.
    this._followerTrailSub = this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        if (charId !== 'player' || !this.hasPlayerMon || !this.playerMon) return;
        const ge = this.scene.gridEngine;
        const followerId = this.playerMon.config?.id ?? 'playerMon';
        if (!ge.hasCharacter(followerId)) return;

        const followerPos = ge.getPosition(followerId);
        const dist = Math.max(
          Math.abs(followerPos.x - exitTile.x),
          Math.abs(followerPos.y - exitTile.y),
        );
        if (dist > 3) {
          this._teleportFollowerBehind(enterTile);
          return;
        }
        const onPlayerTarget = followerPos.x === enterTile.x && followerPos.y === enterTile.y;
        if (onPlayerTarget) {
          this._walkFollowerBehind(enterTile);
          return;
        }

        ge.setSpeed(followerId, ge.getSpeed('player'));
        ge.moveTo(followerId, exitTile, {
          noPathFoundStrategy: 'STOP',
          pathBlockedStrategy: 'STOP',
        });
      });

    // Safety net: after any player move settles, if the follower is overlapping
    // the player, snap it behind. Covers races where the follower's own moveTo
    // completed onto the player's new tile or any warp/teleport edge case.
    this._followerSettleSub = this.scene.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, enterTile }) => {
        if (charId !== 'player' || !this.hasPlayerMon || !this.playerMon) return;
        const ge = this.scene.gridEngine;
        const followerId = this.playerMon.config?.id ?? 'playerMon';
        if (!ge.hasCharacter(followerId)) return;
        const followerPos = ge.getPosition(followerId);
        if (followerPos.x === enterTile.x && followerPos.y === enterTile.y) {
          this._walkFollowerBehind(enterTile);
        }
      });

    this._onFollowerChange = (enabled) => {
      if (enabled) {
        if (!this.hasPlayerMon && !store.state.game.onBike) this._spawnFollowerMon();
      } else {
        this._despawnFollowerMon();
      }
    };
    this.scene.game.events.on('follower-pokemon-change', this._onFollowerChange);

    this._onBikeChange = (onBike) => {
      if (onBike) {
        this._despawnFollowerMon();
      } else if (store.state.game.gameFlags.follower_pokemon && !this.hasPlayerMon) {
        this._spawnFollowerMon();
      }
    };
    this.scene.game.events.on('player-bike-change', this._onBikeChange);

    let layerTransitions = this.scene.findInteractions('layerTransition');
    if (layerTransitions.length === 0) { return; }

    const debug = this.scene.game.config.debug?.console?.gameMap;
    layerTransitions.forEach(tile => {
      let from = getPropertyValue(tile.properties, 'from');
      let to   = getPropertyValue(tile.properties, 'to');
      // Tiled rectangle objects use top-left x/y. For tile-aligned transition
      // markers `tile.x / Tile.WIDTH` is integer; floor anyway in case Tiled
      // ever exports a half-tile offset that would otherwise key the
      // transition at e.g. 24.5 and never match the character's integer pos.
      const x = Math.floor(tile.x / Tile.WIDTH);
      const y = Math.floor(tile.y / Tile.HEIGHT);
      if (debug) {
        console.log(`[layerTransition] (${x}, ${y}) ${from} ↔ ${to}`);
      }
      if (!from || !to) {
        console.warn(`[layerTransition] missing from/to at (${x}, ${y})`, tile);
        return;
      }

      const layer = this.scene.gridEngine.getCharLayer?.('player');
      console.log('[layerTransition] player layer:', layer);
      if (layer === from) {
        this.scene.gridEngine.setTransition({ x, y }, from, to);
      }
      if (layer === to) {
        this.scene.gridEngine.setTransition({ x, y }, to, from);
      }
    });
  }

  destroy() {
    if (this._followerTrailSub) {
      this._followerTrailSub.unsubscribe();
      this._followerTrailSub = null;
    }
    if (this._followerSettleSub) {
      this._followerSettleSub.unsubscribe();
      this._followerSettleSub = null;
    }
    if (this._onFollowerChange) {
      this.scene.game.events.off('follower-pokemon-change', this._onFollowerChange);
    }
    if (this._onBikeChange) {
      this.scene.game.events.off('player-bike-change', this._onBikeChange);
    }
  }
};