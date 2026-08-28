import { DurableObject } from "cloudflare:workers";

const MAX_PLAYERS = 4;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function cleanName(name) {
  return String(name || "Player").trim().slice(0, 20) || "Player";
}

function validCode(code) {
  return /^\d{5}$/.test(String(code || ""));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "mahjong-room", now: Date.now() });

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket required", { status: 426 });
      }
      const code = (url.searchParams.get("room") || "").trim();
      if (!validCode(code)) return json({ error: "Room code harus 5 digit." }, 400);
      const id = env.MAHJONG_ROOMS.idFromName(code);
      return env.MAHJONG_ROOMS.get(id).fetch(request);
    }

    if (url.pathname === "/") {
      return json({ ok: true, service: "Mahjong Soul Room Server", endpoints: ["/health", "/ws?room=12345"] });
    }

    return new Response("Not found", { status: 404 });
  }
};

export class MahjongRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.roomCode = null;
    this.players = [null, null, null, null];
    this.connections = new Map(); // ws -> { seat, id, role }
    this.lastState = null;
    this.started = false;
    this.lastActivity = Date.now();
    this.hostSeat = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const room = (url.searchParams.get("room") || "").trim();
    const role = url.searchParams.get("role") === "host" ? "host" : "guest";
    const name = cleanName(url.searchParams.get("name"));
    const resumeSeat = Number(url.searchParams.get("seat"));
    if (!validCode(room)) return new Response("Invalid room", { status: 400 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const clientId = crypto.randomUUID();
    this.roomCode = room;
    this.lastActivity = Date.now();
    this.connections.set(server, { seat: null, id: clientId, role, name });

    server.addEventListener("message", event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return this.send(server, { type: "error", message: "Pesan tidak valid." }); }
      this.handle(server, msg).catch(err => {
        console.error(err);
        this.send(server, { type: "error", message: err?.message || "Room error." });
      });
    });

    server.addEventListener("close", () => this.detach(server));
    server.addEventListener("error", () => this.detach(server));

    this.send(server, { type: "hello", clientId, room });
    return new Response(null, { status: 101, webSocket: client });
  }

  async handle(ws, msg) {
    const meta = this.connections.get(ws);
    if (!meta) return;
    this.lastActivity = Date.now();

    switch (msg.type) {
      case "createRoom":
        return this.createRoom(ws, meta, msg);
      case "joinRoom":
        return this.joinRoom(ws, meta, msg);
      case "ready":
        return this.setReady(ws, !!msg.ready);
      case "start":
        return this.startGame(ws);
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
    for (const [ws, meta] of this.connections) if (meta.seat === this.hostSeat && meta.role === "host") return ws;
    return null;
  }

  async createRoom(ws, meta, msg) {
    if (this.players.some(Boolean)) {
      const existingHost = this.findHostSocket();
      if (existingHost && existingHost !== ws) {
        this.send(ws, { type: "error", message: "Room sudah memiliki host." });
        return;
      }
    }
    const name = cleanName(msg.name || meta.name);
    if (meta.seat !== null && meta.seat !== this.hostSeat) this.players[meta.seat] = null;
    this.players[this.hostSeat] = { id: meta.id, name, ready: true };
    meta.seat = this.hostSeat; meta.role = "host"; meta.name = name;
    this.started = false;
    this.broadcastLobby();
    this.sendJoined(ws, true);
  }

  async joinRoom(ws, meta, msg) {
    if (this.started) {
      this.send(ws, { type: "error", message: "Game sudah dimulai. Tunggu ronde berikutnya." });
      return;
    }
    const requested = Number.isInteger(Number(msg.seat)) ? Number(msg.seat) : null;
    let seat = null;
    if (requested !== null && requested >= 1 && requested < MAX_PLAYERS && !this.players[requested]) seat = requested;
    if (seat === null) {
      for (let i = 1; i < MAX_PLAYERS; i++) if (!this.players[i]) { seat = i; break; }
    }
    if (seat === null) {
      this.send(ws, { type: "error", message: "Room penuh (4 pemain)." });
      return;
    }
    const name = cleanName(msg.name || meta.name);
    this.players[seat] = { id: meta.id, name, ready: true };
    meta.seat = seat; meta.role = "guest"; meta.name = name;
    this.sendJoined(ws, false);
    this.broadcastLobby();
    if (this.lastState) this.send(ws, { type: "state", state: this.lastState });
    if (this.started) this.send(ws, { type: "startGame" });
  }

  sendJoined(ws, host) {
    const meta = this.connections.get(ws);
    this.send(ws, { type: "joined", room: this.roomView(), seat: meta?.seat, host: !!host });
  }

  roomView() {
    return { code: this.roomCode, players: this.players.map(p => p ? { id: p.id, name: p.name, ready: !!p.ready } : null), started: this.started };
  }

  setReady(ws, ready) {
    const meta = this.connections.get(ws); if (!meta || meta.seat === null) return;
    const p = this.players[meta.seat]; if (!p) return;
    p.ready = ready;
    this.broadcastLobby();
  }

  startGame(ws) {
    const meta = this.connections.get(ws); if (!meta || meta.seat !== this.hostSeat || meta.role !== "host") return;
    const humans = this.players.filter(Boolean);
    if (humans.length < 2) return this.send(ws, { type: "error", message: "Minimal 2 pemain diperlukan." });
    if (!humans.every(p => p.ready)) return this.send(ws, { type: "error", message: "Semua pemain harus READY." });
    this.started = true;
    this.broadcast({ type: "startGame" });
    if (this.lastState) this.broadcast({ type: "state", state: this.lastState });
  }

  forwardState(ws, state) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat !== this.hostSeat) return;
    if (!state || typeof state !== "object") return;
    this.lastState = state;
    this.broadcast({ type: "state", state }, ws);
  }

  forwardAction(ws, action) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat === null) return;
    const host = this.findHostSocket();
    if (!host) return this.send(ws, { type: "error", message: "Host tidak terhubung." });
    if (meta.seat === this.hostSeat && meta.role === "host") return;
    this.send(host, { type: "playerAction", seat: meta.seat, action });
  }

  broadcastLobby() { this.broadcast({ type: "lobby", room: this.roomView() }); }

  broadcast(msg, except = null) {
    const data = JSON.stringify(msg);
    for (const [ws] of this.connections) {
      if (ws === except) continue;
      try { ws.send(data); } catch { this.detach(ws); }
    }
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { this.detach(ws); } }

  detach(ws, explicit = false) {
    const meta = this.connections.get(ws); if (!meta) return;
    this.connections.delete(ws);
    if (meta.seat !== null && this.players[meta.seat]?.id === meta.id) this.players[meta.seat] = null;
    if (explicit) { try { ws.close(); } catch {} }
    this.lastActivity = Date.now();
    this.broadcastLobby();
  }
}
