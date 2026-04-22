import { C2S } from './protocol.js';

const RECONNECT_BASE = 1_000;
const RECONNECT_MAX  = 30_000;
const PING_INTERVAL  = 15_000;

/**
 * Build the ws:// endpoint from the same env vars the server binds to.
 * When the bind host is 0.0.0.0 (or blank) we fall back to the page's
 * own hostname — handy when the relay is proxied behind the same origin
 * as the Vite dev server.
 */
export function getServerUrl() {
  const rawHost = import.meta.env.VITE_MULTIPLAYER_HOST;
  const port    = import.meta.env.VITE_MULTIPLAYER_PORT ?? 2567;
  const host = (!rawHost || rawHost === '0.0.0.0')
    ? (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
    : rawHost;
  return `ws://${host}:${port}`;
}

class MultiplayerClient {
  constructor() {
    this._ws             = null;
    this._handlers       = new Map(); // type -> Set<fn>
    this._outbox         = [];
    this._reconnectDelay = RECONNECT_BASE;
    this._reconnectTimer = null;
    this._pingTimer      = null;
    this._url            = null;
    this._destroying     = false;

    this.sessionId = null;
    this.roomId    = null;
    this.connected = false; // true once inside a room
    this.players   = new Map(); // sessionId -> publicView (live roster)
  }

  get wsOpen() {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  connect(url) {
    this._url        = url;
    this._destroying = false;

    return new Promise((resolve, reject) => {
      if (this.wsOpen) { resolve(); return; }

      try {
        this._ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }

      this._attach(this._ws, resolve, reject);
    });
  }

  _attach(ws, resolve, reject) {
    ws.onopen = () => {
      this._reconnectDelay = RECONNECT_BASE;
      this._startPing();
      this._flushOutbox();
      resolve?.();
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const { type, ...payload } = msg;
      if (type === 'joined') {
        this.connected = true;
        this.sessionId = payload.sessionId;
        this.roomId    = payload.roomId;
        this.players.clear();
        (payload.players || []).forEach(p => {
          if (p?.sessionId) this.players.set(p.sessionId, p);
        });
      } else if (type === 'player-joined') {
        const p = payload.player;
        if (p?.sessionId) this.players.set(p.sessionId, p);
      } else if (type === 'player-left') {
        if (payload.sessionId) this.players.delete(payload.sessionId);
      } else if (type === 'player-map') {
        const existing = this.players.get(payload.sessionId);
        if (existing) this.players.set(payload.sessionId, {
          ...existing,
          mapId:  payload.mapId,
          spawn:  payload.spawn ?? existing.spawn,
          facing: payload.facing ?? existing.facing ?? 'down',
        });
      } else if (type === 'player-profile') {
        const existing = this.players.get(payload.sessionId);
        if (existing) {
          // Patch only the fields the server sent — leaves mapId / spawn /
          // facing untouched.
          const { sessionId, ...patch } = payload;
          this.players.set(sessionId, { ...existing, ...patch });
        }
      }
      this._emit(type, payload);
    };

    ws.onclose = () => {
      this.connected = false;
      this._stopPing();
      if (!this._destroying) this._scheduleReconnect();
    };

    ws.onerror = (e) => {
      reject?.(e);
    };
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX);
      this._ws = new WebSocket(this._url);
      this._attach(this._ws, null, null);
    }, this._reconnectDelay);
  }

  _startPing() {
    this._pingTimer = setInterval(() => this.send(C2S.PING), PING_INTERVAL);
  }

  _stopPing() {
    clearInterval(this._pingTimer);
    this._pingTimer = null;
  }

  _flushOutbox() {
    while (this._outbox.length && this.wsOpen) {
      this._ws.send(this._outbox.shift());
    }
  }

  send(type, payload = {}) {
    const msg = JSON.stringify({ type, ...payload });
    if (this.wsOpen) {
      this._ws.send(msg);
    } else {
      this._outbox.push(msg);
    }
  }

  // Returns an unsubscribe function.
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this._handlers.get(type)?.delete(handler);
  }

  _emit(type, payload) {
    const set = this._handlers.get(type);
    if (set) for (const h of set) h(payload);
  }

  close() {
    this._destroying = true;
    clearTimeout(this._reconnectTimer);
    this._stopPing();
    this._ws?.close();
    this._ws       = null;
    this.connected = false;
    this.sessionId = null;
    this.roomId    = null;
    this.players.clear();
    this._outbox   = [];
  }

  /**
   * Idempotent "bring me online" entry point used on game boot and from
   * the Online menu. Opens the socket (if not already), sends JOIN with
   * the given profile, and — unless the caller opts out — joins the
   * global room. Multiple rapid calls (boot + menu open) coalesce to a
   * single connection attempt.
   *
   * @param {object}   profile
   * @param {string}   profile.name
   * @param {string}   profile.sprite
   * @param {object?}  profile.follower  — { species } or null
   * @param {object}   [opts]
   * @param {boolean}  [opts.joinGlobal=true]
   */
  /**
   * Push a partial profile patch (`{ name, sprite, follower, tid }`) to
   * the server, which fans it out to room peers. Used when the player
   * renames / swaps sprite / toggles follower mid-session. No-op when not
   * connected — callers don't have to guard.
   */
  updateProfile(patch) {
    if (!this.wsOpen) return;
    this.send(C2S.PROFILE, patch ?? {});
  }

  async autoJoin(profile, { joinGlobal = true } = {}) {
    if (this.connected) return;
    if (this._joining) return this._joining;
    this._joining = (async () => {
      try {
        if (!this.wsOpen) await this.connect(getServerUrl());
        this.send(C2S.JOIN, {
          name:     profile.name,
          sprite:   profile.sprite,
          tid:      profile.tid ?? null,
          follower: profile.follower ?? null,
          version:  '1',
        });
        if (joinGlobal) this.send(C2S.JOIN_GLOBAL);
      } finally {
        this._joining = null;
      }
    })();
    return this._joining;
  }
}

export const multiplayerClient = new MultiplayerClient();
