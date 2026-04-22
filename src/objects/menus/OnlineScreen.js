import store from '../../store/index.js';
import { multiplayerClient } from '@/multiplayer/Client.js';
import { C2S, S2C } from '@/multiplayer/protocol.js';
import { gameState } from '@Data/gameState.js';
import {
  SX, SY, SW, SH,
  TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT,
} from './layout.js';

const ROW_H  = 28;
const LIST_Y = SY + 108;

/**
 * Builds the profile payload sent with JOIN — the auto-connect on
 * gameplay entry and the menu-driven reconnect share this helper.
 */
function _buildProfile() {
  const lead = gameState.party[0];
  return {
    name:     store.state.game.playerName,
    sprite:   store.state.game.playerSprite,
    tid:      store.state.game.trainerId,
    follower: (store.state.game.gameFlags.follower_pokemon && lead)
      ? { species: String(lead.species).padStart(3, '0') }
      : null,
  };
}

export default class OnlineScreen {
  constructor(menu) {
    this.menu    = menu;
    this._cursor = 0;
    this._code   = null;

    // Keep 'connecting' alive across rebuilds until JOINED or ERROR fires.
    this._connecting = false;

    this._unsubs = [
      multiplayerClient.on(S2C.JOINED, ({ roomId }) => {
        this._connecting = false;
        this._rebuild();
      }),
      multiplayerClient.on(S2C.ROOM_CODE, ({ code }) => {
        this._code = code;
        this._rebuild();
      }),
      multiplayerClient.on(S2C.ERROR, () => {
        this._connecting = false;
        this._rebuild();
      }),
      // Live roster updates — keep the on-screen list in sync when peers
      // come and go or change maps.
      multiplayerClient.on(S2C.PLAYER_JOINED,  () => this._rebuild()),
      multiplayerClient.on(S2C.PLAYER_LEFT,    () => this._rebuild()),
      multiplayerClient.on(S2C.PLAYER_MAP,     () => this._rebuild()),
      multiplayerClient.on(S2C.PLAYER_PROFILE, () => this._rebuild()),
    ];
  }

  show() {
    this._cursor     = 0;
    this._connecting = false;
    if (!multiplayerClient.connected) this._code = null;
    this.build();
    // Auto-join the global room on first open. Users who want a private
    // room can still Disconnect → Create private room from here.
    if (!multiplayerClient.connected && !multiplayerClient.wsOpen) {
      this._doJoinGlobal();
    }
  }

  _options() {
    if (multiplayerClient.connected) {
      return [
        { key: 'create-room', label: 'Create private room' },
        { key: 'join-global', label: 'Join global room'    },
        { key: 'disconnect',  label: 'Disconnect'          },
      ];
    }
    return [
      { key: 'join-global',  label: 'Join global room'    },
      { key: 'create-room',  label: 'Create private room' },
    ];
  }

  build() {
    const { scene, reg } = this.menu;

    reg(scene.add.text(SX + 16, SY + 16, 'ONLINE', TEXT_STYLE_BOLD));

    const sep = scene.add.graphics();
    sep.lineStyle(1, 0xaaaaaa);
    sep.lineBetween(SX + 8, SY + 40, SX + SW - 8, SY + 40);
    reg(sep);

    // ── Status ──────────────────────────────────────────────────────────────
    let statusLabel = 'Offline';
    let statusColor = '#888888';

    if (this._connecting) {
      statusLabel = 'Connecting...';
      statusColor = '#997700';
    } else if (multiplayerClient.connected) {
      const roomId = multiplayerClient.roomId ?? '...';
      statusLabel  = 'Online  —  ' + roomId;
      statusColor  = '#006600';
    }

    reg(scene.add.text(SX + 16, SY + 52, 'Status:', TEXT_STYLE_BODY));
    reg(scene.add.text(SX + 88, SY + 52, statusLabel, { ...TEXT_STYLE_BODY, color: statusColor }));

    // ── Private room code ────────────────────────────────────────────────────
    if (this._code && multiplayerClient.connected) {
      reg(scene.add.text(SX + 16, SY + 76, 'Code:', TEXT_STYLE_BODY));
      reg(scene.add.text(SX + 88, SY + 76, this._code, TEXT_STYLE_BOLD));
      reg(scene.add.text(SX + 88 + 68, SY + 76, '(share with a friend)', TEXT_STYLE_HINT));
    }

    // ── Menu options ─────────────────────────────────────────────────────────
    const opts = this._options();
    opts.forEach(({ label }, i) => {
      const prefix = i === this._cursor ? '▶ ' : '  ';
      reg(scene.add.text(SX + 16, LIST_Y + i * ROW_H, prefix + label, TEXT_STYLE_BODY));
    });

    // ── Player roster (right column) ────────────────────────────────────────
    this._buildRoster();

    reg(scene.add.text(SX + 16, SY + SH - 22, '▲▼ select   Z confirm   X back', TEXT_STYLE_HINT));
  }

  _rebuild() {
    if (this.menu._currentScreen !== 'online') return;
    this.menu._clearSubTexts();
    this.build();
  }

  /**
   * Render the live room roster in the right half of the screen. Shows
   * every player currently in the room, marks the local player `(you)`,
   * and lists their current map so you can tell who's on your screen
   * vs. somewhere else in the world.
   */
  _buildRoster() {
    const { scene, reg } = this.menu;
    const RX = SX + 400;
    const RY = SY + 52;

    if (!multiplayerClient.connected) {
      reg(scene.add.text(RX, RY, 'Players:', TEXT_STYLE_BOLD));
      reg(scene.add.text(RX, RY + 22, '(offline)', TEXT_STYLE_HINT));
      return;
    }

    const roster = [...multiplayerClient.players.values()];
    // Ensure the local player shows in the list even if the server's
    // JOINED roster excluded us (it does — server sends peers only).
    const selfId = multiplayerClient.sessionId;
    if (selfId && !roster.some(p => p.sessionId === selfId)) {
      roster.unshift({
        sessionId: selfId,
        name:      store.state.game.playerName,
        mapId:     this.menu.scene?.registry?.get?.('map') ?? null,
      });
    }
    roster.sort((a, b) => {
      if (a.sessionId === selfId) return -1;
      if (b.sessionId === selfId) return  1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

    reg(scene.add.text(RX, RY, `Players (${roster.length}):`, TEXT_STYLE_BOLD));

    const MAX_ROWS = 10;
    const shown    = roster.slice(0, MAX_ROWS);
    shown.forEach((p, i) => {
      const y     = RY + 22 + i * 18;
      const isYou = p.sessionId === selfId;
      const name  = (p.name ?? 'Trainer') + (isYou ? '  (you)' : '');
      const map   = this._prettyMap(p.mapId);
      reg(scene.add.text(RX,      y, name, TEXT_STYLE_BODY));
      reg(scene.add.text(RX + 140, y, map, TEXT_STYLE_HINT));
    });

    if (roster.length > MAX_ROWS) {
      const more = roster.length - MAX_ROWS;
      reg(scene.add.text(RX, RY + 22 + MAX_ROWS * 18,
        `… +${more} more`, TEXT_STYLE_HINT));
    }
  }

  _prettyMap(key) {
    if (!key) return '—';
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  }

  nav(delta) {
    const len    = this._options().length;
    this._cursor = (this._cursor + delta + len) % len;
    this.menu._clearSubTexts();
    this.build();
  }

  confirm() {
    const { key } = this._options()[this._cursor];
    if (key === 'join-global')  this._doJoinGlobal();
    if (key === 'create-room')  this._doCreateRoom();
    if (key === 'disconnect')   this._doDisconnect();
  }

  async _doJoinGlobal() {
    this._connecting = true;
    this._cursor     = 0;
    this._rebuild();
    try {
      await multiplayerClient.autoJoin(_buildProfile());
    } catch {
      this._connecting = false;
      this._rebuild();
    }
  }

  async _doCreateRoom() {
    this._connecting = true;
    this._code       = null;
    this._cursor     = 0;
    this._rebuild();
    try {
      await multiplayerClient.autoJoin(_buildProfile(), { joinGlobal: false });
      multiplayerClient.send(C2S.CREATE_ROOM);
    } catch {
      this._connecting = false;
      this._rebuild();
    }
  }

  _doDisconnect() {
    multiplayerClient.close();
    this._connecting = false;
    this._code       = null;
    this._cursor     = 0;
    this._rebuild();
  }

  destroy() {
    this._unsubs.forEach(unsub => unsub?.());
    this._unsubs = [];
  }
}
