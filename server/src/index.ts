import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { DEFAULT_LOOK } from "../../shared/look.ts";
import { inFront, isWalkable, receptionMap, roomMap, stairsArrival, venueFloors, type SceneMap, type Tile } from "../../shared/maps.ts";
import { isTheme, ROOM_COLORS } from "../../shared/themes.ts";
import type {
  Account,
  ChatMessage,
  ClientToServerEvents,
  Question,
  RtcSignal,
  ServerToClientEvents,
  Stage,
  User,
  Venue,
} from "../../shared/types.ts";
import { AccountError, createAccountStore } from "./accounts.ts";
import { createRoomStore } from "./rooms.ts";
import { createVenues } from "./seed.ts";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_CHAT = 200;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(here, "../data"));
const uploadsDir = path.resolve(here, "../uploads");
const clientDist = path.resolve(here, "../../client/dist");
mkdirSync(uploadsDir, { recursive: true });

const accounts = createAccountStore(dataDir);

// ---------- Salones y salas ----------

interface RoomState {
  stage: Stage;
  chat: ChatMessage[];
  questions: Question[];
  /** Asiento → id de quien lo ocupa. */
  seats: Map<number, string>;
}

interface VenueState {
  venue: Venue;
  whitelist: Set<string> | null;
  /** Un mapa por piso del edificio. */
  floors: SceneMap[];
  rooms: Map<string, RoomState>;
}

const RECEPTION = receptionMap();
// Todas las salas comparten la distribución de asientos; el estilo solo cambia la decoración.
const ROOM_MAP = roomMap("minimal", "#000");
const MAX_ROOMS_PER_ACCOUNT = 10;

const newRoomState = (): RoomState => ({
  stage: { mode: "slides", slidesUrl: null, slidesName: null, slide: 1, streamUrl: null, presenterId: null, live: null },
  chat: [],
  questions: [],
  seats: new Map(),
});

const createdRooms = createRoomStore(dataDir);

const venues = new Map<string, VenueState>(
  createVenues(dataDir).map(({ venue, whitelist }) => {
    // Las salas que crearon los usuarios se suman al final, después de las del programa.
    for (const c of createdRooms.list()) if (c.venueId === venue.id) venue.rooms.push(c.room);
    return [
      venue.id,
      { venue, whitelist, floors: venueFloors(venue.rooms), rooms: new Map(venue.rooms.map((r) => [r.id, newRoomState()])) },
    ];
  }),
);

/**
 * Códigos de expositor por sala. Se pueden fijar con
 * SPEAKER_CODES="101/stellar:ABC123,202/soroban:DEF456"; si no, se generan al arrancar.
 */
const speakerCodes = new Map<string, string>();
for (const pair of (process.env.SPEAKER_CODES ?? "").split(",").filter(Boolean)) {
  const [key, code] = pair.split(":");
  const [venueId, roomId] = (key ?? "").split("/");
  if (venueId && roomId && venues.get(venueId)?.rooms.has(roomId) && code) speakerCodes.set(`${venueId}/${roomId}`, code.trim().toUpperCase());
}
for (const c of createdRooms.list()) speakerCodes.set(`${c.venueId}/${c.room.id}`, c.speakerCode);
for (const { venue } of venues.values()) {
  for (const room of venue.rooms) {
    const key = `${venue.id}/${room.id}`;
    if (!speakerCodes.has(key)) speakerCodes.set(key, randomBytes(3).toString("hex").toUpperCase());
  }
}

const clean = (text: unknown, max: number) =>
  typeof text === "string" ? text.trim().replace(/\s+/g, " ").slice(0, max) : "";

const sortQuestions = (qs: Question[]) =>
  [...qs].sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes.length - a.votes.length || a.ts - b.ts);

/** Acepta solo URLs http(s) para incrustar como stream. */
function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Una baldosa libre cerca de `tile`, para que no aparezcan todos apilados. */
function spawnNear(map: SceneMap, tile: Tile): Tile {
  const options: Tile[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) if (isWalkable(map, tile.x + dx, tile.y + dy)) options.push({ x: tile.x + dx, y: tile.y + dy });
  return options[Math.floor(Math.random() * options.length)] ?? tile;
}

// ---------- HTTP ----------

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { maxHttpBufferSize: 1e5 });

interface Connection {
  user: User;
  account: Account | null;
}
const connections = new Map<string, Connection>();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, users: connections.size });
});

const authRoute = (handler: (body: Record<string, unknown>) => Promise<unknown>) =>
  [
    express.json({ limit: "10kb" }),
    async (req: express.Request, res: express.Response) => {
      try {
        res.json(await handler((req.body ?? {}) as Record<string, unknown>));
      } catch (err) {
        if (err instanceof AccountError) return res.status(400).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: "Algo salió mal. Intenta de nuevo." });
      }
    },
  ] as const;

app.post("/api/register", ...authRoute((body) => accounts.register(body)));
app.post("/api/login", ...authRoute((body) => accounts.login(body)));

app.use("/uploads", express.static(uploadsDir, { maxAge: "1h" }));

app.post(
  "/api/venues/:venueId/rooms/:roomId/slides",
  express.raw({ type: "application/pdf", limit: "50mb" }),
  async (req, res) => {
    const { venueId, roomId } = req.params;
    const state = venues.get(venueId)?.rooms.get(roomId);
    const code = String(req.header("x-speaker-code") ?? "").toUpperCase();
    if (!state) return res.status(404).json({ error: "Sala no encontrada" });
    if (!code || speakerCodes.get(`${venueId}/${roomId}`) !== code) {
      return res.status(403).json({ error: "Código de expositor inválido para esta sala" });
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ error: "El archivo debe ser un PDF" });
    }

    const fileName = `${venueId}-${roomId}-${Date.now()}.pdf`;
    await writeFile(path.join(uploadsDir, fileName), body);
    const previous = state.stage.slidesUrl;
    if (previous) unlink(path.join(uploadsDir, path.basename(previous))).catch(() => {});

    const originalName = clean(decodeURIComponent(String(req.header("x-file-name") ?? "presentacion.pdf")), 120);
    state.stage = { ...state.stage, mode: "slides", slidesUrl: `/uploads/${fileName}`, slidesName: originalName, slide: 1 };
    io.to(roomChannel(venueId, roomId)).emit("stage", state.stage);
    res.json({ ok: true });
  },
);

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/(api|uploads|socket\.io)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// ---------- Tiempo real ----------

// Canales de Socket.IO:
//   reception          quienes están en recepción
//   v:<salón>          todos los que están en un salón (en el pasillo o en sus salas)
//   hall:<salón>:<piso> quienes caminan por ese piso del edificio
//   room:<salón>:<sala> quienes están en una sala
const venueChannel = (venueId: string) => `v:${venueId}`;
const hallChannel = (venueId: string, floor: number) => `hall:${venueId}:${floor}`;
const roomChannel = (venueId: string, roomId: string) => `room:${venueId}:${roomId}`;

const sceneChannel = (u: User) =>
  !u.venueId ? "reception" : u.roomId ? roomChannel(u.venueId, u.roomId) : hallChannel(u.venueId, u.floor);
const presenceChannel = (u: User) => (u.venueId ? venueChannel(u.venueId) : "reception");

const usersIn = (venueId: string | null) =>
  [...connections.values()].map((c) => c.user).filter((u) => u.venueId === venueId);

function sceneMapFor(u: User): SceneMap {
  if (!u.venueId) return RECEPTION;
  if (u.roomId) return ROOM_MAP;
  const floors = venues.get(u.venueId)!.floors;
  return floors[u.floor] ?? floors[0]!;
}

const guestName = () => `Invitado ${Math.floor(1000 + Math.random() * 9000)}`;

io.on("connection", (socket) => {
  let conn: Connection | null = null;
  let lastSaid = 0;

  const currentRoom = () => {
    const u = conn?.user;
    if (!u?.venueId || !u.roomId) return null;
    return venues.get(u.venueId)?.rooms.get(u.roomId) ?? null;
  };

  const presenterRoom = () => {
    const state = currentRoom();
    return state && state.stage.presenterId === socket.id ? state : null;
  };

  const emitStage = (state: RoomState) => {
    const u = conn!.user;
    io.to(roomChannel(u.venueId!, u.roomId!)).emit("stage", state.stage);
  };

  const applyAccount = (account: Account | null) => {
    const u = conn!.user;
    // Al cerrar sesión vuelve a ser invitado con un nombre nuevo.
    u.name = account?.name ?? (u.registered ? guestName() : u.name);
    u.look = account?.look ?? DEFAULT_LOOK;
    u.registered = Boolean(account);
    conn!.account = account;
  };

  socket.on("hello", (req, ack) => {
    const venuesList = [...venues.values()].filter((v) => !v.venue.private).map(({ venue: { id, name, tagline } }) => ({ id, name, tagline }));
    if (conn) return ack({ ok: true, data: { user: conn.user, account: conn.account, users: usersIn(conn.user.venueId), venues: venuesList } });
    const account = accounts.verify(req?.token);
    const spot = spawnNear(RECEPTION, RECEPTION.spawn);
    const user: User = {
      id: socket.id,
      name: account?.name ?? guestName(),
      look: account?.look ?? DEFAULT_LOOK,
      registered: Boolean(account),
      floor: 0,
      venueId: null,
      roomId: null,
      speakerFor: null,
      x: spot.x,
      y: spot.y,
    };
    conn = { user, account };
    connections.set(socket.id, conn);
    socket.join("reception");
    socket.to("reception").emit("userJoined", user);
    ack({ ok: true, data: { user, account, users: usersIn(null), venues: venuesList } });
  });

  socket.on("setAccount", (token, ack) => {
    if (!conn) return ack({ ok: false, error: "Primero entra" });
    if (conn.user.venueId) return ack({ ok: false, error: "Vuelve a recepción para cambiar de cuenta" });
    const account = token ? accounts.verify(token) : null;
    if (token && !account) return ack({ ok: false, error: "Tu sesión expiró. Inicia sesión de nuevo" });
    applyAccount(account);
    io.to("reception").emit("userUpdated", conn.user);
    ack({ ok: true, data: { user: conn.user, account } });
  });

  socket.on("setLook", async (req, ack) => {
    if (!conn?.account) return ack({ ok: false, error: "Crea una cuenta para personalizar tu personaje" });
    try {
      const account = await accounts.update(conn.account.id, { name: req?.name, look: req?.look });
      applyAccount(account);
      io.to(presenceChannel(conn.user)).emit("userUpdated", conn.user);
      ack({ ok: true, data: { user: conn.user, account } });
    } catch (err) {
      ack({ ok: false, error: err instanceof AccountError ? err.message : "No se pudo guardar tu personaje" });
    }
  });

  socket.on("move", (pos) => {
    if (!conn) return;
    const u = conn.user;
    const map = sceneMapFor(u);
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    u.x = Math.max(0, Math.min(map.w - 1, Math.round(x * 100) / 100));
    u.y = Math.max(0, Math.min(map.h - 1, Math.round(y * 100) / 100));
    socket.to(sceneChannel(u)).volatile.emit("moved", { id: u.id, x: u.x, y: u.y });
  });

  socket.on("say", (text) => {
    if (!conn || conn.user.roomId) return;
    const msg = clean(text, 120);
    const now = Date.now();
    if (!msg || now - lastSaid < 600) return;
    lastSaid = now;
    io.to(sceneChannel(conn.user)).emit("bubble", { userId: conn.user.id, text: msg });
  });

  // ----- Recepción → salón -----

  socket.on("requestVenue", (number, ack) => {
    if (!conn) return ack({ ok: false, error: "Primero entra" });
    const u = conn.user;
    if (u.venueId) return ack({ ok: false, error: "Ya estás dentro de un salón" });
    const id = clean(number, 10).replace(/\D/g, "");
    const state = venues.get(id);
    if (!state) return ack({ ok: false, error: `No encuentro la sala ${id || number}. ¿Puedes revisar el número?` });
    if (state.whitelist) {
      if (!conn.account) {
        return ack({ ok: false, error: `La sala ${id} es privada. Inicia sesión con tu cuenta para que revise la lista de invitados.` });
      }
      if (!state.whitelist.has(conn.account.email)) {
        return ack({ ok: false, error: `Lo siento, ${conn.account.email} no está en la lista de invitados de la sala ${id}.` });
      }
    }

    socket.leave("reception");
    socket.to("reception").emit("userLeft", u.id);
    const ground = state.floors[0]!;
    const spot = spawnNear(ground, ground.spawn);
    Object.assign(u, { venueId: id, roomId: null, floor: 0, speakerFor: null, x: spot.x, y: spot.y });
    socket.join([venueChannel(id), hallChannel(id, 0)]);
    socket.to(venueChannel(id)).emit("userJoined", u);
    ack({ ok: true, data: { venue: state.venue, user: u, users: usersIn(id) } });
  });

  const leaveCurrentRoom = () => {
    const u = conn?.user;
    const state = currentRoom();
    if (!u || !state) return;
    for (const [seat, id] of state.seats) if (id === u.id) state.seats.delete(seat);
    if (state.stage.presenterId === u.id) {
      state.stage = { ...state.stage, presenterId: null, live: null, mode: state.stage.mode === "live" ? "slides" : state.stage.mode };
      emitStage(state);
    }
    socket.leave(roomChannel(u.venueId!, u.roomId!));
    u.roomId = null;
  };

  socket.on("leaveVenue", (ack) => {
    if (!conn?.user.venueId) return ack({ ok: false, error: "No estás en un salón" });
    const u = conn.user;
    const venueId = u.venueId!;
    leaveCurrentRoom();
    socket.leave(venueChannel(venueId));
    socket.leave(hallChannel(venueId, u.floor));
    socket.to(venueChannel(venueId)).emit("userLeft", u.id);
    const spot = spawnNear(RECEPTION, RECEPTION.spawn);
    Object.assign(u, { venueId: null, roomId: null, floor: 0, speakerFor: null, x: spot.x, y: spot.y });
    socket.join("reception");
    socket.to("reception").emit("userJoined", u);
    ack({ ok: true, data: { user: u, users: usersIn(null) } });
  });

  // ----- Salas -----

  socket.on("enterRoom", (roomId, ack) => {
    const u = conn?.user;
    if (!u?.venueId) return ack({ ok: false, error: "Primero pide un salón en recepción" });
    const state = venues.get(u.venueId)!.rooms.get(roomId);
    if (!state) return ack({ ok: false, error: "Sala no encontrada" });
    if (u.roomId !== roomId) {
      leaveCurrentRoom();
      socket.leave(hallChannel(u.venueId, u.floor));
      socket.join(roomChannel(u.venueId, roomId));
      u.roomId = roomId;
      u.x = ROOM_MAP.spawn.x;
      u.y = ROOM_MAP.spawn.y;
      if (u.speakerFor === roomId) {
        state.stage = { ...state.stage, presenterId: u.id };
        socket.to(roomChannel(u.venueId, roomId)).emit("stage", state.stage);
      }
      io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    }
    let seat: number | null = null;
    for (const [s, id] of state.seats) if (id === u.id) seat = s;
    if (seat === null && u.speakerFor !== roomId) {
      seat = ROOM_MAP.seats.findIndex((_, i) => !state.seats.has(i));
      if (seat < 0) seat = null;
      else state.seats.set(seat, u.id);
    }
    ack({ ok: true, data: { stage: state.stage, chat: state.chat, questions: sortQuestions(state.questions), seat, user: u } });
  });

  socket.on("leaveRoom", (ack) => {
    const u = conn?.user;
    if (!u?.venueId || !u.roomId) return ack({ ok: false, error: "No estás en una sala" });
    const floors = venues.get(u.venueId)!.floors;
    const floor = Math.max(0, floors.findIndex((m) => m.doors.some((d) => d.id === u.roomId)));
    const door = floors[floor]!.doors.find((d) => d.id === u.roomId);
    leaveCurrentRoom();
    // Aparece justo afuera de la puerta de la sala que dejó, en el piso donde está.
    const spot = door ? inFront(door) : floors[floor]!.spawn;
    Object.assign(u, { floor, x: spot.x, y: spot.y });
    socket.join(hallChannel(u.venueId, floor));
    io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    ack({ ok: true, data: { user: u } });
  });

  socket.on("changeFloor", (floor, ack) => {
    const u = conn?.user;
    if (!u?.venueId || u.roomId) return ack({ ok: false, error: "Solo se cambia de piso desde los pasillos" });
    const floors = venues.get(u.venueId)!.floors;
    const target = Math.floor(Number(floor));
    if (!floors[target] || Math.abs(target - u.floor) !== 1) return ack({ ok: false, error: "Esa escalera no lleva ahí" });
    socket.leave(hallChannel(u.venueId, u.floor));
    const spot = stairsArrival(floors, target, u.floor);
    Object.assign(u, { floor: target, x: spot.x, y: spot.y });
    socket.join(hallChannel(u.venueId, target));
    io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    ack({ ok: true, data: { user: u } });
  });

  socket.on("createRoom", async (req, ack) => {
    const u = conn?.user;
    const account = conn?.account;
    if (!u || !account) return ack({ ok: false, error: "Inicia sesión para crear una sala" });
    const state = u.venueId ? venues.get(u.venueId) : null;
    if (!state) return ack({ ok: false, error: "Entra a un salón para crear una sala en él" });
    const name = clean(req?.name, 40);
    const topic = clean(req?.topic, 80);
    if (!name) return ack({ ok: false, error: "Ponle un nombre a la sala" });
    if (!isTheme(req?.theme)) return ack({ ok: false, error: "Elige un estilo para la sala" });
    if (createdRooms.countByOwner(account.id) >= MAX_ROOMS_PER_ACCOUNT) {
      return ack({ ok: false, error: `Puedes crear hasta ${MAX_ROOMS_PER_ACCOUNT} salas` });
    }
    const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "sala";
    let id = base;
    for (let i = 2; state.rooms.has(id); i++) id = `${base}-${i}`;
    const room = {
      id,
      name,
      topic: topic || "Charla abierta",
      color: ROOM_COLORS.includes(req.color) ? req.color : ROOM_COLORS[0]!,
      theme: req.theme,
      createdBy: account.name,
    };
    const speakerCode = randomBytes(3).toString("hex").toUpperCase();
    await createdRooms.add({ venueId: state.venue.id, room, speakerCode, ownerId: account.id, createdAt: Date.now() });
    state.venue.rooms.push(room);
    state.rooms.set(id, newRoomState());
    state.floors = venueFloors(state.venue.rooms);
    speakerCodes.set(`${state.venue.id}/${id}`, speakerCode);
    io.to(venueChannel(state.venue.id)).emit("venueUpdated", state.venue);
    ack({ ok: true, data: { venue: state.venue, room, speakerCode } });
  });

  socket.on("claimSpeaker", (code, ack) => {
    const u = conn?.user;
    const state = currentRoom();
    if (!u || !state) return ack({ ok: false, error: "Entra a la sala que vas a presentar" });
    if (speakerCodes.get(`${u.venueId}/${u.roomId}`) !== clean(code, 20).toUpperCase()) {
      return ack({ ok: false, error: "El código no corresponde a esta sala" });
    }
    u.speakerFor = u.roomId;
    for (const [seat, id] of state.seats) if (id === u.id) state.seats.delete(seat);
    state.stage = { ...state.stage, presenterId: u.id, live: null, mode: state.stage.mode === "live" ? "slides" : state.stage.mode };
    emitStage(state);
    io.to(venueChannel(u.venueId!)).emit("userUpdated", u);
    ack({ ok: true, data: { user: u } });
  });

  socket.on("chat", (text) => {
    const u = conn?.user;
    const state = currentRoom();
    if (!u || !state) return;
    const msg = clean(text, 500);
    if (!msg) return;
    const entry: ChatMessage = { id: randomUUID(), userId: u.id, name: u.name, text: msg, ts: Date.now() };
    state.chat.push(entry);
    if (state.chat.length > MAX_CHAT) state.chat.splice(0, state.chat.length - MAX_CHAT);
    io.to(sceneChannel(u)).emit("chat", entry);
  });

  socket.on("ask", (text) => {
    const u = conn?.user;
    const state = currentRoom();
    if (!u || !state) return;
    const q = clean(text, 300);
    if (!q) return;
    state.questions.push({ id: randomUUID(), userId: u.id, name: u.name, text: q, votes: [u.id], answered: false, ts: Date.now() });
    io.to(sceneChannel(u)).emit("questions", sortQuestions(state.questions));
  });

  socket.on("vote", (questionId) => {
    const u = conn?.user;
    const state = currentRoom();
    const q = state?.questions.find((x) => x.id === questionId);
    if (!u || !state || !q) return;
    q.votes = q.votes.includes(u.id) ? q.votes.filter((v) => v !== u.id) : [...q.votes, u.id];
    io.to(sceneChannel(u)).emit("questions", sortQuestions(state.questions));
  });

  socket.on("markAnswered", (questionId) => {
    const state = presenterRoom();
    const q = state?.questions.find((x) => x.id === questionId);
    if (!state || !q) return;
    q.answered = !q.answered;
    io.to(sceneChannel(conn!.user)).emit("questions", sortQuestions(state.questions));
  });

  socket.on("setSlide", (slide) => {
    const state = presenterRoom();
    const n = Math.floor(Number(slide));
    if (!state || !Number.isFinite(n) || n < 1 || n > 2000) return;
    state.stage = { ...state.stage, slide: n };
    emitStage(state);
  });

  socket.on("setStream", (url) => {
    const state = presenterRoom();
    if (!state) return;
    const streamUrl = safeUrl(url);
    state.stage = { ...state.stage, streamUrl, mode: streamUrl ? "stream" : state.stage.live?.video ? "live" : "slides" };
    emitStage(state);
  });

  socket.on("setMode", (mode) => {
    const state = presenterRoom();
    if (!state || !["slides", "stream", "live"].includes(mode)) return;
    state.stage = { ...state.stage, mode };
    emitStage(state);
  });

  // ----- Transmisión en vivo (WebRTC) -----

  let liveSession = 0;
  socket.on("setLive", (live) => {
    const state = presenterRoom();
    if (!state) return;
    const video = live?.video === "screen" || live?.video === "camera" ? live.video : null;
    const audio = Boolean(live?.audio);
    if (!video && !audio) {
      state.stage = { ...state.stage, live: null, mode: state.stage.mode === "live" ? "slides" : state.stage.mode };
    } else {
      liveSession = Math.max(liveSession + 1, Date.now());
      const mode = video ? "live" : state.stage.mode === "live" ? "slides" : state.stage.mode;
      state.stage = { ...state.stage, live: { video, audio, session: liveSession }, mode };
    }
    emitStage(state);
  });

  socket.on("rtc", (to, signal: RtcSignal) => {
    const state = currentRoom();
    const target = connections.get(String(to));
    if (!state || !target || !signal || typeof signal !== "object") return;
    const me = conn!.user;
    // Solo se habla con el expositor de la misma sala.
    if (target.user.venueId !== me.venueId || target.user.roomId !== me.roomId) return;
    if (state.stage.presenterId !== me.id && state.stage.presenterId !== target.user.id) return;
    if (!["request", "offer", "answer", "ice"].includes(signal.kind)) return;
    io.to(target.user.id).emit("rtc", me.id, signal);
  });

  socket.on("disconnect", () => {
    if (!conn) return;
    const u = conn.user;
    leaveCurrentRoom();
    connections.delete(socket.id);
    io.to(presenceChannel(u)).emit("userLeft", u.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  MyConferences escuchando en http://localhost:${PORT}\n`);
  for (const { venue, whitelist } of venues.values()) {
    const access = whitelist ? `privada, ${whitelist.size} ${whitelist.size === 1 ? "invitado" : "invitados"}` : "abierta";
    console.log(`  Sala ${venue.id} · ${venue.name} (${access})`);
    for (const room of venue.rooms) {
      console.log(`    ${room.name.padEnd(22)} código de expositor: ${speakerCodes.get(`${venue.id}/${room.id}`)}`);
    }
  }
  console.log();
});
