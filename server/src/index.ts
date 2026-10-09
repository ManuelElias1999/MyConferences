import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { DEFAULT_LOOK } from "../../shared/look.ts";
import {
  floorOfRoom,
  inFront,
  maxRoomsFor,
  offLimits,
  standList,
  inZone,
  interiorFor,
  isWalkable,
  MAX_ROOMS,
  MIN_ROOMS,
  receptionMap,
  stairsArrival,
  venueFloors,
  type SceneMap,
  type Tile,
} from "../../shared/maps.ts";
import { EMOTES, isTheme, ROOM_COLORS } from "../../shared/themes.ts";
import type {
  CallInfo,
  CallMedia,
  Account,
  ChatMessage,
  ClientToServerEvents,
  CompanyEvent,
  Question,
  Room,
  Talk,
  RtcSignal,
  ServerToClientEvents,
  Stage,
  User,
  Venue,
} from "../../shared/types.ts";
import { HACKATHON_CAPACITIES } from "../../shared/types.ts";
import { AccountError, createAccountStore } from "./accounts.ts";
import { createEventStore, type StoredEvent } from "./events.ts";
import { createVenues } from "./seed.ts";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_CHAT = 200;
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(here, "../data"));
const uploadsDir = path.resolve(here, "../uploads");
const logosDir = path.join(uploadsDir, "logos");
const assetsDir = path.resolve(here, "../assets");
const clientDist = path.resolve(here, "../../client/dist");
mkdirSync(logosDir, { recursive: true });

const accounts = createAccountStore(dataDir);
const companyEvents = createEventStore(dataDir);

// ---------- Eventos y salas ----------

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
  /** Mapa del recinto del evento. */
  /** Un mapa por piso del recinto. */
  floors: SceneMap[];
  rooms: Map<string, RoomState>;
  /** Cuenta de la empresa dueña del evento (null en los de ejemplo). */
  ownerId: string | null;
}

const RECEPTION = receptionMap();
/** Mapa interior de una sala: define sus asientos y por dónde se entra. */
const interiorOf = (venue: Venue, roomId: string) => interiorFor(venue.theme, venue.rooms, roomId);

const newRoomState = (): RoomState => ({
  stage: { mode: "slides", slidesUrl: null, slidesName: null, slide: 1, streamUrl: null, presenterId: null, live: null },
  chat: [],
  questions: [],
  seats: new Map(),
});

const venues = new Map<string, VenueState>();
const speakerCodes = new Map<string, string>();

/** Registra (o actualiza) un evento en memoria, conservando el estado de las salas que siguen. */
/** Papel de cada correo en cada evento: organizador o mentor. */
type Role = { role: "staff" | "mentor" | "sponsor"; sponsor: number | null };
const venueRoles = new Map<string, Map<string, Role>>();
function setRoles(venueId: string, staff: string[] = [], mentors: string[] = []) {
  const roles = new Map<string, Role>();
  for (const e of mentors) roles.set(e, { role: "mentor", sponsor: null });
  for (const e of staff) roles.set(e, { role: "staff", sponsor: null });
  venueRoles.set(venueId, roles);
}

/** Papel de alguien en un evento: organizador (dueño o por correo), mentor o quien atiende un stand. */
function roleIn(state: VenueState, account: Account | null): Role | null {
  if (!account) return null;
  if (state.ownerId === account.id) return { role: "staff", sponsor: null };
  const byEmail = venueRoles.get(state.venue.id)?.get(account.email);
  if (byEmail) return byEmail;
  const sponsor = state.venue.sponsors.findIndex((s) => s.reps?.includes(account.email));
  return sponsor >= 0 ? { role: "sponsor", sponsor } : null;
}

function applyVenue(venue: Venue, whitelist: Set<string> | null, codes: Record<string, string> = {}, ownerId: string | null = null) {
  const rooms = venues.get(venue.id)?.rooms ?? new Map<string, RoomState>();
  for (const r of venue.rooms) if (!rooms.has(r.id)) rooms.set(r.id, newRoomState());
  for (const id of rooms.keys()) if (!venue.rooms.some((r) => r.id === id)) rooms.delete(id);
  venues.set(venue.id, { venue, whitelist, floors: venueFloors(venue.theme, venue.rooms, standList(venue), venue.capacity), rooms, ownerId });
  for (const r of venue.rooms) {
    const key = `${venue.id}/${r.id}`;
    const code = codes[r.id] ?? speakerCodes.get(key) ?? randomBytes(3).toString("hex").toUpperCase();
    speakerCodes.set(key, code);
  }
}

/**
 * Códigos de ponente de los eventos de ejemplo. Se pueden fijar con
 * SPEAKER_CODES="101/stellar:ABC123,202/soroban:DEF456"; si no, se generan al arrancar.
 */
const fixedCodes = new Map<string, Record<string, string>>();
for (const pair of (process.env.SPEAKER_CODES ?? "").split(",").filter(Boolean)) {
  const [key, code] = pair.split(":");
  const [venueId, roomId] = (key ?? "").split("/");
  if (venueId && roomId && code) fixedCodes.set(venueId, { ...fixedCodes.get(venueId), [roomId]: code.trim().toUpperCase() });
}
for (const { venue, whitelist } of createVenues(dataDir)) applyVenue(venue, whitelist, fixedCodes.get(venue.id));
for (const e of companyEvents.list()) {
  applyVenue(e.venue, e.venue.private ? new Set(e.whitelist) : null, e.speakerCodes, e.ownerId);
  setRoles(e.venue.id, e.staff, e.mentors);
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

app.use("/assets", express.static(assetsDir, { maxAge: "1d" }));

// ---------- Panel de empresa ----------

/** Cuenta de empresa que hace la petición, o responde con el error. */
function companyFrom(req: express.Request, res: express.Response): Account | null {
  const account = accounts.verify(String(req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  if (!account) {
    res.status(401).json({ error: "Inicia sesión de nuevo" });
    return null;
  }
  if (!account.company) {
    res.status(403).json({ error: "Solo las cuentas de empresa pueden organizar eventos" });
    return null;
  }
  return account;
}

function ownedEvent(req: express.Request, res: express.Response) {
  const account = companyFrom(req, res);
  if (!account) return null;
  const entry = companyEvents.get(String(req.params.id));
  if (!entry || entry.ownerId !== account.id) {
    res.status(404).json({ error: "Evento no encontrado" });
    return null;
  }
  return { account, entry };
}

const toCompanyEvent = (e: StoredEvent): CompanyEvent => ({ venue: e.venue, whitelist: e.whitelist, speakerCodes: e.speakerCodes, staff: e.staff ?? [], mentors: e.mentors ?? [] });


const slug = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "sala";

const MAX_TALKS_PER_ROOM = 20;
const DAY = 86_400_000;

/** Valida la agenda de una sala: horarios coherentes, dentro de un rango razonable. */
function readTalks(raw: unknown, roomId: string): Talk[] | string {
  const talks: Talk[] = [];
  for (const t of (Array.isArray(raw) ? raw : []).slice(0, MAX_TALKS_PER_ROOM) as Record<string, unknown>[]) {
    const title = clean(t?.title, 100);
    if (!title) return "Cada charla necesita un título";
    const start = Number(t.start);
    const end = Number(t.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > DAY) {
      return `Revisa el horario de «${title}»`;
    }
    talks.push({ id: `${roomId}-${randomUUID().slice(0, 8)}`, roomId, title, speaker: clean(t.speaker, 60), description: "", start, end });
  }
  return talks.sort((a, b) => a.start - b.start);
}

/**
 * Valida lo que manda el panel y arma las salas, conservando ids y códigos de las
 * que ya existían. La primera sala siempre es el auditorio principal.
 */
function readEventInput(body: Record<string, unknown>, previous: StoredEvent | null) {
  const name = clean(body.name, 60);
  if (!name) return { error: "Ponle un nombre al evento" };
  if (!isTheme(body.theme)) return { error: "Elige un estilo para el evento" };
  const rawRooms = Array.isArray(body.rooms) ? body.rooms.slice(0, MAX_ROOMS) : [];
  if (rawRooms.length < MIN_ROOMS) return { error: `El evento necesita el auditorio principal y al menos ${MIN_ROOMS - 1} salas` };
  if (rawRooms.length > maxRoomsFor(body.theme)) return { error: "Un hackathon tiene el auditorio y hasta 8 salas de charla (4 por piso)" };
  const emails = (list: unknown, max: number) =>
    [
      ...new Set(
        (Array.isArray(list) ? list : [])
          .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ].slice(0, max);
  const whitelist = emails(body.whitelist, 5000);
  const rooms: Room[] = [];
  const talks: Talk[] = [];
  const codes: Record<string, string> = {};
  for (const [index, raw] of (rawRooms as Record<string, unknown>[]).entries()) {
    const main = index === 0;
    const roomName = clean(raw?.name, 40) || (main ? "Auditorio principal" : "");
    if (!roomName) return { error: "Todas las salas necesitan un nombre" };
    const kept = typeof raw.id === "string" && previous?.venue.rooms.some((r) => r.id === raw.id) ? raw.id : null;
    let id = kept ?? slug(roomName);
    if (!kept) for (let i = 2; rooms.some((r) => r.id === id) || previous?.venue.rooms.some((r) => r.id === id); i++) id = `${slug(roomName)}-${i}`;
    rooms.push({
      id,
      name: roomName,
      topic: clean(raw.topic, 80) || (main ? "Charlas principales" : "Charla abierta"),
      color: typeof raw.color === "string" && ROOM_COLORS.includes(raw.color) ? raw.color : ROOM_COLORS[rooms.length % ROOM_COLORS.length]!,
      main,
      theme: isTheme(raw.theme) ? raw.theme : null,
    });
    const roomTalks = readTalks(raw.talks, id);
    if (typeof roomTalks === "string") return { error: roomTalks };
    talks.push(...roomTalks);
    codes[id] = previous?.speakerCodes[id] ?? randomBytes(3).toString("hex").toUpperCase();
  }
  return {
    name,
    tagline: clean(body.tagline, 120),
    theme: body.theme,
    private: body.private !== false,
    staff: emails(body.staff, 200),
    mentors: emails(body.mentors, 500),
    capacity: body.theme === "hackathon" ? (HACKATHON_CAPACITIES.includes(Number(body.capacity)) ? Number(body.capacity) : 100) : undefined,
    whitelist,
    rooms,
    talks,
    codes,
  };
}

function newEventNumber() {
  let id = "";
  do id = String(Math.floor(1000 + Math.random() * 9000));
  while (venues.has(id));
  return id;
}

/** Saca a todos los que estén dentro de un evento y los devuelve a recepción. */
function evictVenue(venueId: string, reason: string) {
  const moved: User[] = [];
  for (const conn of connections.values()) {
    const u = conn.user;
    const sock = io.sockets.sockets.get(u.id);
    if (u.venueId !== venueId || !sock) continue;
    leaveCall(u.id);
    for (const room of [...sock.rooms]) if (room !== sock.id) sock.leave(room);
    const spot = spawnNear(RECEPTION, RECEPTION.spawn);
    Object.assign(u, { venueId: null, roomId: null, floor: 0, speakerFor: null, role: null, sponsor: null, x: spot.x, y: spot.y });
    sock.join("reception");
    sock.to("reception").emit("userJoined", u);
    moved.push(u);
  }
  const users = usersIn(null);
  for (const u of moved) io.to(u.id).emit("evicted", { user: u, users, reason });
}

const json = express.json({ limit: "200kb" });

/** Convierte una cuenta de persona en cuenta de empresa para poder crear eventos. */
app.post("/api/company/upgrade", json, async (req, res) => {
  const account = accounts.verify(String(req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  if (!account) return res.status(401).json({ error: "Inicia sesión de nuevo" });
  try {
    const updated = await accounts.setCompany(account.id, (req.body ?? {}).company);
    for (const conn of connections.values()) if (conn.account?.id === updated.id) conn.account = updated;
    res.json({ account: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof AccountError ? err.message : "No se pudo actualizar la cuenta" });
  }
});

app.get("/api/company/events", (req, res) => {
  const account = companyFrom(req, res);
  if (!account) return;
  res.json(companyEvents.list().filter((e) => e.ownerId === account.id).map(toCompanyEvent));
});

app.post("/api/company/events", json, async (req, res) => {
  const account = companyFrom(req, res);
  if (!account) return;
  const input = readEventInput(req.body ?? {}, null);
  if ("error" in input) return res.status(400).json({ error: input.error });
  const venue: Venue = {
    id: newEventNumber(),
    name: input.name,
    tagline: input.tagline,
    private: input.private,
    theme: input.theme,
    capacity: input.capacity,
    organizer: account.company!.name,
    logoUrl: null,
    rooms: input.rooms,
    talks: input.talks,
    sponsors: [],
  };
  const entry: StoredEvent = { ownerId: account.id, venue, whitelist: input.whitelist, speakerCodes: input.codes, createdAt: Date.now(), staff: input.staff, mentors: input.mentors };
  setRoles(venue.id, input.staff, input.mentors);
  await companyEvents.save(entry);
  applyVenue(venue, venue.private ? new Set(input.whitelist) : null, input.codes, account.id);
  res.json(toCompanyEvent(entry));
});

app.put("/api/company/events/:id", json, async (req, res) => {
  const owned = ownedEvent(req, res);
  if (!owned) return;
  const { entry } = owned;
  const input = readEventInput(req.body ?? {}, entry);
  if ("error" in input) return res.status(400).json({ error: input.error });
  // No se borra una sala con gente adentro.
  const removed = entry.venue.rooms.filter((r) => !input.rooms.some((n) => n.id === r.id));
  const busy = removed.find((r) => [...connections.values()].some((c) => c.user.venueId === entry.venue.id && c.user.roomId === r.id));
  if (busy) return res.status(409).json({ error: `Hay personas en ${busy.name}. Espera a que salgan para quitarla.` });
  entry.venue = {
    ...entry.venue,
    name: input.name,
    tagline: input.tagline,
    private: input.private,
    theme: input.theme,
    capacity: input.capacity,
    rooms: input.rooms,
    talks: input.talks,
  };
  entry.whitelist = input.whitelist;
  entry.staff = input.staff;
  entry.mentors = input.mentors;
  setRoles(entry.venue.id, input.staff, input.mentors);
  entry.speakerCodes = input.codes;
  await companyEvents.save(entry);
  applyVenue(entry.venue, entry.venue.private ? new Set(input.whitelist) : null, input.codes, entry.ownerId);
  io.to(venueChannel(entry.venue.id)).emit("venueUpdated", entry.venue);
  res.json(toCompanyEvent(entry));
});

app.delete("/api/company/events/:id", async (req, res) => {
  const owned = ownedEvent(req, res);
  if (!owned) return;
  const id = owned.entry.venue.id;
  evictVenue(id, "La empresa cerró el evento.");
  for (const s of owned.entry.venue.sponsors) if (s.logoUrl.startsWith("/uploads/")) unlink(path.join(uploadsDir, s.logoUrl.slice(9))).catch(() => {});
  venues.delete(id);
  await companyEvents.remove(id);
  res.json({ ok: true });
});

/** Logos: PNG, JPEG o WebP (sin SVG, que puede llevar scripts). */
const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 4).toString("hex") === "89504e47" },
  "image/jpeg": { ext: "jpg", magic: (b) => b.subarray(0, 3).toString("hex") === "ffd8ff" },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(8, 12).toString() === "WEBP" },
};

app.post("/api/company/events/:id/sponsors", express.raw({ type: Object.keys(IMAGE_TYPES), limit: "2mb" }), async (req, res) => {
  const owned = ownedEvent(req, res);
  if (!owned) return;
  const { entry } = owned;
  const type = IMAGE_TYPES[String(req.header("content-type")).split(";")[0]!];
  const body = req.body;
  if (!type || !Buffer.isBuffer(body) || !type.magic(body)) return res.status(400).json({ error: "El logo debe ser una imagen PNG, JPG o WebP" });
  if (entry.venue.sponsors.length >= 12) return res.status(400).json({ error: "Puedes tener hasta 12 patrocinadores" });
  const name = clean(decodeURIComponent(String(req.header("x-sponsor-name") ?? "")), 60);
  if (!name) return res.status(400).json({ error: "Escribe el nombre del patrocinador" });
  const fileName = `${entry.venue.id}-${randomUUID()}.${type.ext}`;
  await writeFile(path.join(logosDir, fileName), body);
  entry.venue = {
    ...entry.venue,
    sponsors: [...entry.venue.sponsors, {
        id: randomUUID(),
        name,
        logoUrl: `/uploads/logos/${fileName}`,
        url: safeUrl(decodeURIComponent(String(req.header("x-sponsor-url") ?? ""))),
        pitch: clean(decodeURIComponent(String(req.header("x-sponsor-pitch") ?? "")), 280),
        reps: decodeURIComponent(String(req.header("x-sponsor-reps") ?? ""))
          .split(/[\s,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
          .slice(0, 2),
      }],
  };
  await companyEvents.save(entry);
  applyVenue(entry.venue, venues.get(entry.venue.id)!.whitelist, entry.speakerCodes, entry.ownerId);
  io.to(venueChannel(entry.venue.id)).emit("venueUpdated", entry.venue);
  res.json(toCompanyEvent(entry));
});

/** Logo del evento para la pantalla grande del lobby. */
app.post("/api/company/events/:id/logo", express.raw({ type: Object.keys(IMAGE_TYPES), limit: "2mb" }), async (req, res) => {
  const owned = ownedEvent(req, res);
  if (!owned) return;
  const { entry } = owned;
  const type = IMAGE_TYPES[String(req.header("content-type")).split(";")[0]!];
  const body = req.body;
  if (!type || !Buffer.isBuffer(body) || !type.magic(body)) return res.status(400).json({ error: "El logo debe ser una imagen PNG, JPG o WebP" });
  const fileName = `${entry.venue.id}-logo-${randomUUID()}.${type.ext}`;
  await writeFile(path.join(logosDir, fileName), body);
  const previous = entry.venue.logoUrl;
  if (previous?.startsWith("/uploads/")) unlink(path.join(uploadsDir, previous.slice(9))).catch(() => {});
  entry.venue = { ...entry.venue, logoUrl: `/uploads/logos/${fileName}` };
  await companyEvents.save(entry);
  applyVenue(entry.venue, venues.get(entry.venue.id)!.whitelist, entry.speakerCodes, entry.ownerId);
  io.to(venueChannel(entry.venue.id)).emit("venueUpdated", entry.venue);
  res.json(toCompanyEvent(entry));
});

app.delete("/api/company/events/:id/sponsors/:sponsorId", async (req, res) => {
  const owned = ownedEvent(req, res);
  if (!owned) return;
  const { entry } = owned;
  const sponsor = entry.venue.sponsors.find((s) => s.id === req.params.sponsorId);
  if (!sponsor) return res.status(404).json({ error: "Patrocinador no encontrado" });
  if (sponsor.logoUrl.startsWith("/uploads/")) unlink(path.join(uploadsDir, sponsor.logoUrl.slice(9))).catch(() => {});
  entry.venue = { ...entry.venue, sponsors: entry.venue.sponsors.filter((s) => s.id !== sponsor.id) };
  await companyEvents.save(entry);
  applyVenue(entry.venue, venues.get(entry.venue.id)!.whitelist, entry.speakerCodes, entry.ownerId);
  io.to(venueChannel(entry.venue.id)).emit("venueUpdated", entry.venue);
  res.json(toCompanyEvent(entry));
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/(api|uploads|assets|socket\.io)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
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
  const state = venues.get(u.venueId);
  if (!state) return RECEPTION;
  if (u.roomId) return interiorOf(state.venue, u.roomId);
  return state.floors[u.floor] ?? state.floors[0]!;
}

const guestName = () => `Invitado ${Math.floor(1000 + Math.random() * 9000)}`;

// ---------- Charlas privadas ----------

/** Charla privada por micrófono: el servidor solo sabe quién está y pasa las señales de WebRTC. */
interface PrivateCall {
  id: string;
  venueId: string;
  members: Set<string>;
  invited: Set<string>;
  /** Si es la conversación de una mesa de equipo: su nombre y cuántos caben. */
  zone?: { label: string; seats: number; meeting: boolean };
  media: Map<string, CallMedia>;
}
const calls = new Map<string, PrivateCall>();
const callOfUser = new Map<string, string>();
const MAX_CALL = 8;

const callInfo = (call: PrivateCall): CallInfo => ({
  id: call.id,
  zone: call.zone?.label ?? null,
  meeting: call.zone?.meeting ?? false,
  media: Object.fromEntries(call.media),
  members: [...call.members].flatMap((id) => {
    const user = connections.get(id)?.user;
    return user ? [user] : [];
  }),
});

function setInCall(userId: string, inCall: boolean) {
  const c = connections.get(userId);
  if (!c || c.user.inCall === inCall) return;
  c.user.inCall = inCall;
  io.to(presenceChannel(c.user)).emit("userUpdated", c.user);
}

function emitCall(call: PrivateCall) {
  const info = callInfo(call);
  for (const id of call.members) io.to(id).emit("callUpdated", info);
}

function endCall(call: PrivateCall) {
  calls.delete(call.id);
  for (const id of call.members) {
    callOfUser.delete(id);
    setInCall(id, false);
    io.to(id).emit("callUpdated", null);
  }
  for (const id of call.invited) io.to(id).emit("callCancelled", call.id);
}

/** Saca a alguien de su charla; si queda una sola persona y nadie por contestar, la charla termina. */
function leaveCall(userId: string) {
  const call = calls.get(callOfUser.get(userId) ?? "");
  if (!call) return;
  call.members.delete(userId);
  call.media.delete(userId);
  callOfUser.delete(userId);
  setInCall(userId, false);
  io.to(userId).emit("callUpdated", null);
  // La mesa sigue abierta mientras quede alguien sentado.
  if (call.zone) {
    if (call.members.size === 0) calls.delete(call.id);
    else emitCall(call);
  } else if (call.members.size < 2 && call.invited.size === 0) endCall(call);
  else emitCall(call);
}

/** Mesa en la que alguien quedó fuera a propósito (salió de la charla sin levantarse). */
const zoneOptOut = new Map<string, string>();

/**
 * Mesas de equipo: al entrar al rectángulo de una mesa te sumas a su
 * conversación, y al salir la dejas. Solo se escucha y se ve a quienes están
 * en el mismo rectángulo.
 */
function syncZone(u: User) {
  const state = u.venueId ? venues.get(u.venueId) : undefined;
  const map = state && !u.roomId ? state.floors[u.floor] : undefined;
  const here = { x: Math.round(u.x), y: Math.round(u.y) };
  const zone = map?.zones.find((z) => inZone(here, z));
  const key = zone ? `zone:${u.venueId}:${u.floor}:${zone.id}` : null;
  const current = callOfUser.get(u.id);
  if (zoneOptOut.has(u.id) && zoneOptOut.get(u.id) !== key) zoneOptOut.delete(u.id);
  if (current?.startsWith("zone:") && current !== key) leaveCall(u.id);
  if (!key || !zone || callOfUser.get(u.id) === key || zoneOptOut.get(u.id) === key) return;
  // La sala de organizadores es solo para su equipo.
  if (zone.staff && u.role !== "staff") return;
  let call = calls.get(key);
  if (call && call.members.size >= zone.seats) {
    io.to(u.id).emit("callNotice", `${zone.label} está completa (${zone.seats} personas). Prueba otra mesa.`);
    zoneOptOut.set(u.id, key);
    return;
  }
  if (callOfUser.has(u.id)) leaveCall(u.id);
  if (!call) {
    call = { id: key, venueId: u.venueId!, members: new Set(), invited: new Set(), zone: { label: zone.label, seats: zone.seats, meeting: Boolean(zone.room) }, media: new Map() };
    calls.set(key, call);
  }
  call.members.add(u.id);
  callOfUser.set(u.id, key);
  setInCall(u.id, true);
  emitCall(call);
}

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
      inCall: false,
      role: null,
      sponsor: null,
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
    // A la sala de organizadores solo entra su equipo.
    if (offLimits(map, { x: Math.round(x), y: Math.round(y) }, u)) return;
    u.x = Math.max(0, Math.min(map.w - 1, Math.round(x * 100) / 100));
    u.y = Math.max(0, Math.min(map.h - 1, Math.round(y * 100) / 100));
    socket.to(sceneChannel(u)).volatile.emit("moved", { id: u.id, x: u.x, y: u.y });
    syncZone(u);
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
    if (!state) return ack({ ok: false, error: `No encuentro el evento ${id || number}. ¿Puedes revisar el número?` });
    // La empresa dueña siempre puede entrar a su evento.
    const roleInfo = roleIn(state, conn.account);
    if (state.whitelist && !roleInfo) {
      if (!conn.account) {
        return ack({ ok: false, error: `El evento ${id} es privado. Inicia sesión con tu cuenta para que revise la lista de invitados.` });
      }
      if (!state.whitelist.has(conn.account.email)) {
        return ack({ ok: false, error: `Lo siento, ${conn.account.email} no está en la lista de invitados del evento ${id}.` });
      }
    }

    socket.leave("reception");
    socket.to("reception").emit("userLeft", u.id);
    const ground = state.floors[0]!;
    const spot = spawnNear(ground, ground.spawn);
    Object.assign(u, { venueId: id, roomId: null, floor: 0, speakerFor: null, role: roleInfo?.role ?? null, sponsor: roleInfo?.sponsor ?? null, x: spot.x, y: spot.y });
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
    leaveCall(u.id);
    leaveCurrentRoom();
    socket.leave(venueChannel(venueId));
    socket.leave(hallChannel(venueId, u.floor));
    socket.to(venueChannel(venueId)).emit("userLeft", u.id);
    const spot = spawnNear(RECEPTION, RECEPTION.spawn);
    Object.assign(u, { venueId: null, roomId: null, floor: 0, speakerFor: null, role: null, sponsor: null, x: spot.x, y: spot.y });
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
      syncZone(u);
      const interior = interiorOf(venues.get(u.venueId)!.venue, roomId);
      u.x = interior.spawn.x;
      u.y = interior.spawn.y;
      if (u.speakerFor === roomId) {
        state.stage = { ...state.stage, presenterId: u.id };
        socket.to(roomChannel(u.venueId, roomId)).emit("stage", state.stage);
      }
      io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    }
    let seat: number | null = null;
    for (const [s, id] of state.seats) if (id === u.id) seat = s;
    if (seat === null && u.speakerFor !== roomId) {
      seat = interiorOf(venues.get(u.venueId)!.venue, roomId).seats.findIndex((_, i) => !state.seats.has(i));
      if (seat < 0) seat = null;
      else state.seats.set(seat, u.id);
    }
    ack({ ok: true, data: { stage: state.stage, chat: state.chat, questions: sortQuestions(state.questions), seat, user: u } });
  });

  socket.on("leaveRoom", (ack) => {
    const u = conn?.user;
    if (!u?.venueId || !u.roomId) return ack({ ok: false, error: "No estás en una sala" });
    const floors = venues.get(u.venueId)!.floors;
    const floor = floorOfRoom(floors, u.roomId);
    const map = floors[floor]!;
    const door = map.doors.find((d) => d.id === u.roomId);
    leaveCurrentRoom();
    // Aparece justo afuera de la puerta de la sala que dejó.
    const spot = door ? inFront(door) : map.spawn;
    Object.assign(u, { floor, x: spot.x, y: spot.y });
    socket.join(hallChannel(u.venueId, floor));
    io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    syncZone(u);
    ack({ ok: true, data: { user: u } });
  });


  socket.on("emote", (emoji) => {
    if (!conn || !EMOTES.includes(emoji)) return;
    const now = Date.now();
    if (now - lastSaid < 400) return;
    lastSaid = now;
    io.to(sceneChannel(conn.user)).emit("emote", { userId: conn.user.id, emoji });
  });

  socket.on("changeFloor", (floor, ack) => {
    const u = conn?.user;
    if (!u?.venueId || u.roomId) return ack({ ok: false, error: "Solo se cambia de piso desde los pasillos" });
    const floors = venues.get(u.venueId)!.floors;
    const target = Math.floor(Number(floor));
    if (!floors[target] || !floors[u.floor]?.stairs.some((s) => s.to === target)) return ack({ ok: false, error: "Esa escalera no lleva ahí" });
    socket.leave(hallChannel(u.venueId, u.floor));
    const spot = stairsArrival(floors, target, u.floor);
    Object.assign(u, { floor: target, x: spot.x, y: spot.y });
    socket.join(hallChannel(u.venueId, target));
    io.to(venueChannel(u.venueId)).emit("userUpdated", u);
    syncZone(u);
    ack({ ok: true, data: { user: u } });
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

  // ----- Charlas privadas -----

  socket.on("callInvite", (userId, ack) => {
    const me = conn?.user;
    const target = connections.get(String(userId))?.user;
    if (!me?.venueId) return ack({ ok: false, error: "Entra a un evento para charlar" });
    if (!target || target.venueId !== me.venueId || target.id === me.id) return ack({ ok: false, error: "Esa persona ya no está en el evento" });
    let call = calls.get(callOfUser.get(me.id) ?? "");
    if (call?.zone) return ack({ ok: false, error: "En una mesa de equipo la gente se suma acercándose a la mesa" });
    if (call?.members.has(target.id)) return ack({ ok: false, error: `${target.name} ya está en tu charla` });
    if (call && call.members.size + call.invited.size >= MAX_CALL) return ack({ ok: false, error: `Una charla privada es de hasta ${MAX_CALL} personas` });
    if (!call) {
      call = { id: randomUUID(), venueId: me.venueId, members: new Set([me.id]), invited: new Set(), media: new Map() };
      calls.set(call.id, call);
      callOfUser.set(me.id, call.id);
      setInCall(me.id, true);
      emitCall(call);
    }
    call.invited.add(target.id);
    const members = [...call.members].map((id) => connections.get(id)?.user.name ?? "").filter(Boolean);
    io.to(target.id).emit("callInvited", { callId: call.id, from: me, members });
    ack({ ok: true, data: null });
  });

  socket.on("callRespond", (callId, accept, ack) => {
    const me = conn?.user;
    const call = calls.get(String(callId));
    if (!me || !call || !call.invited.has(me.id)) return ack({ ok: false, error: "Esa charla ya terminó" });
    call.invited.delete(me.id);
    if (!accept || me.venueId !== call.venueId) {
      for (const id of call.members) io.to(id).emit("callDeclined", { name: me.name });
      if (call.members.size < 2 && call.invited.size === 0) endCall(call);
      return ack({ ok: true, data: null });
    }
    const previous = callOfUser.get(me.id);
    if (previous?.startsWith("zone:")) zoneOptOut.set(me.id, previous);
    if (previous) leaveCall(me.id);
    if (!calls.has(call.id)) return ack({ ok: false, error: "Esa charla ya terminó" });
    call.members.add(me.id);
    callOfUser.set(me.id, call.id);
    setInCall(me.id, true);
    emitCall(call);
    ack({ ok: true, data: callInfo(call) });
  });

  socket.on("callLeave", () => {
    if (!conn) return;
    const current = callOfUser.get(conn.user.id);
    // Quien sale de la charla de una mesa sin levantarse no vuelve a entrar hasta que se mueva a otra.
    if (current?.startsWith("zone:")) zoneOptOut.set(conn.user.id, current);
    leaveCall(conn.user.id);
  });

  socket.on("callMedia", (media) => {
    if (!conn) return;
    const call = calls.get(callOfUser.get(conn.user.id) ?? "");
    if (!call) return;
    call.media.set(conn.user.id, { cam: Boolean(media?.cam), screen: Boolean(media?.screen) });
    emitCall(call);
  });

  socket.on("callSignal", (to, signal) => {
    const me = conn?.user;
    const callId = me && callOfUser.get(me.id);
    if (!callId || callOfUser.get(String(to)) !== callId || !signal || typeof signal !== "object") return;
    if (!["offer", "answer", "ice"].includes(signal.kind)) return;
    io.to(String(to)).emit("callSignal", me.id, signal);
  });

  socket.on("disconnect", () => {
    if (!conn) return;
    const u = conn.user;
    leaveCall(u.id);
    zoneOptOut.delete(u.id);
    for (const call of calls.values()) if (call.invited.delete(u.id) && call.members.size < 2 && call.invited.size === 0) endCall(call);
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
