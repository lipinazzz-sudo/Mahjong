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

  async loadPersisted(){
    if(this._loaded)return;
    this._loaded=true;
    const saved=await this.ctx.storage.get("roomSnapshot");
    if(saved){
      this.roomCode=saved.roomCode??null;
      this.players=Array.isArray(saved.players)?saved.players:[null,null,null,null];
      this.lastState=saved.lastState??null;
      this.started=!!saved.started;
      this.lastActivity=Number(saved.lastActivity||Date.now());
    }
    await this.scheduleRoomAlarm();
  }
  async persist(){
    await this.ctx.storage.put("roomSnapshot",{roomCode:this.roomCode,players:this.players,lastState:this.lastState,started:this.started,lastActivity:this.lastActivity});
    await this.scheduleRoomAlarm();
  }
  async scheduleRoomAlarm(){
    try{await this.ctx.storage.setAlarm(this.lastActivity+ROOM_TTL_MS)}catch{}
  }
  async alarm(){
    const saved=await this.ctx.storage.get("roomSnapshot");
    const last=Number(saved?.lastActivity||this.lastActivity||0);
    if(!last||Date.now()-last>=ROOM_TTL_MS){
      this.players=[null,null,null,null];this.lastState=null;this.started=false;this.roomCode=null;this.connections.clear();
      await this.ctx.storage.delete("roomSnapshot");return;
    }
    await this.scheduleRoomAlarm();
  }
  async fetch(request) {
    await this.loadPersisted();
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
      case "resumeRoom":
        return this.resumeRoom(ws, meta, msg);
      case "ready":
        return this.setReady(ws, !!msg.ready);
      case "rematch":
        return this.rematch(ws);
      case "start":
        return this.startGame(ws);
      case "state":
        return this.forwardState(ws, msg.state);
      case "action":
        return this.forwardAction(ws, msg.action || {});
      case "leave":
        return this.detach(ws, true);
      case "ping":
        this.lastActivity=Date.now();await this.persist();return this.send(ws, { type: "pong", now: Date.now() });
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
    this.players[this.hostSeat] = { id: meta.id, name, ready: true, connected: true };
    meta.seat = this.hostSeat; meta.role = "host"; meta.name = name;
    this.started = false;
    this.lastActivity=Date.now();await this.persist();
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
    this.players[seat] = { id: meta.id, name, ready: true, connected: true };
    meta.seat = seat; meta.role = "guest"; meta.name = name;
    this.lastActivity=Date.now();await this.persist();
    this.sendJoined(ws, false);
    this.broadcastLobby();
    if (this.lastState) this.send(ws, { type: "state", state: this.lastState });
    if (this.started) this.send(ws, { type: "startGame" });
  }

  async resumeRoom(ws,meta,msg){
    const requested=Number.isInteger(Number(msg.seat))?Number(msg.seat):null;
    if(requested===null||requested<0||requested>=MAX_PLAYERS)return this.send(ws,{type:"error",message:"Kursi reconnect tidak valid."});
    const player=this.players[requested];
    if(!player)return this.send(ws,{type:"error",message:"Sesi pemain sudah tidak tersedia."});
    if(this.connectionsHasSeat(requested))return this.send(ws,{type:"error",message:"Kursi masih terhubung."});
    const name=cleanName(msg.name||player.name);
    this.players[requested]={...player,id:meta.id,name,connected:true};
    meta.seat=requested;meta.role=requested===this.hostSeat?"host":"guest";meta.name=name;
    this.lastActivity=Date.now();await this.persist();
    this.sendJoined(ws,requested===this.hostSeat);
    if(this.lastState)this.send(ws,{type:"state",state:this.lastState});
    if(this.started)this.send(ws,{type:"startGame"});
    this.broadcastLobby();
    if(requested===this.hostSeat&&this.started)this.broadcast({type:"state",state:this.lastState},ws);
  }
  connectionsHasSeat(seat){
    for(const [,meta] of this.connections)if(meta.seat===seat)return true;
    return false;
  }

  sendJoined(ws, host) {
    const meta = this.connections.get(ws);
    this.send(ws, { type: "joined", room: this.roomView(), seat: meta?.seat, host: !!host });
  }

  roomView() {
    return { code: this.roomCode, players: this.players.map(p => p ? { id: p.id, name: p.name, ready: !!p.ready, connected: p.connected !== false } : null), started: this.started };
  }

  async setReady(ws, ready) {
    const meta = this.connections.get(ws); if (!meta || meta.seat === null) return;
    const p = this.players[meta.seat]; if (!p) return;
    p.ready = ready;
    p.connected=true;
    this.lastActivity=Date.now();
    await this.persist();
    this.broadcastLobby();
  }

  startGame(ws) {
    const meta = this.connections.get(ws); if (!meta || meta.seat !== this.hostSeat || meta.role !== "host") return;
    const humans = this.players.filter(Boolean);
    if (humans.length < 2) return this.send(ws, { type: "error", message: "Minimal 2 pemain diperlukan." });
    if (!humans.every(p => p.ready)) return this.send(ws, { type: "error", message: "Semua pemain harus READY." });
    this.started = true;
    this.lastActivity=Date.now();
    await this.persist();
    this.broadcast({ type: "startGame" });
    if (this.lastState) this.broadcast({ type: "state", state: this.lastState });
  }

  async rematch(ws){
    const meta=this.connections.get(ws);
    if(!meta||meta.seat!==this.hostSeat||meta.role!=="host")return;
    for(let i=0;i<this.players.length;i++)if(this.players[i])this.players[i].ready=i===this.hostSeat;
    this.started=false;this.lastState=null;this.lastActivity=Date.now();
    await this.persist();
    this.broadcastLobby();
    this.broadcast({type:"matchReset"});
  }

  async forwardState(ws, state) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat !== this.hostSeat) return;
    if (!state || typeof state !== "object") return;
    this.lastState = state;
    this.lastActivity=Date.now();
    await this.persist();
    this.broadcast({ type: "state", state }, ws);
  }

  async forwardAction(ws, action) {
    const meta = this.connections.get(ws);
    if (!meta || meta.seat === null) return;
    const host = this.findHostSocket();
    if (!host) return this.send(ws, { type: "error", message: "Host tidak terhubung." });
    if (meta.seat === this.hostSeat && meta.role === "host") return;
    this.lastActivity=Date.now();await this.persist();this.send(host, { type: "playerAction", seat: meta.seat, action });
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

  async detach(ws, explicit = false) {
    const meta=this.connections.get(ws);if(!meta)return;
    this.connections.delete(ws);
    if(meta.seat!==null&&this.players[meta.seat]?.id===meta.id){
      this.players[meta.seat]={...this.players[meta.seat],connected:false};
    }
    if(explicit){try{ws.close()}catch{}}
    this.lastActivity=Date.now();
    await this.persist();
    this.broadcastLobby();
  }
}
