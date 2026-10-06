import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import type {
  ChatMessage,
  ClientToServerEvents,
  Question,
  ServerToClientEvents,
  Stage,
  User,
} from "../../shared/types.ts";
import { createEvent } from "./seed.ts";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_CHAT = 200;
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(here, "../uploads");
const clientDist = path.resolve(here, "../../client/dist");
mkdirSync(uploadsDir, { recursive: true });

const event = createEvent();

// ---------- Estado en memoria ----------

interface RoomState {
  stage: Stage;
  chat: ChatMessage[];
  questions: Question[];
}

const users = new Map<string, User>();
const roomStates = new Map<string, RoomState>(
  event.rooms.map((r) => [
    r.id,
    {
      stage: { mode: "slides", slidesUrl: null, slidesName: null, slide: 1, streamUrl: null, presenterId: null },
      chat: [],
      questions: [],
    },
  ]),
);

/**
 * Códigos de expositor por sala. Se pueden fijar con
 * SPEAKER_CODES="auditorio:abc123,stellar:def456"; si no, se generan al arrancar.
 */
const speakerCodes = new Map<string, string>();
for (const pair of (process.env.SPEAKER_CODES ?? "").split(",").filter(Boolean)) {
  const [roomId, code] = pair.split(":");
  if (roomStates.has(roomId) && code) speakerCodes.set(code.trim().toUpperCase(), roomId);
}
for (const room of event.rooms) {
  if (![...speakerCodes.values()].includes(room.id)) {
    speakerCodes.set(randomBytes(3).toString("hex").toUpperCase(), room.id);
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

// ---------- HTTP ----------

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { maxHttpBufferSize: 1e5 });

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, users: users.size });
});

app.get("/api/event", (_req, res) => {
  res.json(event);
});

app.use("/uploads", express.static(uploadsDir, { maxAge: "1h" }));

app.post("/api/rooms/:roomId/slides", express.raw({ type: "application/pdf", limit: "50mb" }), async (req, res) => {
  const roomId = req.params.roomId;
  const state = roomStates.get(roomId);
  const code = String(req.header("x-speaker-code") ?? "").toUpperCase();
  if (!state) return res.status(404).json({ error: "Sala no encontrada" });
  if (speakerCodes.get(code) !== roomId) return res.status(403).json({ error: "Código de expositor inválido para esta sala" });
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.subarray(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({ error: "El archivo debe ser un PDF" });
  }

  const fileName = `${roomId}-${Date.now()}.pdf`;
  await writeFile(path.join(uploadsDir, fileName), body);
  const previous = state.stage.slidesUrl;
  if (previous) unlink(path.join(uploadsDir, path.basename(previous))).catch(() => {});

  const originalName = clean(decodeURIComponent(String(req.header("x-file-name") ?? "presentacion.pdf")), 120);
  state.stage = { ...state.stage, mode: "slides", slidesUrl: `/uploads/${fileName}`, slidesName: originalName, slide: 1 };
  io.to(roomId).emit("stage", state.stage);
  res.json({ ok: true });
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/(api|uploads|socket\.io)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// ---------- Tiempo real ----------

io.on("connection", (socket) => {
  let user: User | null = null;

  const presenterRoom = () => {
    if (!user?.roomId || user.speakerFor !== user.roomId) return null;
    return roomStates.get(user.roomId) ?? null;
  };

  socket.on("join", (req, ack) => {
    if (user) return ack({ ok: true, data: { user, event, users: [...users.values()] } });
    const name = clean(req?.name, 40);
    if (!name) return ack({ ok: false, error: "Escribe tu nombre para entrar" });
    const code = clean(req.speakerCode, 20).toUpperCase();
    const speakerFor = code ? speakerCodes.get(code) ?? null : null;
    if (code && !speakerFor) return ack({ ok: false, error: "El código de expositor no es válido" });

    const color = /^#[0-9a-f]{6}$/i.test(req.color) ? req.color : "#6366f1";
    const { spawn } = event.map;
    user = {
      id: socket.id,
      name,
      title: clean(req.title, 60),
      color,
      roomId: null,
      speakerFor,
      x: spawn.x + Math.round((Math.random() - 0.5) * 120),
      y: spawn.y + Math.round((Math.random() - 0.5) * 60),
    };
    users.set(socket.id, user);
    socket.join("hall");
    socket.broadcast.emit("userJoined", user);
    ack({ ok: true, data: { user, event, users: [...users.values()] } });
  });

  socket.on("move", (pos) => {
    if (!user || user.roomId) return;
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    user.x = Math.max(0, Math.min(event.map.width, Math.round(x)));
    user.y = Math.max(0, Math.min(event.map.height, Math.round(y)));
    // Se envía a todos para que quien vuelva de una sala vea las posiciones actuales.
    socket.broadcast.volatile.emit("moved", { id: user.id, x: user.x, y: user.y });
  });

  const leaveCurrentRoom = () => {
    if (!user?.roomId) return;
    const state = roomStates.get(user.roomId);
    if (state?.stage.presenterId === user.id) {
      state.stage = { ...state.stage, presenterId: null };
      io.to(user.roomId).emit("stage", state.stage);
    }
    socket.leave(user.roomId);
    user.roomId = null;
  };

  socket.on("enterRoom", (roomId, ack) => {
    if (!user) return ack({ ok: false, error: "Primero entra al evento" });
    const state = roomStates.get(roomId);
    if (!state) return ack({ ok: false, error: "Sala no encontrada" });
    if (user.roomId !== roomId) {
      leaveCurrentRoom();
      socket.leave("hall");
      socket.join(roomId);
      user.roomId = roomId;
      if (user.speakerFor === roomId) {
        state.stage = { ...state.stage, presenterId: user.id };
        socket.to(roomId).emit("stage", state.stage);
      }
      io.emit("userUpdated", user);
    }
    ack({ ok: true, data: { stage: state.stage, chat: state.chat, questions: sortQuestions(state.questions) } });
  });

  socket.on("leaveRoom", (ack) => {
    if (!user) return ack({ ok: false, error: "Primero entra al evento" });
    const room = event.rooms.find((r) => r.id === user!.roomId);
    leaveCurrentRoom();
    if (room) {
      // Aparece justo afuera de la puerta de la sala que dejó.
      const below = room.door.y > room.area.y;
      user.x = room.door.x + room.door.w / 2;
      user.y = below ? room.door.y + room.door.h + 30 : room.door.y - 30;
    }
    socket.join("hall");
    io.emit("userUpdated", user);
    ack({ ok: true, data: { x: user.x, y: user.y } });
  });

  socket.on("chat", (text) => {
    if (!user?.roomId) return;
    const msg = clean(text, 500);
    if (!msg) return;
    const state = roomStates.get(user.roomId)!;
    const entry: ChatMessage = { id: randomUUID(), userId: user.id, name: user.name, color: user.color, text: msg, ts: Date.now() };
    state.chat.push(entry);
    if (state.chat.length > MAX_CHAT) state.chat.splice(0, state.chat.length - MAX_CHAT);
    io.to(user.roomId).emit("chat", entry);
  });

  socket.on("ask", (text) => {
    if (!user?.roomId) return;
    const q = clean(text, 300);
    if (!q) return;
    const state = roomStates.get(user.roomId)!;
    state.questions.push({ id: randomUUID(), userId: user.id, name: user.name, text: q, votes: [user.id], answered: false, ts: Date.now() });
    io.to(user.roomId).emit("questions", sortQuestions(state.questions));
  });

  socket.on("vote", (questionId) => {
    if (!user?.roomId) return;
    const state = roomStates.get(user.roomId)!;
    const q = state.questions.find((x) => x.id === questionId);
    if (!q) return;
    q.votes = q.votes.includes(user.id) ? q.votes.filter((v) => v !== user!.id) : [...q.votes, user.id];
    io.to(user.roomId).emit("questions", sortQuestions(state.questions));
  });

  socket.on("markAnswered", (questionId) => {
    const state = presenterRoom();
    const q = state?.questions.find((x) => x.id === questionId);
    if (!state || !q) return;
    q.answered = !q.answered;
    io.to(user!.roomId!).emit("questions", sortQuestions(state.questions));
  });

  socket.on("setSlide", (slide) => {
    const state = presenterRoom();
    const n = Math.floor(Number(slide));
    if (!state || !Number.isFinite(n) || n < 1 || n > 2000) return;
    state.stage = { ...state.stage, slide: n };
    io.to(user!.roomId!).emit("stage", state.stage);
  });

  socket.on("setStream", (url) => {
    const state = presenterRoom();
    if (!state) return;
    const streamUrl = safeUrl(url);
    state.stage = { ...state.stage, streamUrl, mode: streamUrl ? "stream" : "slides" };
    io.to(user!.roomId!).emit("stage", state.stage);
  });

  socket.on("setMode", (mode) => {
    const state = presenterRoom();
    if (!state || (mode !== "slides" && mode !== "stream")) return;
    state.stage = { ...state.stage, mode };
    io.to(user!.roomId!).emit("stage", state.stage);
  });

  socket.on("disconnect", () => {
    if (!user) return;
    leaveCurrentRoom();
    users.delete(socket.id);
    io.emit("userLeft", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  MyConferences escuchando en http://localhost:${PORT}\n`);
  console.log("  Códigos de expositor:");
  for (const [code, roomId] of speakerCodes) {
    const room = event.rooms.find((r) => r.id === roomId)!;
    console.log(`    ${room.name.padEnd(22)} ${code}`);
  }
  console.log();
});
