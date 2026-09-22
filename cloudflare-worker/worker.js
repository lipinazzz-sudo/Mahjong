import { DurableObject } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// Mahjong DJ — room relay (Cloudflare Worker + Durable Object)
//
// One Durable Object instance == one room code. The HOST's browser is the
// only authoritative game engine (it owns the deck, hands, timers, scoring);
// this Worker just relays JSON messages between the host and up to 3 guests,
// plus tracks lobby/ready state.
//
// Key design points:
//   - Every player gets a random token the first time they join a room.
//     The token (not the WebSocket) is that player's identity.
//   - A dropped WebSocket does NOT free the seat immediately.
//     The seat is marked disconnected so the same player can rejoin.
//   - `rejoin` is the only path allowed while the room is already started.
//   - `rematch` is host-only and reopens the same room code.
//   - Durable Object owns the authoritative state revision.
//   - Game state is broadcast immediately; storage persistence is coalesced.
// ---------------------------------------------------------------------------

const MAX_PLAYERS = 4;
const HOST_SEAT = 0;
const MAX_CHAT_TEXT = 240;

const ROOM_IDLE_TTL_MS = 6 * 60 * 60 * 1000;
const SEAT_GRACE_MS = 5 * 60 * 1000;

const STORAGE_KEY = "roomStateV2";

// ---------------------------------------------------------------------------
// BASIC HELPERS
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function cleanName(name) {
  return (
    String(name || "Player")
      .trim()
      .slice(0, 20) || "Player"
  );
}

const AVATAR_IDS = new Set([
  "panda",
  "shiba",
  "kucing",
  "penguin",
  "rubah",
]);

function cleanAvatar(avatar) {
  const a = String(avatar || "")
    .trim()
    .toLowerCase();

  return AVATAR_IDS.has(a)
    ? a
    : "panda";
}

function validCode(code) {
  return /^\d{5}$/.test(
    String(code || "")
  );
}

function cleanToken(token) {
  const t = String(token || "").trim();

  return /^[A-Za-z0-9-]{8,64}$/.test(t)
    ? t
    : "";
}

function cleanChatText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHAT_TEXT);
}

// ---------------------------------------------------------------------------
// WORKER ENTRY
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health endpoint
    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "mahjong-room",
        now: Date.now(),
      });
    }

    // WebSocket endpoint
    if (url.pathname === "/ws") {
      if (
        (request.headers.get("Upgrade") || "")
          .toLowerCase() !== "websocket"
      ) {
        return new Response(
          "Expected WebSocket upgrade",
          { status: 426 }
        );
      }

      const code = (
        url.searchParams.get("room") || ""
      ).trim();

      if (!validCode(code)) {
        return json(
          {
            error:
              "Room code harus 5 digit.",
          },
          400
        );
      }

      const id =
        env.MAHJONG_ROOMS.idFromName(code);

      const stub =
        env.MAHJONG_ROOMS.get(id);

      return stub.fetch(request);
    }

    // Root endpoint
    if (url.pathname === "/") {
      return json({
        ok: true,
        service: "Mahjong DJ room server",
        endpoints: [
          "/health",
          "/ws?room=12345&role=host|guest&name=...",
        ],
      });
    }

    return new Response(
      "Not found",
      { status: 404 }
    );
  },
};

// ---------------------------------------------------------------------------
// DURABLE OBJECT
// ---------------------------------------------------------------------------

export class MahjongRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    this.ctx = ctx;
    this.env = env;

    this.roomCode = null;
    this.hostSeat = HOST_SEAT;

    // players[seat] =
    // {
    //   id,
    //   token,
    //   name,
    //   avatar,
    //   ready,
    //   connected,
    //   disconnectedAt
    // }
    this.players = [
      null,
      null,
      null,
      null,
    ];

    // WebSocket ->
    // {
    //   seat,
    //   id,
    //   role,
    //   name,
    //   avatar,
    //   token
    // }
    this.connections = new Map();

    // Latest authoritative state from host
    this.lastState = null;

    this.started = false;

    this.lastActivity =
      Date.now();

    this.loaded = false;
    this.loading = null;

    // Durable Object server-side state revision.
    // This MUST NOT depend on a browser-generated counter.
    this.stateRevision = 0;

    // Coalesced persistence.
    this.persistTimer = null;
    this.persistPending = false;
  }

  // -------------------------------------------------------------------------
  // LOAD FROM DURABLE STORAGE
  // -------------------------------------------------------------------------

  async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = (async () => {
      try {
        const saved =
          await this.ctx.storage.get(
            STORAGE_KEY
          );

        if (
          saved &&
          typeof saved === "object"
        ) {
          this.roomCode =
            saved.roomCode ||
            this.roomCode;

          this.hostSeat =
            Number.isInteger(
              saved.hostSeat
            )
              ? saved.hostSeat
              : HOST_SEAT;

          this.players =
            Array.isArray(saved.players) &&
            saved.players.length ===
              MAX_PLAYERS
              ? saved.players.map(
                  (p) =>
                    p &&
                    typeof p === "object"
                      ? {
                          id: p.id || "",
                          token:
                            cleanToken(
                              p.token
                            ),
                          name:
                            cleanName(
                              p.name
                            ),
                          avatar:
                            cleanAvatar(
                              p.avatar
                            ),
                          ready:
                            !!p.ready,
                          connected: false,
                          disconnectedAt:
                            Number(
                              p.disconnectedAt
                            ) ||
                            null,
                        }
                      : null
                )
              : [
                  null,
                  null,
                  null,
                  null,
                ];

          this.lastState =
            saved.lastState &&
            typeof saved.lastState ===
              "object"
              ? saved.lastState
              : null;

          this.stateRevision =
            Number(
              saved.stateRevision
            ) ||
            Number(
              this.lastState?._serverSeq
            ) ||
            0;

          this.started =
            !!saved.started;

          this.lastActivity =
            Number(
              saved.lastActivity
            ) ||
            Date.now();
        }
      } catch (err) {
        console.error(
          "Failed to load room state",
          err
        );
      } finally {
        this.loaded = true;
        this.loading = null;
      }
    })();

    return this.loading;
  }

  // -------------------------------------------------------------------------
  // PERSIST
  // -------------------------------------------------------------------------

  async persist() {
    await this.ensureLoaded();

    await this.ctx.storage.put(
      STORAGE_KEY,
      {
        roomCode: this.roomCode,
        hostSeat: this.hostSeat,
        players: this.players,
        lastState: this.lastState,
        stateRevision:
          this.stateRevision,
        started: this.started,
        lastActivity:
          this.lastActivity,
      }
    );
  }

  touch() {
    this.lastActivity =
      Date.now();
  }

  // -------------------------------------------------------------------------
  // WEBSOCKET CONNECTION
  // -------------------------------------------------------------------------

  async fetch(request) {
    await this.ensureLoaded();

    const url =
      new URL(request.url);

    const room = (
      url.searchParams.get("room") ||
      ""
    ).trim();

    const role =
      url.searchParams.get("role") ===
      "host"
        ? "host"
        : "guest";

    const name =
      cleanName(
        url.searchParams.get("name")
      );

    if (!validCode(room)) {
      return new Response(
        "Invalid room code",
        { status: 400 }
      );
    }

    const pair =
      new WebSocketPair();

    const [
      client,
      server,
    ] = [
      pair[0],
      pair[1],
    ];

    server.accept();

    const clientId =
      crypto.randomUUID();

    this.roomCode =
      this.roomCode || room;

    this.touch();

    this.connections.set(
      server,
      {
        seat: null,
        id: clientId,
        role,
        name,
        avatar: "panda",
        token: null,
      }
    );

    server.addEventListener(
      "message",
      (event) => {
        let msg;

        try {
          msg =
            JSON.parse(
              event.data
            );
        } catch {
          this.send(
            server,
            {
              type: "error",
              message:
                "Pesan tidak valid.",
            }
          );

          return;
        }

        Promise.resolve(
          this.handle(
            server,
            msg
          )
        ).catch((err) => {
          this.send(
            server,
            {
              type: "error",
              message:
                err?.message ||
                "Room error.",
            }
          );
        });
      }
    );

    server.addEventListener(
      "close",
      () => {
        Promise.resolve(
          this.detach(
            server,
            false
          )
        ).catch((err) =>
          console.error(err)
        );
      }
    );

    server.addEventListener(
      "error",
      () => {
        Promise.resolve(
          this.detach(
            server,
            false
          )
        ).catch((err) =>
          console.error(err)
        );
      }
    );

    this.send(
      server,
      {
        type: "hello",
        clientId,
        room,
      }
    );

    await this.persist();

    return new Response(
      null,
      {
        status: 101,
        webSocket: client,
      }
    );
  }

  // -------------------------------------------------------------------------
  // MESSAGE ROUTER
  // -------------------------------------------------------------------------

  async handle(ws, msg) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(ws);

    if (
      !meta ||
      !msg ||
      typeof msg.type !==
        "string"
    ) {
      return;
    }

    this.touch();

    switch (msg.type) {
      case "createRoom":
        return this.createRoom(
          ws,
          meta,
          msg
        );

      case "joinRoom":
        return this.joinRoom(
          ws,
          meta,
          msg
        );

      case "rejoin":
        return this.rejoin(
          ws,
          meta,
          msg
        );

      case "ready":
        return this.setReady(
          ws,
          !!msg.ready
        );

      case "start":
        return this.startGame(
          ws
        );

      case "rematch":
        return this.rematch(
          ws
        );

      case "state":
        return this.forwardState(
          ws,
          msg.state
        );

      case "action":
        return this.forwardAction(
          ws,
          msg.action || {}
        );

      case "chat":
        return this.broadcastChat(
          ws,
          meta,
          msg.text
        );

      case "leave":
        return this.detach(
          ws,
          true
        );

      case "ping":
        return this.send(
          ws,
          {
            type: "pong",
            now: Date.now(),
          }
        );

      default:
        return this.send(
          ws,
          {
            type: "error",
            message:
              `Perintah '${msg.type}' tidak dikenali.`,
          }
        );
    }
  }

  // -------------------------------------------------------------------------
  // FIND HOST
  // -------------------------------------------------------------------------

  findHostSocket() {
    for (
      const [
        ws,
        meta,
      ] of this.connections
    ) {
      if (
        meta.seat ===
          this.hostSeat &&
        meta.role ===
          "host"
      ) {
        return ws;
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // CREATE ROOM
  // -------------------------------------------------------------------------

  async createRoom(
    ws,
    meta,
    msg
  ) {
    await this.ensureLoaded();

    const existingHost =
      this.players[
        this.hostSeat
      ];

    if (
      existingHost &&
      existingHost.connected
    ) {
      const liveSocket =
        this.findHostSocket();

      if (
        liveSocket &&
        liveSocket !== ws
      ) {
        this.send(
          ws,
          {
            type: "error",
            message:
              "Room ini sudah memiliki host yang aktif.",
          }
        );

        return;
      }
    }

    const name =
      cleanName(
        msg.name ||
          meta.name
      );

    const avatar =
      cleanAvatar(
        msg.avatar ||
          meta.avatar
      );

    const token =
      cleanToken(msg.token) ||
      crypto.randomUUID();

    if (
      meta.seat !== null &&
      meta.seat !==
        this.hostSeat
    ) {
      this.players[
        meta.seat
      ] = null;
    }

    this.players[
      this.hostSeat
    ] = {
      id: meta.id,
      name,
      avatar,
      ready: true,
      token,
      connected: true,
      disconnectedAt:
        null,
    };

    meta.seat =
      this.hostSeat;

    meta.role =
      "host";

    meta.name =
      name;

    meta.avatar =
      avatar;

    meta.token =
      token;

    this.started =
      false;

    this.lastState =
      null;

    this.stateRevision =
      0;

    this.touch();

    await this.persist();

    this.sendJoined(
      ws,
      true,
      token
    );

    this.broadcastLobby();
  }

  // -------------------------------------------------------------------------
  // JOIN ROOM
  // -------------------------------------------------------------------------

  async joinRoom(
    ws,
    meta,
    msg
  ) {
    await this.ensureLoaded();

    if (this.started) {
      this.send(
        ws,
        {
          type: "error",
          message:
            "Game sudah dimulai. Minta host menekan 'Main Lagi' agar room bisa dimasuki lagi.",
        }
      );

      return;
    }

    const requested =
      Number.isInteger(
        Number(msg.seat)
      )
        ? Number(msg.seat)
        : null;

    let seat = null;

    if (
      requested !== null &&
      requested >= 1 &&
      requested <
        MAX_PLAYERS &&
      !this.players[
        requested
      ]
    ) {
      seat = requested;
    }

    if (seat === null) {
      for (
        let i = 1;
        i < MAX_PLAYERS;
        i++
      ) {
        if (
          !this.players[i]
        ) {
          seat = i;
          break;
        }
      }
    }

    if (seat === null) {
      this.send(
        ws,
        {
          type: "error",
          message:
            "Room penuh (4 pemain).",
        }
      );

      return;
    }

    const name =
      cleanName(
        msg.name ||
          meta.name
      );

    const avatar =
      cleanAvatar(
        msg.avatar ||
          meta.avatar
      );

    const token =
      cleanToken(msg.token) ||
      crypto.randomUUID();

    this.players[seat] =
      {
        id: meta.id,
        name,
        avatar,
        ready: true,
        token,
        connected: true,
        disconnectedAt:
          null,
      };

    meta.seat = seat;
    meta.role = "guest";
    meta.name = name;
    meta.avatar = avatar;
    meta.token = token;

    this.touch();

    await this.persist();

    this.sendJoined(
      ws,
      false,
      token
    );

    this.broadcastLobby();

    this.maybeAutoStart();
  }

  // -------------------------------------------------------------------------
  // REJOIN EXISTING SEAT
  // -------------------------------------------------------------------------

  async rejoin(
    ws,
    meta,
    msg
  ) {
    await this.ensureLoaded();

    const seat =
      Number.isInteger(
        Number(msg.seat)
      )
        ? Number(msg.seat)
        : null;

    const token =
      cleanToken(
        msg.token
      );

    const existing =
      seat !== null
        ? this.players[seat]
        : null;

    const matches =
      existing &&
      token &&
      existing.token ===
        token;

    // No matching reservation
    if (!matches) {
      if (this.started) {
        this.send(
          ws,
          {
            type: "error",
            code: "REJOIN_SESSION_NOT_FOUND",
            message:
              "Sesi lama tidak ditemukan dan permainan sedang berjalan. Minta host mengundang ulang.",
          }
        );

        return;
      }

      if (
        seat ===
        this.hostSeat
      ) {
        return this.createRoom(
          ws,
          meta,
          msg
        );
      }

      return this.joinRoom(
        ws,
        meta,
        msg
      );
    }

    // Close stale connection for same seat
    for (
      const [
        oldWs,
        oldMeta,
      ] of this.connections
    ) {
      if (
        oldWs !== ws &&
        oldMeta.seat ===
          seat
      ) {
        this.connections.delete(
          oldWs
        );

        try {
          oldWs.close();
        } catch {
          // Already closed
        }
      }
    }

    const name =
      cleanName(
        msg.name
      ) ||
      existing.name;

    const avatar =
      cleanAvatar(
        msg.avatar ||
          existing.avatar
      );

    existing.connected =
      true;

    existing.disconnectedAt =
      null;

    existing.name =
      name;

    existing.avatar =
      avatar;

    existing.id =
      meta.id;

    const role =
      seat ===
      this.hostSeat
        ? "host"
        : "guest";

    meta.seat =
      seat;

    meta.role =
      role;

    meta.name =
      name;

    meta.avatar =
      avatar;

    meta.token =
      token;

    this.touch();

    await this.persist();

    this.sendJoined(
      ws,
      role === "host",
      token
    );

    this.broadcastLobby();

    // Immediately restore latest state.
    if (this.lastState) {
      this.send(
        ws,
        {
          type: "state",
          state: this.lastState,
        }
      );
    }

    // Tell reconnecting client the room is active.
    if (this.started) {
      this.send(
        ws,
        {
          type: "startGame",
        }
      );
    }
  }

  // -------------------------------------------------------------------------
  // AUTO START
  // -------------------------------------------------------------------------

  async maybeAutoStart() {
    await this.ensureLoaded();

    if (this.started) {
      return false;
    }

    const players =
      this.players.filter(
        Boolean
      );

    if (
      players.length !==
      MAX_PLAYERS
    ) {
      return false;
    }

    if (
      !players.every(
        (p) => p.ready
      )
    ) {
      return false;
    }

    this.started =
      true;

    this.touch();

    await this.persist();

    this.broadcast({
      type: "startGame",
    });

    return true;
  }

  // -------------------------------------------------------------------------
  // JOINED RESPONSE
  // -------------------------------------------------------------------------

  sendJoined(
    ws,
    host,
    token
  ) {
    const meta =
      this.connections.get(
        ws
      );

    this.send(
      ws,
      {
        type: "joined",
        room: this.roomView(),
        seat: meta
          ? meta.seat
          : null,
        host: !!host,
        token,
      }
    );
  }

  // -------------------------------------------------------------------------
  // ROOM VIEW
  // -------------------------------------------------------------------------

  roomView() {
    return {
      code:
        this.roomCode,

      started:
        this.started,

      players:
        this.players.map(
          (p) =>
            p
              ? {
                  id:
                    p.id,
                  name:
                    p.name,
                  avatar:
                    cleanAvatar(
                      p.avatar
                    ),
                  ready:
                    !!p.ready,
                  connected:
                    p.connected !==
                    false,
                }
              : null
        ),
    };
  }

  // -------------------------------------------------------------------------
  // READY
  // -------------------------------------------------------------------------

  async setReady(
    ws,
    ready
  ) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (
      !meta ||
      meta.seat === null
    ) {
      return;
    }

    const p =
      this.players[
        meta.seat
      ];

    if (!p) {
      return;
    }

    p.ready =
      ready;

    this.touch();

    await this.persist();

    this.broadcastLobby();

    await this.maybeAutoStart();
  }

  // -------------------------------------------------------------------------
  // START GAME
  // -------------------------------------------------------------------------

  async startGame(ws) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (
      !meta ||
      meta.seat !==
        this.hostSeat ||
      meta.role !==
        "host"
    ) {
      return;
    }

    const humans =
      this.players.filter(
        Boolean
      );

    if (
      humans.length < 1
    ) {
      return this.send(
        ws,
        {
          type: "error",
          message:
            "Butuh minimal 1 pemain lain untuk mulai.",
        }
      );
    }

    if (
      !humans.every(
        (p) => p.ready
      )
    ) {
      return this.send(
        ws,
        {
          type: "error",
          message:
            "Semua pemain harus READY.",
        }
      );
    }

    this.started =
      true;

    this.touch();

    await this.persist();

    this.broadcast({
      type: "startGame",
    });
  }

  // -------------------------------------------------------------------------
  // REMATCH
  // -------------------------------------------------------------------------

  async rematch(ws) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (
      !meta ||
      meta.seat !==
        this.hostSeat ||
      meta.role !==
        "host"
    ) {
      return;
    }

    this.started =
      false;

    this.lastState =
      null;

    this.stateRevision =
      0;

    for (
      const p of this.players
    ) {
      if (p) {
        p.ready =
          false;
      }
    }

    this.touch();

    await this.persist();

    this.broadcastLobby();
  }

  // -------------------------------------------------------------------------
  // HOST -> GUEST STATE
  // -------------------------------------------------------------------------

  async forwardState(
    ws,
    state
  ) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (
      !meta ||
      meta.seat !==
        this.hostSeat ||
      meta.role !==
        "host"
    ) {
      return;
    }

    if (
      !state ||
      typeof state !==
        "object"
    ) {
      return;
    }

    // The Durable Object, not the browser,
    // owns the authoritative state sequence.
    this.stateRevision += 1;

    const publishedState =
      {
        ...state,

        _serverSeq:
          this.stateRevision,
      };

    this.lastState =
      publishedState;

    this.touch();

    // IMPORTANT:
    // Broadcast immediately.
    // Do not wait for storage.
    this.broadcast(
      {
        type: "state",
        state:
          publishedState,
      },
      ws
    );

    // Persist separately.
    this.queueStatePersist();
  }

  // -------------------------------------------------------------------------
  // COALESCED STATE PERSISTENCE
  // -------------------------------------------------------------------------

  queueStatePersist() {
    if (this.persistPending) {
      return;
    }

    this.persistPending =
      true;

    clearTimeout(
      this.persistTimer
    );

    this.persistTimer =
      setTimeout(() => {
        this.persistPending =
          false;

        this.persistTimer =
          null;

        this.persist()
          .catch((err) =>
            console.error(
              "State persist failed",
              err
            )
          );
      }, 1000);
  }

  // -------------------------------------------------------------------------
  // GUEST -> HOST ACTION
  // -------------------------------------------------------------------------

  async forwardAction(
    ws,
    action
  ) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (
      !meta ||
      meta.seat === null
    ) {
      return;
    }

    // Host processes its own actions locally.
    if (
      meta.seat ===
        this.hostSeat &&
      meta.role ===
        "host"
    ) {
      return;
    }

    const hostWs =
      this.findHostSocket();

    if (!hostWs) {
      this.send(
        ws,
        {
          type: "error",
          message:
            "Host tidak terhubung.",
        }
      );

      return;
    }

    const delivered =
      this.send(
        hostWs,
        {
          type:
            "playerAction",

          seat:
            meta.seat,

          action,
        }
      );

    if (delivered) {
      const actionId =
        String(action.actionId || "").trim();

      if (actionId) {
        this.send(
          ws,
          {
            type: "actionAck",
            actionId,
          }
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // CHAT
  // -------------------------------------------------------------------------

  broadcastChat(ws, meta, text) {
    if (!meta || meta.seat === null) {
      return;
    }

    const player = this.players[meta.seat];

    if (
      !player ||
      player.id !== meta.id
    ) {
      return;
    }

    const cleanText = cleanChatText(text);

    if (!cleanText) {
      return;
    }

    this.broadcast({
      type: "chat",
      id: crypto.randomUUID(),
      from: meta.seat,
      name: cleanName(meta.name),
      text: cleanText,
      ts: Date.now(),
    });
  }

  // -------------------------------------------------------------------------
  // LOBBY
  // -------------------------------------------------------------------------

  broadcastLobby() {
    this.broadcast({
      type: "lobby",
      room:
        this.roomView(),
    });
  }

  // -------------------------------------------------------------------------
  // BROADCAST
  // -------------------------------------------------------------------------

  broadcast(
    msg,
    except = null
  ) {
    let data;

    try {
      data =
        JSON.stringify(msg);
    } catch (err) {
      console.error(
        "Broadcast JSON error:",
        err
      );

      return;
    }

    for (
      const [
        ws,
      ] of this.connections
    ) {
      if (
        ws === except
      ) {
        continue;
      }

      try {
        ws.send(data);
      } catch {
        Promise.resolve(
          this.detach(
            ws,
            false
          )
        ).catch((err) =>
          console.error(err)
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // SAFE SEND
  // -------------------------------------------------------------------------

  send(ws, msg) {
    try {
      ws.send(
        JSON.stringify(msg)
      );
      return true;
    } catch {
      Promise.resolve(
        this.detach(
          ws,
          false
        )
      ).catch((err) =>
        console.error(err)
      );
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // DISCONNECT / LEAVE
  // -------------------------------------------------------------------------

  async detach(
    ws,
    explicit
  ) {
    await this.ensureLoaded();

    const meta =
      this.connections.get(
        ws
      );

    if (!meta) {
      return;
    }

    this.connections.delete(
      ws
    );

    const seat =
      meta.seat;

    if (
      seat !== null &&
      this.players[seat] &&
      this.players[seat].id ===
        meta.id
    ) {
      if (explicit) {
        // Explicit leave:
        // immediately free the seat.
        this.players[seat] =
          null;
      } else {
        // Network disconnect:
        // reserve the seat.
        this.players[
          seat
        ].connected =
          false;

        this.players[
          seat
        ].disconnectedAt =
          Date.now();

        await this.scheduleCleanup();
      }
    }

    this.touch();

    await this.persist();

    this.broadcastLobby();
  }

  // -------------------------------------------------------------------------
  // CLEANUP ALARM
  // -------------------------------------------------------------------------

  async scheduleCleanup() {
    try {
      await this.ctx.storage.setAlarm(
        Date.now() +
          SEAT_GRACE_MS
      );
    } catch (err) {
      console.error(
        "Unable to schedule room alarm",
        err
      );
    }
  }

  // -------------------------------------------------------------------------
  // ALARM
  // -------------------------------------------------------------------------

  async alarm() {
    await this.ensureLoaded();

    const now =
      Date.now();

    let changed =
      false;

    // Free expired disconnected seats.
    for (
      let i = 0;
      i < MAX_PLAYERS;
      i++
    ) {
      const p =
        this.players[i];

      if (
        p &&
        p.connected ===
          false &&
        p.disconnectedAt &&
        now -
            p.disconnectedAt >
          SEAT_GRACE_MS
      ) {
        this.players[i] =
          null;

        changed =
          true;
      }
    }

    // Fully reset a stale room.
    if (
      now -
        this.lastActivity >
      ROOM_IDLE_TTL_MS
    ) {
      this.players = [
        null,
        null,
        null,
        null,
      ];

      this.started =
        false;

      this.lastState =
        null;

      this.stateRevision =
        0;

      changed =
        true;
    }

    if (changed) {
      this.touch();

      await this.persist();

      if (
        this.connections.size >
        0
      ) {
        this.broadcastLobby();
      }
    }

    // Keep the cleanup alarm alive.
    await this.scheduleCleanup();
  }
}
