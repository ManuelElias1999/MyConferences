import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { isWalkable, onSpan, sameTile, spanTiles, type Dir, type Door, type Npc, type SceneMap, type Span, type Tile } from "../../shared/maps.ts";
import { EMOTES } from "../../shared/themes.ts";
import type { Bubble, Look, User } from "../../shared/types.ts";
import { avatarHeight, drawAvatar } from "./avatar.ts";
import { socket } from "./lib.ts";
import {
  drawAnimatedDecor,
  drawBubble,
  drawName,
  drawPlaques,
  drawScreenContent,
  drawSponsorScreens,
  feet,
  findPath,
  furniDrawables,
  renderStatic,
  screenToTile,
  T,
  type DoorStatus,
  type Drawable,
  type Media,
} from "./world.ts";

const SPEED = 6.5; // baldosas por segundo
const REMOTE_SPEED = 7;
const BUBBLE_MS = 7000;
const EMOTE_MS = 2600;
const CHATTER_MS = 4200;

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const DELTA: Record<Dir, Tile> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** Frases de la gente que conversa en los pasillos. */
const CHATTER = [
  "¿Vas al auditorio?",
  "La charla de IA estuvo buenísima",
  "¿Dónde es el taller?",
  "Hay café en la plaza",
  "¿Te pasaste por el stand?",
  "Nos vemos en la próxima",
  "¿Grabarán las charlas?",
  "Me encantó la demo",
  "¿Conectamos en LinkedIn?",
  "Ya casi empieza la keynote",
];

const dirFrom = (dx: number, dy: number, fallback: Dir): Dir =>
  Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3 ? fallback : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

export interface SceneHandle {
  /** Camina hasta la baldosa y luego llama a `then`. Devuelve false si no hay camino. */
  walkTo: (tile: Tile, then?: () => void) => boolean;
  /** Marca en el suelo el camino hasta una baldosa (o lo borra con null). */
  guide: (tile: Tile | null) => void;
  bubble: (userId: string, text: string) => void;
}

export interface SceneProps {
  map: SceneMap;
  me: User;
  users: Map<string, User>;
  inScene: (u: User) => boolean;
  camera: "follow" | "fit";
  names: "all" | "hover";
  doorStatus?: Map<string, DoorStatus>;
  screen?: { color: string; title: string; live: boolean };
  /** Logos que rotan en las pantallas y tótems de patrocinadores. */
  media?: Media;
  locked?: boolean;
  onDoor?: (door: Door) => void;
  onExit?: () => void;
  onNpc?: (npc: Npc) => void;
  onDirectory?: () => void;
  handle?: Ref<SceneHandle>;
  label: string;
}

interface Walker {
  x: number;
  y: number;
  dir: Dir;
  walk: number;
  moving: boolean;
}

interface MyState extends Walker {
  seg: { from: Tile; to: Tile; t: number } | null;
  path: Tile[];
  then: (() => void) | null;
}

const near = (a: Tile, b: Tile) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

export default function Scene(props: SceneProps) {
  const { map, me, handle } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const [prompt, setPrompt] = useState<string | null>(null);
  const showMinimap = map.w > 30;

  const my = useRef<MyState>({ x: me.x, y: me.y, dir: "down", walk: 0, moving: false, seg: null, path: [], then: null });
  const others = useRef(new Map<string, Walker>());
  const bubbles = useRef(new Map<string, { text: string; at: number }>());
  const emotes = useRef(new Map<string, { emoji: string; at: number }>());
  const keys = useRef<Dir[]>([]);
  const guideTo = useRef<Tile | null>(null);
  const view = useRef({ zoom: 1, camX: 0, camY: 0, w: 0, h: 0 });
  const hover = useRef<{ tile: Tile | null; user: string | null; npc: string | null; door: string | null }>({
    tile: null,
    user: null,
    npc: null,
    door: null,
  });

  const here = () => ({ x: Math.round(my.current.x), y: Math.round(my.current.y) });

  const walkTo = (tile: Tile, then?: () => void) => {
    const s = my.current;
    const from = s.seg ? s.seg.to : here();
    const path = findPath(map, from, tile);
    if (!path) return false;
    s.path = path;
    s.then = then ?? null;
    if (!s.seg && !path.length) {
      s.then = null;
      then?.();
    }
    return true;
  };

  /** NPC al lado del personaje (o del mostrador en el que está parado). */
  const nearbyNpc = () => {
    if (my.current.seg) return null;
    const h = here();
    return map.npcs.find((n) => map.desk.some((t) => sameTile(h, t)) || Math.abs(n.x - h.x) + Math.abs(n.y - h.y) === 1) ?? null;
  };
  const nearbyDirectory = () => (my.current.seg ? null : (map.directories.find((d) => near(d, here())) ?? null));

  /** Baldosa libre junto a un objeto, la más cercana al personaje. */
  const besideTile = (t: Tile) =>
    [
      { x: t.x, y: t.y + 1 },
      { x: t.x - 1, y: t.y },
      { x: t.x + 1, y: t.y },
      { x: t.x, y: t.y - 1 },
    ]
      .filter((c) => isWalkable(map, c.x, c.y))
      .sort((a, b) => Math.hypot(a.x - my.current.x, a.y - my.current.y) - Math.hypot(b.x - my.current.x, b.y - my.current.y));

  useImperativeHandle(handle, () => ({
    walkTo,
    guide: (tile) => (guideTo.current = tile),
    bubble: (userId, text) => bubbles.current.set(userId, { text, at: performance.now() }),
  }));

  useEffect(() => {
    const onBubble = (b: Bubble) => bubbles.current.set(b.userId, { text: b.text, at: performance.now() });
    const onEmote = (e: { userId: string; emoji: string }) => emotes.current.set(e.userId, { emoji: e.emoji, at: performance.now() });
    socket.on("bubble", onBubble);
    socket.on("emote", onEmote);
    return () => {
      socket.off("bubble", onBubble);
      socket.off("emote", onEmote);
    };
  }, []);

  // Teclado: flechas o WASD para caminar, X para interactuar, 1 a 5 para reaccionar.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const name = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || live.current.locked) return;
      const k = name(e);
      const dir = KEY_DIRS[k];
      if (dir) {
        e.preventDefault();
        keys.current = [dir, ...keys.current.filter((d) => d !== dir)];
        my.current.path = [];
        my.current.then = null;
      } else if (/^[1-5]$/.test(k)) {
        socket.emit("emote", EMOTES[Number(k) - 1]!);
      } else if (k === "x") {
        const npc = nearbyNpc();
        if (npc) live.current.onNpc?.(npc);
        else if (nearbyDirectory()) live.current.onDirectory?.();
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[name(e)];
      if (dir) keys.current = keys.current.filter((d) => d !== dir);
    };
    const clear = () => (keys.current = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [map]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const backdrop = renderStatic(map, 2);
    const furni = furniDrawables(map, () => live.current.media ?? { sponsors: [], title: "" });
    const W = map.w * T;
    const H = map.h * T;

    // Minimapa: el recinto en miniatura con las puertas marcadas.
    const mini = miniRef.current;
    const miniCtx = mini?.getContext("2d") ?? null;
    const MINI_W = 180;
    const miniScale = MINI_W / W;
    if (mini) {
      const dpr = window.devicePixelRatio || 1;
      mini.width = MINI_W * dpr;
      mini.height = H * miniScale * dpr;
      mini.style.width = `${MINI_W}px`;
      mini.style.height = `${H * miniScale}px`;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      view.current.w = w;
      view.current.h = h;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let lastSent = "";
    const sendPos = (t: Tile) => {
      const k = `${t.x},${t.y}`;
      if (k === lastSent) return;
      lastSent = k;
      socket.emit("move", t);
    };

    const arrive = (to: Tile) => {
      const s = my.current;
      const p = live.current;
      // En un camino automático solo cuenta la puerta de destino: así no se sale por
      // accidente quien aparece sobre la puerta y camina hacia su asiento.
      const intended = !s.path.length || keys.current.length > 0;
      const door = intended && p.onDoor && map.doors.find((d) => onSpan(to, d));
      const exit = intended && p.onExit && map.exit && onSpan(to, map.exit);
      if (door || exit) {
        s.path = [];
        s.then = null;
        keys.current = [];
        s.moving = false;
        guideTo.current = null;
        if (door) p.onDoor!(door);
        else p.onExit!();
        return;
      }
      if (!s.path.length && !keys.current.length) {
        s.moving = false;
        const then = s.then;
        s.then = null;
        then?.();
      }
    };

    const step = (dt: number) => {
      const s = my.current;
      if (!s.seg) {
        let next: Tile | undefined;
        const held = keys.current[0];
        if (held) {
          const d = DELTA[held];
          const target = { x: Math.round(s.x) + d.x, y: Math.round(s.y) + d.y };
          s.dir = held;
          if (isWalkable(map, target.x, target.y)) next = target;
        } else if (s.path.length) next = s.path.shift();
        if (next) {
          s.seg = { from: { x: s.x, y: s.y }, to: next, t: 0 };
          sendPos(next);
        } else s.moving = false;
      }
      if (s.seg) {
        const { from, to } = s.seg;
        s.seg.t = Math.min(1, s.seg.t + dt * SPEED);
        s.x = from.x + (to.x - from.x) * s.seg.t;
        s.y = from.y + (to.y - from.y) * s.seg.t;
        s.dir = dirFrom(to.x - from.x, to.y - from.y, s.dir);
        s.walk = (s.walk + dt * 3.2) % 1;
        s.moving = true;
        if (s.seg.t >= 1) {
          s.seg = null;
          arrive(to);
        }
      }
    };

    const poseFor = (w: Walker, fixedDir?: Dir) => {
      const tile = { x: Math.round(w.x), y: Math.round(w.y) };
      const still = !w.moving && Math.abs(w.x - tile.x) < 0.05 && Math.abs(w.y - tile.y) < 0.05;
      const seat = still ? map.seats.find((s) => s.x === tile.x && s.y === tile.y) : undefined;
      const atPodium = still && map.podium && sameTile(tile, map.podium);
      return {
        dir: fixedDir ?? (seat ? seat.dir : atPodium ? ("down" as Dir) : w.dir),
        walk: w.moving ? w.walk : null,
        sitting: Boolean(seat),
      };
    };

    const lookAhead = { x: 0, y: 0 };
    const updateCamera = () => {
      const v = view.current;
      if (live.current.camera === "fit") {
        // En la franja del público se encuadran el atril y los asientos.
        const spots = [...map.seats, ...(map.podium ? [map.podium] : [])];
        if (!spots.length) spots.push({ x: 1, y: 3 }, { x: map.w - 2, y: map.h - 2 });
        const x0 = Math.min(...spots.map((s) => s.x)) - 1;
        const x1 = Math.max(...spots.map((s) => s.x)) + 2;
        const y0 = Math.min(...spots.map((s) => s.y)) - 1.5;
        const y1 = Math.max(...spots.map((s) => s.y)) + 1.5;
        v.zoom = Math.min(2, v.w / ((x1 - x0) * T), v.h / ((y1 - y0) * T));
        v.camX = ((x0 + x1) / 2) * T;
        v.camY = ((y0 + y1) / 2) * T;
        return;
      }
      // Mapas chicos se ven completos; en el recinto grande la cámara sigue al personaje.
      v.zoom = showMinimap ? Math.max(1.1, Math.min(1.8, v.h / (19 * T))) : Math.max(1, Math.min(2, v.h / H, v.w / W));
      const f = feet(my.current.x, my.current.y);
      // En el recinto se mira un poco hacia donde camina el personaje.
      const ahead = showMinimap ? DELTA[my.current.dir] : { x: 0, y: 0 };
      lookAhead.x += (ahead.x * 3 * T - lookAhead.x) * 0.04;
      lookAhead.y += (ahead.y * 3 * T - lookAhead.y) * 0.04;
      const halfW = v.w / 2 / v.zoom;
      const halfH = v.h / 2 / v.zoom;
      const clamp = (c: number, size: number, half: number) => (size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, c)));
      v.camX = clamp(f.x + lookAhead.x, W, halfW);
      v.camY = clamp(f.y - 24 + lookAhead.y, H, halfH);
    };

    let raf = 0;
    let last = performance.now();
    let lastPrompt: string | null = null;
    let nextChatter = performance.now() + 1500;
    let guidePath: Tile[] = [];
    let guideFrom = "";

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const p = live.current;
      const wall = Date.now();
      step(dt);

      // Los demás se acercan suavemente a la última posición que mandó el servidor.
      const visible: User[] = [];
      for (const u of p.users.values()) {
        if (u.id === p.me.id || !p.inScene(u)) continue;
        visible.push(u);
        let w = others.current.get(u.id);
        if (!w) {
          w = { x: u.x, y: u.y, dir: "down", walk: 0, moving: false };
          others.current.set(u.id, w);
        }
        const dx = u.x - w.x;
        const dy = u.y - w.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          w.x = u.x;
          w.y = u.y;
          w.moving = false;
        } else if (dist > 0.01) {
          const k = Math.min(1, (REMOTE_SPEED * dt) / dist);
          w.x += dx * k;
          w.y += dy * k;
          w.dir = dirFrom(dx, dy, w.dir);
          w.walk = (w.walk + dt * 3.2) % 1;
          w.moving = true;
        } else w.moving = false;
      }
      for (const id of others.current.keys()) if (!visible.some((u) => u.id === id)) others.current.delete(id);

      // La gente del pasillo comenta algo de vez en cuando, si está cerca de ti.
      if (map.crowd.length && t > nextChatter) {
        const nearby = map.crowd.filter((c) => Math.hypot(c.x - my.current.x, c.y - my.current.y) < 12);
        const who = nearby[Math.floor(Math.random() * nearby.length)];
        if (who) bubbles.current.set(who.id, { text: CHATTER[Math.floor(Math.random() * CHATTER.length)]!, at: t - (BUBBLE_MS - CHATTER_MS) });
        nextChatter = t + 3500 + Math.random() * 3500;
      }

      const npc = p.onNpc ? nearbyNpc() : null;
      const directory = p.onDirectory ? nearbyDirectory() : null;
      const nextPrompt = npc ? `hablar con la ${npc.name.toLowerCase()}` : directory ? "ver cómo llegar a cada sala" : null;
      if (nextPrompt !== lastPrompt) {
        lastPrompt = nextPrompt;
        setPrompt(nextPrompt);
      }

      updateCamera();
      const v = view.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#1d1b26";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const z = v.zoom * dpr;
      ctx.setTransform(z, 0, 0, z, Math.round((v.w / 2 - v.camX * v.zoom) * dpr), Math.round((v.h / 2 - v.camY * v.zoom) * dpr));
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(backdrop, 0, 0, W, H);
      drawAnimatedDecor(ctx, map, t);
      drawSponsorScreens(ctx, map, p.media ?? { sponsors: [], title: "" }, wall);
      if (p.screen) drawScreenContent(ctx, map, p.screen.color, p.screen.title, p.screen.live);

      // Camino guiado: cuadros en el suelo hasta la sala elegida en el directorio.
      if (guideTo.current) {
        const h0 = here();
        const key = `${h0.x},${h0.y}`;
        if (key !== guideFrom) {
          guideFrom = key;
          guidePath = findPath(map, h0, guideTo.current) ?? [];
        }
        if (sameTile(h0, guideTo.current)) guideTo.current = null;
        const pulse = Math.floor(wall / 120) % 6;
        guidePath.forEach((stepTile, i) => {
          ctx.fillStyle = i % 6 === pulse ? "#ff5c39" : "rgba(255, 92, 57, 0.45)";
          ctx.fillRect(stepTile.x * T + 12, stepTile.y * T + 12, 8, 8);
        });
      }

      // Camino que va a recorrer el personaje al hacer clic.
      const s0 = my.current;
      if (s0.path.length) {
        ctx.fillStyle = "rgba(47, 107, 255, 0.5)";
        for (const stepTile of s0.path) ctx.fillRect(stepTile.x * T + 13, stepTile.y * T + 13, 6, 6);
        const goal = s0.path[s0.path.length - 1]!;
        ctx.strokeStyle = "rgba(47, 107, 255, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(goal.x * T + 4, goal.y * T + 4, T - 8, T - 8);
      }

      const h = hover.current;
      if (h.tile && !p.locked && isWalkable(map, h.tile.x, h.tile.y)) {
        ctx.strokeStyle = "rgba(29, 27, 38, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(h.tile.x * T + 1.5, h.tile.y * T + 1.5, T - 3, T - 3);
      }

      const items: Drawable[] = [...furni];
      const labels: { x: number; y: number; name: string; mine: boolean; sitting: boolean; id: string; tag: boolean }[] = [];
      const addAvatar = (id: string, name: string, look: Look, w: Walker, mine: boolean, tag: boolean, fixedDir?: Dir) => {
        const pose = poseFor(w, fixedDir);
        const f = feet(w.x, w.y);
        items.push({ key: w.y + 0.82, draw: (g) => drawAvatar(g, look, f.x, f.y, pose) });
        labels.push({ x: f.x, y: f.y, name, mine, sitting: pose.sitting, id, tag });
      };
      for (const n of map.npcs) addAvatar(n.id, n.name, n.look, { x: n.x, y: n.y, dir: n.dir, walk: 0, moving: false }, false, false, n.dir);
      for (const c of map.crowd) addAvatar(c.id, c.name, c.look, { x: c.x, y: c.y, dir: c.dir, walk: 0, moving: false }, false, false, c.dir);
      for (const u of visible) addAvatar(u.id, u.name, u.look, others.current.get(u.id)!, false, true);
      addAvatar(p.me.id, p.me.name, p.me.look, my.current, true, true);
      items.sort((a, b) => a.key - b.key);
      for (const it of items) it.draw(ctx, wall);

      drawPlaques(ctx, map, p.doorStatus ?? null, h.door, wall);

      for (const l of labels) {
        if ((p.names === "all" && l.tag) || l.mine || h.user === l.id || h.npc === l.id) {
          drawName(ctx, l.x, l.y - avatarHeight(l.sitting) - 8, l.mine ? `${l.name} (tú)` : l.name, l.mine);
        }
      }
      // Marcadores sobre lo que se puede usar: la recepcionista y los directorios.
      const markers = [
        ...map.npcs.map((n) => ({ x: n.x, y: n.y, h: avatarHeight(false) + 26, text: "!" })),
        ...map.directories.map((d) => ({ ...d, h: 66, text: "?" })),
      ];
      for (const m of markers) {
        const f = feet(m.x, m.y);
        const bob = Math.round(Math.sin(t / 260) * 2);
        const y = f.y - m.h + bob;
        ctx.fillStyle = "#16161d";
        ctx.fillRect(f.x - 9, y - 9, 18, 18);
        ctx.fillStyle = "#ff5c39";
        ctx.fillRect(f.x - 7, y - 7, 14, 14);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 11px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(m.text, f.x, y + 4);
        ctx.textAlign = "left";
      }

      const now = performance.now();
      for (const l of labels) {
        const e = emotes.current.get(l.id);
        if (!e) continue;
        const age = now - e.at;
        if (age > EMOTE_MS) {
          emotes.current.delete(l.id);
          continue;
        }
        const rise = Math.min(1, age / 250);
        ctx.save();
        ctx.globalAlpha = age > EMOTE_MS - 400 ? (EMOTE_MS - age) / 400 : 1;
        ctx.font = "20px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.emoji, l.x + 16, l.y - avatarHeight(l.sitting) - 6 - rise * 10);
        ctx.restore();
      }
      for (const l of labels) {
        const b = bubbles.current.get(l.id);
        if (!b) continue;
        const age = now - b.at;
        if (age > BUBBLE_MS) {
          bubbles.current.delete(l.id);
          continue;
        }
        const alpha = age > BUBBLE_MS - 1000 ? (BUBBLE_MS - age) / 1000 : 1;
        drawBubble(ctx, l.x, l.y - avatarHeight(l.sitting) - 20, l.name, b.text, alpha);
      }

      if (miniCtx && mini) {
        const md = window.devicePixelRatio || 1;
        miniCtx.setTransform(md, 0, 0, md, 0, 0);
        miniCtx.imageSmoothingEnabled = true;
        miniCtx.drawImage(backdrop, 0, 0, MINI_W, H * miniScale);
        for (const d of map.doors) {
          miniCtx.fillStyle = d.color;
          miniCtx.fillRect(d.x * T * miniScale - 1, d.y * T * miniScale - 1, d.w * T * miniScale + 2, 5);
        }
        if (guideTo.current) {
          miniCtx.fillStyle = "#ff5c39";
          miniCtx.fillRect(guideTo.current.x * T * miniScale - 3, guideTo.current.y * T * miniScale - 3, 6, 6);
        }
        for (const o of others.current.values()) {
          miniCtx.fillStyle = "#ffffff";
          miniCtx.fillRect((o.x + 0.5) * T * miniScale - 1.5, (o.y + 0.5) * T * miniScale - 1.5, 3, 3);
        }
        miniCtx.fillStyle = "#16161d";
        miniCtx.fillRect((my.current.x + 0.5) * T * miniScale - 4, (my.current.y + 0.5) * T * miniScale - 4, 8, 8);
        miniCtx.fillStyle = "#ffb703";
        miniCtx.fillRect((my.current.x + 0.5) * T * miniScale - 3, (my.current.y + 0.5) * T * miniScale - 3, 6, 6);
        // Recuadro de lo que se ve en pantalla.
        miniCtx.strokeStyle = "rgba(255,255,255,0.85)";
        miniCtx.lineWidth = 1;
        miniCtx.strokeRect((v.camX - v.w / 2 / v.zoom) * miniScale, (v.camY - v.h / 2 / v.zoom) * miniScale, (v.w / v.zoom) * miniScale, (v.h / v.zoom) * miniScale);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);

  const toWorld = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const v = view.current;
    return { x: (e.clientX - rect.left - v.w / 2) / v.zoom + v.camX, y: (e.clientY - rect.top - v.h / 2) / v.zoom + v.camY };
  };

  const hitAvatar = (wx: number, wy: number, x: number, y: number) => {
    const f = feet(x, y);
    return Math.abs(wx - f.x) < 12 && wy > f.y - avatarHeight(false) && wy < f.y + 4;
  };

  // Puertas y objetos se pueden clickear en todo su dibujo, no solo en la baldosa pisable.
  const spanHit = (s: Span, wx: number, wy: number) => {
    const tiles = spanTiles(s);
    const x0 = tiles[0]!.x * T;
    const x1 = (tiles[tiles.length - 1]!.x + 1) * T;
    if (wx < x0 || wx >= x1) return false;
    return s.side === "top" ? wy >= (s.y - 1) * T && wy < (s.y + 1) * T : wy >= (s.y - 0.5) * T && wy < (s.y + 1) * T;
  };
  const hitDoor = (wx: number, wy: number) => map.doors.find((d) => spanHit(d, wx, wy));
  const hitDirectory = (wx: number, wy: number) =>
    map.directories.find((d) => wx >= d.x * T && wx < (d.x + 1) * T && wy >= (d.y - 1.2) * T && wy < (d.y + 1) * T);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const w = toWorld(e);
    const h = hover.current;
    h.tile = screenToTile(w.x, w.y);
    h.npc = map.npcs.find((n) => hitAvatar(w.x, w.y, n.x, n.y))?.id ?? null;
    h.user = null;
    for (const [id, o] of others.current) if (hitAvatar(w.x, w.y, o.x, o.y)) h.user = id;
    h.door = hitDoor(w.x, w.y)?.id ?? null;
    e.currentTarget.style.cursor = h.npc || h.door || hitDirectory(w.x, w.y) ? "pointer" : "default";
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = live.current;
    if (p.locked) return;
    keys.current = [];
    const w = toWorld(e);
    const npc = map.npcs.find((n) => hitAvatar(w.x, w.y, n.x, n.y));
    if (npc) {
      const talk = () => p.onNpc?.(npc);
      if (nearbyNpc()?.id === npc.id) return talk();
      const spots = map.desk
        .filter((t) => isWalkable(map, t.x, t.y))
        .sort((a, b) => Math.hypot(a.x - my.current.x, a.y - my.current.y) - Math.hypot(b.x - my.current.x, b.y - my.current.y));
      for (const spot of spots) if (walkTo(spot, talk)) return;
      return;
    }
    const directory = hitDirectory(w.x, w.y);
    if (directory) {
      const open = () => p.onDirectory?.();
      if (near(directory, here()) && !my.current.seg) return open();
      for (const spot of besideTile(directory)) if (walkTo(spot, open)) return;
      return;
    }
    const door = hitDoor(w.x, w.y);
    if (door) {
      walkTo({ x: door.x, y: door.y });
      return;
    }
    const tile = screenToTile(w.x, w.y);
    if (isWalkable(map, tile.x, tile.y)) walkTo(tile);
  };

  return (
    <div className="scene" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onClick={onClick}
        onMouseMove={onMove}
        onMouseLeave={() => (hover.current = { tile: null, user: null, npc: null, door: null })}
        aria-label={props.label}
      />
      {showMinimap && <canvas ref={miniRef} className="minimap" aria-label="Minimapa del recinto" />}
      {prompt && (
        <p className="scene-prompt">
          <kbd>X</kbd> {prompt}
        </p>
      )}
    </div>
  );
}
