import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { isWalkable, onSpan, sameTile, spanTiles, type Dir, type Door, type Npc, type SceneMap, type Span, type Tile } from "../../shared/maps.ts";
import type { Bubble, Look, User } from "../../shared/types.ts";
import { avatarHeight, drawAvatar } from "./avatar.ts";
import { socket } from "./lib.ts";
import {
  drawAnimatedDecor,
  drawBubble,
  drawName,
  drawPlaques,
  drawScreenContent,
  drawSigns,
  feet,
  findPath,
  furniDrawables,
  renderStatic,
  screenToTile,
  T,
  type DoorStatus,
  type Drawable,
} from "./world.ts";

const SPEED = 4.6; // baldosas por segundo
const REMOTE_SPEED = 5;
const BUBBLE_MS = 7000;

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

const dirFrom = (dx: number, dy: number, fallback: Dir): Dir =>
  Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3 ? fallback : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

export interface SceneHandle {
  /** Camina hasta la baldosa y luego llama a `then`. Devuelve false si no hay camino. */
  walkTo: (tile: Tile, then?: () => void) => boolean;
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
  locked?: boolean;
  onDoor?: (door: Door) => void;
  onExit?: () => void;
  onStairs?: (floor: number) => void;
  onNpc?: (npc: Npc) => void;
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

export default function Scene(props: SceneProps) {
  const { map, me, handle } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const [prompt, setPrompt] = useState<string | null>(null);

  const my = useRef<MyState>({ x: me.x, y: me.y, dir: "down", walk: 0, moving: false, seg: null, path: [], then: null });
  const others = useRef(new Map<string, Walker>());
  const bubbles = useRef(new Map<string, { text: string; at: number }>());
  const keys = useRef<Dir[]>([]);
  const view = useRef({ zoom: 1, camX: 0, camY: 0, w: 0, h: 0 });
  const hover = useRef<{ tile: Tile | null; user: string | null; npc: string | null; door: string | null }>({
    tile: null,
    user: null,
    npc: null,
    door: null,
  });

  const walkTo = (tile: Tile, then?: () => void) => {
    const s = my.current;
    const from = s.seg ? s.seg.to : { x: Math.round(s.x), y: Math.round(s.y) };
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
    const s = my.current;
    if (s.seg) return null;
    const here = { x: Math.round(s.x), y: Math.round(s.y) };
    return (
      map.npcs.find((n) => map.desk.some((t) => sameTile(here, t)) || Math.abs(n.x - here.x) + Math.abs(n.y - here.y) === 1) ?? null
    );
  };

  useImperativeHandle(handle, () => ({
    walkTo,
    bubble: (userId, text) => bubbles.current.set(userId, { text, at: performance.now() }),
  }));

  useEffect(() => {
    const onBubble = (b: Bubble) => bubbles.current.set(b.userId, { text: b.text, at: performance.now() });
    socket.on("bubble", onBubble);
    return () => {
      socket.off("bubble", onBubble);
    };
  }, []);

  // Teclado: flechas o WASD para caminar, X para hablar.
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
      } else if (k === "x") {
        const npc = nearbyNpc();
        if (npc) live.current.onNpc?.(npc);
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
    const STATIC_SCALE = 2;
    const backdrop = renderStatic(map, STATIC_SCALE);
    const furni = furniDrawables(map);

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
      const stairs = intended && p.onStairs && map.stairs.find((st) => onSpan(to, st));
      if (door || exit || stairs) {
        s.path = [];
        s.then = null;
        keys.current = [];
        s.moving = false;
        if (door) p.onDoor!(door);
        else if (stairs) p.onStairs!(stairs.to);
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

    const updateCamera = () => {
      const v = view.current;
      const W = map.w * T;
      const H = map.h * T;
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
      // Si el mapa entero cabe con un zoom razonable se muestra completo, como en Gather.
      v.zoom = Math.max(1, Math.min(2, v.h / H, v.w / W));
      const f = feet(my.current.x, my.current.y);
      const halfW = v.w / 2 / v.zoom;
      const halfH = v.h / 2 / v.zoom;
      const clamp = (c: number, size: number, half: number) => (size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, c)));
      v.camX = clamp(f.x, W, halfW);
      // Se encuadra un poco más arriba del personaje para ver el muro y sus puertas.
      v.camY = clamp(f.y - 48, H, halfH);
    };

    let raf = 0;
    let last = performance.now();
    let lastPrompt: string | null = null;
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const p = live.current;
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

      const npc = p.onNpc ? nearbyNpc() : null;
      const nextPrompt = npc ? `Pulsa X para hablar con la ${npc.name.toLowerCase()}` : null;
      if (nextPrompt !== lastPrompt) {
        lastPrompt = nextPrompt;
        setPrompt(nextPrompt);
      }

      updateCamera();
      const v = view.current;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#dfe4ec";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const z = v.zoom * dpr;
      ctx.setTransform(z, 0, 0, z, Math.round((v.w / 2 - v.camX * v.zoom) * dpr), Math.round((v.h / 2 - v.camY * v.zoom) * dpr));
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(backdrop, 0, 0, map.w * T, map.h * T);
      drawAnimatedDecor(ctx, map, t);
      drawSigns(ctx, map);
      if (p.screen) drawScreenContent(ctx, map, p.screen.color, p.screen.title, p.screen.live);

      const h = hover.current;
      if (h.tile && !p.locked && isWalkable(map, h.tile.x, h.tile.y)) {
        ctx.strokeStyle = "rgba(79, 70, 229, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(h.tile.x * T + 1.5, h.tile.y * T + 1.5, T - 3, T - 3);
      }

      const items: Drawable[] = [...furni];
      const labels: { x: number; y: number; name: string; mine: boolean; sitting: boolean; id: string }[] = [];
      const addAvatar = (id: string, name: string, look: Look, w: Walker, mine: boolean, fixedDir?: Dir) => {
        const pose = poseFor(w, fixedDir);
        const f = feet(w.x, w.y);
        items.push({ key: w.y + 0.82, draw: (g) => drawAvatar(g, look, f.x, f.y, pose) });
        labels.push({ x: f.x, y: f.y, name, mine, sitting: pose.sitting, id });
      };
      for (const n of map.npcs) addAvatar(n.id, n.name, n.look, { x: n.x, y: n.y, dir: n.dir, walk: 0, moving: false }, false, n.dir);
      for (const u of visible) addAvatar(u.id, u.name, u.look, others.current.get(u.id)!, false);
      addAvatar(p.me.id, p.me.name, p.me.look, my.current, true);
      items.sort((a, b) => a.key - b.key);
      for (const it of items) it.draw(ctx, t);

      drawPlaques(ctx, map, p.doorStatus ?? null, h.door);

      for (const l of labels) {
        if (p.names === "all" || l.mine || h.user === l.id || h.npc === l.id || map.npcs.some((n) => n.id === l.id)) {
          drawName(ctx, l.x, l.y - avatarHeight(l.sitting) - 8, l.mine ? `${l.name} (tú)` : l.name, l.mine);
        }
      }
      // Signo de exclamación sobre la recepcionista, como los objetos interactivos de Gather.
      for (const n of map.npcs) {
        const f = feet(n.x, n.y);
        const bob = Math.round(Math.sin(t / 260) * 2);
        const y = f.y - avatarHeight(false) - 34 + bob;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(f.x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#06c38d";
        ctx.beginPath();
        ctx.arc(f.x, y, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", f.x, y + 4);
        ctx.textAlign = "left";
      }

      const now = performance.now();
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

  // Las puertas y escaleras se pueden clickear en todo su dibujo, no solo en la baldosa pisable.
  const spanHit = (s: Span, wx: number, wy: number) => {
    const tiles = spanTiles(s);
    const x0 = tiles[0]!.x * T;
    const y0 = tiles[0]!.y * T;
    const x1 = (tiles[tiles.length - 1]!.x + 1) * T;
    const y1 = (tiles[tiles.length - 1]!.y + 1) * T;
    if (s.side === "top") return wx >= x0 && wx < x1 && wy >= 0 && wy < 3 * T;
    if (s.side === "bottom") return wx >= x0 && wx < x1 && wy >= y0 - T / 2;
    return wy >= y0 && wy < y1 && (s.side === "left" ? wx < x1 + T / 2 : wx >= x0 - T / 2);
  };
  const hitDoor = (wx: number, wy: number) => map.doors.find((d) => spanHit(d, wx, wy));
  const hitStairs = (wx: number, wy: number) => map.stairs.find((st) => spanHit(st, wx, wy));

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const w = toWorld(e);
    const h = hover.current;
    h.tile = screenToTile(w.x, w.y);
    h.npc = map.npcs.find((n) => hitAvatar(w.x, w.y, n.x, n.y))?.id ?? null;
    h.user = null;
    for (const [id, o] of others.current) if (hitAvatar(w.x, w.y, o.x, o.y)) h.user = id;
    h.door = hitDoor(w.x, w.y)?.id ?? null;
    e.currentTarget.style.cursor = h.npc || h.door || hitStairs(w.x, w.y) ? "pointer" : "default";
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
      const s = my.current;
      const spots = map.desk
        .filter((t) => isWalkable(map, t.x, t.y))
        .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
      for (const spot of spots) if (walkTo(spot, talk)) return;
      return;
    }
    const target = hitDoor(w.x, w.y) ?? hitStairs(w.x, w.y);
    if (target) {
      walkTo({ x: target.x, y: target.y });
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
      {prompt && (
        <p className="scene-prompt">
          <kbd>X</kbd> {prompt.replace(/^Pulsa X para /, "")}
        </p>
      )}
    </div>
  );
}
