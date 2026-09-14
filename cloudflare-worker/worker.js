import { DurableObject } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// Mahjong DJ — room relay (Cloudflare Worker + Durable Object)
//
// One Durable Object instance == one room code. The HOST's browser is the
// only authoritative game engine (it owns the deck, hands, timers, scoring);
// this Worker just relays JSON messages between the host and up to 3 guests,
// plus tracks lobby/ready state.
//
// Key design points (see README-FIXES.md in the project root for the full
// story of what changed and why):
//   - Every player gets a random `token` the first time they join a room.
//     The token (not the WebSocket) is that player's identity. A dropped
//     WebSocket does NOT free the seat immediately — it's just marked
//     disconnected, so the same token can `rejoin` it later, including
//     while a match is in progress.
//   - `rejoin` is the ONLY message type allowed to succeed while
//     `started === true`. `createRoom`/`joinRoom` are for brand-new seats
//     and are intentionally blocked once a match has started.
//   - `rematch` (host-only) reopens the SAME room code for another match
//     without anyone needing a new invite link: it clears `started` and
//     every player's `ready` flag, and the lobby is re-broadcast.
// ---------------------------------------------------------------------------

const MAX_PLAYERS = 4;
const HOST_SEAT = 0;
const ROOM_IDLE_TTL_MS = 6 * 60 * 60 * 1000; // fully reset a room after 6h with nobody connected
const SEAT_GRACE_MS = 5 * 60 * 1000; // how long a disconnected player's seat stays reserved for them

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cleanName(name) {
  return String(name || "Player").trim().slice(0, 20) || "Player";
}

function validCode(code) {
  return /^\d{5}$/.test(String(code || ""));
}

function cleanToken(token) {
  const t = String(token || "").trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(t) ? t : "";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "mahjong-room", now: Date.now() });
    }

    if (url.pathname === "/ws") {
      if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const code = (url.searchParams.get("room") || "").trim();
      if (!validCode(code)) return json({ error: "Room code harus 5 digit." }, 400);
      const id = env.MAHJONG_ROOMS.idFromName(code);
      const stub = env.MAHJONG_ROOMS.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/") {
      return json({ ok: true, service: "Mahjong DJ room server", endpoints: ["/health", "/ws?room=12345&role=host|guest&name=..."] });
    }

    return new Response("Not found", { status: 404 });
  },
};

export class MahjongRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.roomCode = null;
    this.hostSeat = HOST_SEAT;
    // players[seat] = { id, token, name, ready, connected, disconnectedAt }
    this.players = [null, null, null, null];
    // ws -> { seat, id, role, name, token }
    this.connections = new Map();
    this.lastState = null; // most recent authoritative game snapshot from the host
    this.started = false;
    this.lastActivity = Date.now();
  }

  touch() {
    this.lastActivity = Date.now();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const room = (url.searchParams.get("room") || "").trim();
    const role = url.searchParams.get("role") === "host" ? "host" : "guest";
    const name = cleanName(url.searchParams.get("name"));
    if (!validCode(room)) return new Response("Invalid room code", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    const clientId = crypto.randomUUID();
    this.roomCode = this.roomCode || room;
    this.touch();
    this.connections.set(server, { seat: null, id: clientId, role, name, token: null });

    server.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        this.send(server, { type: "error", message: "Pesan tidak valid." });
        return;
      }
      Promise.resolve(this.handle(server, msg)).catch((err) => {
        this.send(server, { type: "error", message: (err && err.message) || "Room error." });
      });
    });
    server.addEventListener("close", () => this.detach(server, false));
    server.addEventListener("error", () => this.detach(server, false));

    this.send(server, { type: "hello", clientId, room });
    return new Response(null, { status: 101, webSocket: client });
  }

  async handle(ws, msg) {
    const meta = this.connections.get(ws);
    if (!meta || !msg || typeof msg.type !== "string") return;
    this.touch();

    switch (msg.type) {
      case "createRoom":
        return this.createRoom(ws, meta, msg);
      case "joinRoom":
        return this.joinRoom(ws, meta, msg);
      case "rejoin":
        return this.rejoin(ws, meta, msg);
      case "ready":
        return this.setReady(ws, !!msg.ready);
      case "start":
        return this.startGame(ws);
      case "rematch":
        return this.rematch(ws);
      case "state":
        return this.forwardState(ws, msg.state);
      case "action":
        return this.forwardAction(ws, msg.action || {});
      case "leave":
        return this.detach(ws, true);
      case "ping":
        return this.send(ws, { type: "pong", now: Date.now() });
      default:
        return this.send(ws, { type: "error", message: `Perintah '${msg.type}' tidak dikenali.` });
    }
  }

  findHostSocket() {
    for (const [ws, meta] of this.connections) {
      if (meta.seat === this.hostSeat && meta.role === "host") return ws;
    }
    return null;
  }

  // A brand-new host claiming a brand-new room code (normal "Buat Room" flow).
  async createRoom(ws, meta, msg) {
    const existingHost = this.players[this.hostSeat];
    if (existingHost && existingHost.connected) {
      const liveSocket = this.findHostSocket();
      if (liveSocket && liveSocket !== ws) {
        this.send(ws, { type: "error", message: "Room ini sudah memiliki host yang aktif." });
        return;
      }
    }
    const name = cleanName(msg.name || meta.name);
    const token = cleanToken(msg.token) || crypto.randomUUID();
    if (meta.seat !== null && meta.seat !== this.hostSeat) this.players[meta.seat] = null;
    this.players[this.hostSeat] = { id: meta.id, name, ready: true, token, connected: true, disconnectedAt: null };
    meta.seat = this.hostSeat;
    meta.role = "host";
    meta.name = name;
    meta.token = token;
    this.started = false;
    this.lastState = null;
    this.sendJoined(ws, true, token);
    this.broadcastLobby();
  }

  // A brand-new guest joining a NOT-YET-STARTED room (normal "Gabung Room" flow).
  async joinRoom(ws, meta, msg) {
    if (this.started) {
      this.send(ws, {
        type: "error",
        message: "Game sudah dimulai. Minta host menekan 'Main Lagi' agar room bisa dimasuki lagi.",
      });
      return;
    }
    const requested = Number.isInteger(Number(msg.seat)) ? Number(msg.seat) : null;
    let seat = null;
    if (requested !== null && requested >= 1 && requested < MAX_PLAYERS && !this.players[requested]) seat = requested;
    if (seat === null) {
      for (let i = 1; i < MAX_PLAYERS; i++) {
        if (!this.players[i]) {
          seat = i;
          break;
        }
      }
    }
    if (seat === null) {
      this.send(ws, { type: "error", message: "Room penuh (4 pemain)." });
      return;
    }
    const name = cleanName(msg.name || meta.name);
    const token = cleanToken(msg.token) || crypto.randomUUID();
    this.players[seat] = { id: meta.id, name, ready: true, token, connected: true, disconnectedAt: null };
    meta.seat = seat;
    meta.role = "guest";
    meta.name = name;
    meta.token = token;
    this.sendJoined(ws, false, token);
    this.broadcastLobby();
    this.maybeAutoStart();
  }

  // Resume an EXISTING seat, identified purely by (seat, token) — this is the
  // only path that is allowed to succeed while `started` is true, which is
  // exactly the situation a real reconnect needs to handle.
  async rejoin(ws, meta, msg) {
    const seat = Number.isInteger(Number(msg.seat)) ? Number(msg.seat) : null;
    const token = cleanToken(msg.token);
    const existing = seat !== null ? this.players[seat] : null;
    const matches = existing && token && existing.token === token;

    if (!matches) {
      // No matching reservation for this (seat, token) pair — most likely a
      // stale/local session for a room that no longer remembers them. If the
      // room hasn't started, fall back to a fresh join instead of a dead end.
      if (this.started) {
        this.send(ws, {
          type: "error",
          message: "Sesi lama tidak ditemukan dan permainan sedang berjalan. Minta host mengundang ulang.",
        });
        return;
      }
      if (seat === this.hostSeat) return this.createRoom(ws, meta, msg);
      return this.joinRoom(ws, meta, msg);
    }

    // Drop any stale connection still registered for this seat (e.g. a socket
    // whose 'close' event hasn't fired yet after a network drop, or a second
    // tab reconnecting with the same saved session).
    for (const [oldWs, oldMeta] of this.connections) {
      if (oldWs !== ws && oldMeta.seat === seat) {
        this.connections.delete(oldWs);
        try {
          oldWs.close();
        } catch {
          /* already gone */
        }
      }
    }

    const name = cleanName(msg.name) || existing.name;
    existing.connected = true;
    existing.disconnectedAt = null;
    existing.name = name;
    existing.id = meta.id; // this connection is now the current owner of the seat
    const role = seat === this.hostSeat ? "host" : "guest";
    meta.seat = seat;
    meta.role = role;
    meta.name = name;
    meta.token = token;

    this.sendJoined(ws, role === "host", token);
    this.broadcastLobby();
    if (this.lastState) this.send(ws, { type: "state", state: this.lastState });
    if (this.started) this.send(ws, { type: "startGame" });
  }

  maybeAutoStart() {
    if (this.started) return false;
    const players = this.players.filter(Boolean);
    if (players.length !== MAX_PLAYERS) return false;
    if (!players.every((p) => p.ready)) return false;
    this.started = true;
    this.broadcast({ type: "startGame" });
    return true;
  }

  sendJoined(ws, host, token) {
    const meta = this.connections.get(ws);
    this.send(ws, { type: "joined", room: this.roomView(), seat: meta ? meta.seat : null, host: !!host, token });
  }

  roomView() {
    return {
      code: this.roomCode,
      started: this.started,
      players: this.players.map((p) =>
        p ? { id: p.id, name: p.name, ready: !!p.ready, connected: p.connected !== false } : null
      ),
    };
  }

  setReady(ws, ready) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat === null) return;
    const p = this.players[meta.seat];
    if (!p) return;
    p.ready = ready;
    this.broadcastLobby();
    this.maybeAutoStart();
  }

  startGame(ws) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat !== this.hostSeat || meta.role !== "host") return;
    const humans = this.players.filter(Boolean);
    if (humans.length < 1) return this.send(ws, { type: "error", message: "Butuh minimal 1 pemain lain untuk mulai." });
    if (!humans.every((p) => p.ready)) return this.send(ws, { type: "error", message: "Semua pemain harus READY." });
    this.started = true;
    this.broadcast({ type: "startGame" });
  }

  // Host-only: end the current match and reopen the SAME room code for
  // another one, with the same seats, without a new invite link.
  rematch(ws) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat !== this.hostSeat || meta.role !== "host") return;
    this.started = false;
    this.lastState = null;
    for (const p of this.players) if (p) p.ready = false;
    this.broadcastLobby();
  }

  forwardState(ws, state) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat !== this.hostSeat || meta.role !== "host") return;
    if (!state || typeof state !== "object") return;
    this.lastState = state;
    this.broadcast({ type: "state", state }, ws);
  }

  forwardAction(ws, action) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat === null) return;
    if (meta.seat === this.hostSeat && meta.role === "host") return; // host applies its own actions locally
    const hostWs = this.findHostSocket();
    if (!hostWs) {
      this.send(ws, { type: "error", message: "Host tidak terhubung." });
      return;
    }
    this.send(hostWs, { type: "playerAction", seat: meta.seat, action });
  }

  broadcastLobby() {
    this.broadcast({ type: "lobby", room: this.roomView() });
  }

  broadcast(msg, except = null) {
    const data = JSON.stringify(msg);
    for (const [ws] of this.connections) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        this.detach(ws, false);
      }
    }
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.detach(ws, false);
    }
  }

  // A closed socket does NOT free the seat immediately — the player stays
  // reserved (marked disconnected) so `rejoin` can restore them later, even
  // mid-match. `explicit` (an actual 'leave' message) frees the seat right away.
  detach(ws, explicit) {
    const meta = this.connections.get(ws);
    if (!meta) return;
    this.connections.delete(ws);
    const seat = meta.seat;
    if (seat !== null && this.players[seat] && this.players[seat].id === meta.id) {
      if (explicit) {
        this.players[seat] = null;
      } else {
        this.players[seat].connected = false;
        this.players[seat].disconnectedAt = Date.now();
        this.scheduleCleanup();
      }
    }
    this.touch();
    this.broadcastLobby();
  }

  scheduleCleanup() {
    if (!this.ctx || !this.ctx.storage || !this.ctx.storage.setAlarm) return;
    this.ctx.storage.setAlarm(Date.now() + SEAT_GRACE_MS).catch(() => {});
  }

  // Frees seats that have been disconnected past their grace period, and
  // fully resets a room that's been completely idle for a long time so the
  // room code can be cleanly reused. This is what finally gives the old
  // "ROOM_TTL_MS" idea a real effect instead of sitting unused.
  async alarm() {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = this.players[i];
      if (p && p.connected === false && p.disconnectedAt && now - p.disconnectedAt > SEAT_GRACE_MS) {
        this.players[i] = null;
        changed = true;
      }
    }
    if (now - this.lastActivity > ROOM_IDLE_TTL_MS) {
      this.players = [null, null, null, null];
      this.started = false;
      this.lastState = null;
      changed = true;
    }
    if (changed) this.broadcastLobby();
    if (this.connections.size > 0) this.scheduleCleanup();
  }
}
