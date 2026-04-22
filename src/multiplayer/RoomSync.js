import { multiplayerClient } from './Client.js';
import { C2S, S2C } from './protocol.js';
import RemotePlayer from './RemotePlayer.js';

export default class RoomSync {
  constructor(scene) {
    this.scene            = scene;
    this._remotePlayers   = new Map(); // sessionId -> RemotePlayer
    this._remoteFollowers = new Map(); // sessionId -> PkmnOverworld
    this._unsubs          = [];
    this._moveSub         = null;
    this._followerSub     = null;
  }

  init() {}

  event() {
    // If already connected when the map loads, join immediately.
    if (multiplayerClient.connected) {
      this._joinMap();
      this._subscribe();
      this._spawnFromRoster();
    }

    // Re-subscribe when the client (re)joins a room while this map is live.
    this._unsubs.push(
      multiplayerClient.on(S2C.JOINED, () => {
        this._joinMap();
        this._subscribe();
        this._spawnFromRoster();
      })
    );
  }

  /**
   * Walk the current room roster and spawn any peer that's already on
   * this map. Covers two cases the event stream doesn't:
   *   1. We just connected and received JOINED with a pre-populated roster.
   *   2. We warped to a new map inside the same room.
   */
  _spawnFromRoster() {
    const myMap  = this.scene.config.mapName;
    const selfId = multiplayerClient.sessionId;
    for (const player of multiplayerClient.players.values()) {
      if (player.sessionId === selfId) continue;
      if (player.mapId !== myMap) continue;
      if (this._remotePlayers.has(player.sessionId)) continue;
      this._spawn(player);
    }
  }

  _joinMap() {
    const mapId  = this.scene.config.mapName;
    const player = this.scene.mapPlugins?.['player']?.player;
    const spawn  = player ? player.getPosition() : { x: 0, y: 0 };
    const facing = this.scene.gridEngine?.hasCharacter('player')
      ? this.scene.gridEngine.getFacingDirection('player')
      : 'down';
    multiplayerClient.send(C2S.MAP, { mapId, spawn, facing });
  }

  _subscribe() {
    // Guard: only set up GE subscription once.
    if (!this._moveSub && this.scene.gridEngine) {
      this._moveSub = this.scene.gridEngine
        .positionChangeFinished()
        .subscribe(({ charId, enterTile, direction }) => {
          if (charId !== 'player' || !multiplayerClient.connected) return;
          multiplayerClient.send(C2S.MOVE, {
            x:     enterTile.x,
            y:     enterTile.y,
            dir:   direction,
            state: 'walk',
          });
        });
    }

    // Remote followers breadcrumb-trail their remote leader. When any
    // `remote_<sid>` character steps off a tile, move its follower onto the
    // tile it just vacated (Gen 2-style). Skip followers themselves so we
    // don't recurse.
    if (!this._followerSub && this.scene.gridEngine) {
      this._followerSub = this.scene.gridEngine
        .positionChangeStarted()
        .subscribe(({ charId, exitTile }) => {
          if (!charId.startsWith('remote_') || charId.startsWith('remote_follower_')) return;
          const sessionId = charId.slice('remote_'.length);
          const follower  = this._remoteFollowers.get(sessionId);
          if (!follower) return;
          this.scene.gridEngine.moveTo(follower.config.id, exitTile, {
            noPathFoundStrategy: 'STOP',
            pathBlockedStrategy: 'STOP',
          });
        });
    }

    this._unsubs.push(
      // PLAYER_JOINED is room-scoped: fires for every new member even if
      // they haven't picked a map yet. Only spawn a sprite for peers that
      // are demonstrably on *our* map.
      multiplayerClient.on(S2C.PLAYER_JOINED, ({ player }) => {
        if (player.mapId !== this.scene.config.mapName) return;
        if (this._remotePlayers.has(player.sessionId)) return;
        this._spawn(player);
      }),

      multiplayerClient.on(S2C.PLAYER_LEFT, ({ sessionId }) => {
        this._remove(sessionId);
      }),

      // A peer changed map. Four interesting cases:
      //   - they walked onto OUR map (not yet spawned) → spawn them.
      //   - they walked off OUR map → despawn them.
      //   - they're on OUR map and already spawned → this is the "fresh
      //     snapshot" echo the server sends when we enter a new map; peers
      //     who moved while we were off-map need their sprite snapped to
      //     the server's current position (our _spawnFromRoster ran
      //     synchronously with stale roster data).
      //   - neither on our map nor spawned → nothing to do.
      multiplayerClient.on(S2C.PLAYER_MAP, ({ sessionId, mapId, spawn, facing }) => {
        const myMap = this.scene.config.mapName;
        const had   = this._remotePlayers.has(sessionId);
        if (mapId === myMap && !had) {
          const player = multiplayerClient.players.get(sessionId);
          if (player) this._spawn(player);
        } else if (mapId !== myMap && had) {
          this._remove(sessionId);
        } else if (mapId === myMap && had && spawn) {
          const ge = this.scene.gridEngine;
          const remote = this._remotePlayers.get(sessionId);
          if (ge && remote) {
            const layer = ge.getCharLayer(remote.config.id);
            ge.stopMovement?.(remote.config.id);
            ge.setPosition(remote.config.id, spawn, layer);
            // Snap facing too, but defensively: the sprite may not have fully
            // initialised its frame data yet (e.g. the peer sprite texture is
            // still loading / is a 1-frame placeholder), and grid-engine's
            // setStandingFrame will crash on an undefined frame. Skip silently
            // — the next PLAYER_MOVE from the peer will realign facing anyway.
            if (facing && this._spriteHasFrames(remote)) {
              try { remote.look(facing.toUpperCase()); } catch (e) {
                console.warn('[RoomSync] remote.look skipped', sessionId, e?.message);
              }
            }
          }
          const follower = this._remoteFollowers.get(sessionId);
          if (ge && follower) {
            const fLayer = ge.getCharLayer(follower.config.id);
            ge.stopMovement?.(follower.config.id);
            ge.setPosition(follower.config.id, this._behindTile(spawn, facing ?? 'down'), fLayer);
          }
        }
      }),

      multiplayerClient.on(S2C.PLAYER_MOVE, ({ sessionId, x, y, dir }) => {
        const remote = this._remotePlayers.get(sessionId);
        if (!remote) return;
        remote.moveTo({ x, y }, { pathBlockedStrategy: 'WAIT' });
        if (dir) remote.look(dir.toUpperCase());
      }),

      // A peer patched their profile (rename, sprite swap, follower toggle).
      // Reflect it on the already-spawned RemotePlayer without a despawn.
      multiplayerClient.on(S2C.PLAYER_PROFILE, ({ sessionId, name, tid }) => {
        const remote = this._remotePlayers.get(sessionId);
        if (!remote) return;
        if (typeof name === 'string') remote.setPlayerName?.(name);
        if (Number.isFinite(tid)) remote.tid = (tid | 0) & 0xffff;
        // (sprite / follower swaps mid-session would need a de/re-spawn;
        // deferring until we actually need it.)
      }),
    );
  }

  _spawn(player) {
    const spawn   = player.spawn ?? { x: 0, y: 0 };
    const texture = this.scene.textures.exists(player.sprite) ? player.sprite : 'red';

    const remote = new RemotePlayer({
      id:          'remote_' + player.sessionId,
      texture,
      x:           spawn.x ?? 0,
      y:           spawn.y ?? 0,
      scene:       this.scene,
      playerName:  player.name ?? 'Trainer',
      tid:         player.tid ?? null,
    });

    this.scene.gridEngine.addCharacter(remote.characterDef());
    this.scene._indexCharacter(remote.config.id);
    // Add to scene.npcs so GameMap._updateCulledGroups ticks update() each
    // frame — RemotePlayer relies on that to reposition its name label after
    // grid-engine has moved the sprite to its actual pixel coords.
    this.scene.npcs?.add?.(remote);
    this._remotePlayers.set(player.sessionId, remote);

    this._spawnRemoteFollower(player, spawn);
  }

  /**
   * If the peer has a follower pokémon active, spawn it behind them using
   * the same pokemon plugin that handles the local playerMon. Uses the
   * async-texture-load path inside the plugin so unfamiliar species work.
   * The follower trails via the positionChangeStarted subscription wired
   * in `_subscribe()`.
   */
  _spawnRemoteFollower(player, spawn) {
    const species = player.follower?.species;
    if (!species) return;
    const pokemonPlugin = this.scene.mapPlugins?.pokemon;
    if (!pokemonPlugin?.addToScene) return;

    const behindSpawn = this._behindTile(spawn, player.facing ?? 'down');
    const followerId  = 'remote_follower_' + player.sessionId;
    const follower = pokemonPlugin.addToScene(
      followerId,
      species,
      behindSpawn,
      {
        id:       followerId,
        collides: false,
        move:     false,
        spin:     false,
        reflect:  true,
        'facing-direction': player.facing ?? 'down',
      }
    );
    if (follower) this._remoteFollowers.set(player.sessionId, follower);
  }

  _behindTile(tile, facing) {
    const offset = ({ up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } })[facing] ?? { x: 0, y: 1 };
    return { x: tile.x + offset.x, y: tile.y + offset.y };
  }

  // Guard against calling grid-engine's turnTowards on a sprite whose texture
  // hasn't fully wired up its frames yet (missing key / 1-frame placeholder /
  // mid-load spritesheet). In that state Phaser's setFrame bails with
  // "this.frame is undefined" and crashes the handler.
  _spriteHasFrames(sprite) {
    const tex = sprite?.texture;
    if (!tex || tex.key === '__MISSING' || tex.key === '__DEFAULT') return false;
    const count = tex.frameTotal ?? (tex.frames ? Object.keys(tex.frames).length : 0);
    // Standard 16-frame character sheet; anything less can't satisfy the
    // walkingAnimationMapping indices (up=12/13/15, left=4/5/7, etc.).
    return count >= 16 && !!sprite.frame;
  }

  _remove(sessionId) {
    const follower = this._remoteFollowers.get(sessionId);
    if (follower) {
      follower.remove?.();
      this._remoteFollowers.delete(sessionId);
    }
    const remote = this._remotePlayers.get(sessionId);
    if (!remote) return;
    remote.remove();
    this._remotePlayers.delete(sessionId);
  }

  update() {}

  destroy() {
    // During scene teardown, Phaser's DisplayList + Group shutdown already
    // tears down every sprite + group in the scene. Calling `_remove` here
    // re-enters `scene.npcs.remove()` on an already-destroyed Group (its
    // internal `children` list is null), which throws. Clear our local maps
    // only; sprite cleanup is Phaser's problem now.
    const status = this.scene?.sys?.settings?.status;
    const sceneDown = typeof status === 'number' && status >= 8;

    if (!sceneDown) {
      for (const sessionId of [...this._remotePlayers.keys()]) {
        this._remove(sessionId);
      }
    } else {
      this._remotePlayers.clear();
      this._remoteFollowers.clear();
    }

    this._unsubs.forEach(unsub => unsub?.());
    this._unsubs = [];
    this._moveSub?.unsubscribe();
    this._moveSub = null;
    this._followerSub?.unsubscribe();
    this._followerSub = null;
  }
}
