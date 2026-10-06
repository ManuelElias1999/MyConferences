import { useEffect, useRef } from "react";
import type { EventInfo, Rect, User } from "../../shared/types.ts";
import type { Session } from "./App.tsx";
import { formatTime, initials, minutesUntil, roomSchedule, socket } from "./lib.ts";

const RADIUS = 14;
const SPEED = 260; // px por segundo
const SEND_EVERY = 66; // ms entre envíos de posición (~15 por segundo)

const RECEPTION: Rect = { x: 500, y: 560, w: 400, h: 300 };
const NETWORKING: Rect = { x: 960, y: 540, w: 400, h: 320 };

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

const inside = (r: Rect, x: number, y: number, pad = 0) =>
  x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

function circleHitsRect(cx: number, cy: number, radius: number, r: Rect) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < radius ** 2;
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, "")}…`;
  }
  return lines;
}

function drawZone(ctx: CanvasRenderingContext2D, r: Rect, title: string, subtitle: string, c: Theme) {
  roundRect(ctx, r, 18);
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = c.wall;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = c.muted;
  ctx.font = "600 20px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, r.x + r.w / 2, r.y + 44);
  ctx.font = "14px Inter, system-ui, sans-serif";
  ctx.fillText(subtitle, r.x + r.w / 2, r.y + 68);
  ctx.textAlign = "left";
}

function drawAvatar(ctx: CanvasRenderingContext2D, u: { name: string; color: string }, x: number, y: number, isMe: boolean, c: Theme) {
  ctx.beginPath();
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = u.color;
  ctx.fill();
  ctx.lineWidth = isMe ? 3 : 2;
  ctx.strokeStyle = isMe ? c.text : c.surface;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "700 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials(u.name), x, y + 0.5);
  ctx.textBaseline = "alphabetic";

  const label = isMe ? `${u.name} (tú)` : u.name;
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  const w = ctx.measureText(label).width + 12;
  ctx.fillStyle = c.labelBg;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y + RADIUS + 5, w, 18, 9);
  ctx.fill();
  ctx.fillStyle = c.labelText;
  ctx.fillText(label, x, y + RADIUS + 18);
  ctx.textAlign = "left";
}

interface Theme {
  floor: string;
  grid: string;
  wall: string;
  text: string;
  muted: string;
  surface: string;
  labelBg: string;
  labelText: string;
  live: string;
}

function readTheme(el: Element): Theme {
  const s = getComputedStyle(el);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    floor: v("--map-floor"),
    grid: v("--map-grid"),
    wall: v("--map-wall"),
    text: v("--text"),
    muted: v("--muted"),
    surface: v("--surface"),
    labelBg: v("--map-label-bg"),
    labelText: v("--map-label-text"),
    live: v("--live"),
  };
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  event: EventInfo,
  users: Map<string, User>,
  me: User,
  pos: { x: number; y: number },
  now: number,
  c: Theme,
) {
  const { width: W, height: H } = event.map;
  ctx.fillStyle = c.floor;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  drawZone(ctx, RECEPTION, "Recepción", "Muévete con las flechas, WASD o haciendo clic", c);
  drawZone(ctx, NETWORKING, "Networking y stands", "Próximamente", c);

  const counts = new Map<string, number>();
  for (const u of users.values()) if (u.roomId) counts.set(u.roomId, (counts.get(u.roomId) ?? 0) + 1);

  for (const room of event.rooms) {
    const { area, door } = room;
    const { current, next } = roomSchedule(event, room.id, now);
    roundRect(ctx, area, 18);
    ctx.fillStyle = `${room.color}22`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = room.color;
    ctx.stroke();

    const pad = 22;
    let y = area.y + 40;
    ctx.fillStyle = c.text;
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.fillText(room.name, area.x + pad, y);
    y += 22;
    ctx.fillStyle = c.muted;
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillText(room.topic, area.x + pad, y);
    y += 40;

    if (current) {
      ctx.fillStyle = c.live;
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.fillText("● EN VIVO", area.x + pad, y);
      y += 24;
      ctx.fillStyle = c.text;
      ctx.font = "600 17px Inter, system-ui, sans-serif";
      for (const line of wrapText(ctx, current.title, area.w - pad * 2, 2)) {
        ctx.fillText(line, area.x + pad, y);
        y += 22;
      }
      ctx.fillStyle = c.muted;
      ctx.font = "14px Inter, system-ui, sans-serif";
      ctx.fillText(current.speaker, area.x + pad, y);
    } else if (next) {
      ctx.fillStyle = c.muted;
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillText(`PRÓXIMA · ${formatTime(next.start)}`, area.x + pad, y);
      y += 24;
      ctx.fillStyle = c.text;
      ctx.font = "600 17px Inter, system-ui, sans-serif";
      for (const line of wrapText(ctx, next.title, area.w - pad * 2, 2)) {
        ctx.fillText(line, area.x + pad, y);
        y += 22;
      }
    }

    const n = counts.get(room.id) ?? 0;
    ctx.fillStyle = c.muted;
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText(`${n} ${n === 1 ? "persona" : "personas"} dentro`, area.x + pad, area.y + area.h - 20);

    ctx.fillStyle = room.color;
    ctx.beginPath();
    ctx.roundRect(door.x, door.y, door.w, door.h, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ENTRAR", door.x + door.w / 2, door.y + door.h / 2 + 4);
    ctx.textAlign = "left";
  }

  for (const u of users.values()) {
    if (u.id === me.id || u.roomId) continue;
    drawAvatar(ctx, u, u.x, u.y, false, c);
  }
  drawAvatar(ctx, me, pos.x, pos.y, true, c);
}

export default function Hall({
  session,
  users,
  usersVersion,
  now,
  onEnterRoom,
  onOpenAgenda,
}: {
  session: Session;
  users: Map<string, User>;
  usersVersion: number;
  now: number;
  onEnterRoom: (roomId: string) => void;
  onOpenAgenda: () => void;
}) {
  const { me, event } = session;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: me.x, y: me.y });
  const target = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const live = useRef({ now, onEnterRoom, scale: 1 });
  live.current.now = now;
  live.current.onEnterRoom = onEnterRoom;

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const keyName = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey) return;
      const k = keyName(e);
      if (MOVE_KEYS[k]) {
        e.preventDefault();
        keys.current.add(k);
        target.current = null;
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(keyName(e));
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const { width: W, height: H } = event.map;

    const resize = () => {
      const scale = Math.min(wrap.clientWidth / W, wrap.clientHeight / H);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      live.current.scale = scale;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const blocked = (x: number, y: number) => event.rooms.some((r) => circleHitsRect(x, y, RADIUS, r.area));

    let raf = 0;
    let last = performance.now();
    let lastSent = 0;
    let dirty = false;
    let entering = false;

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const p = pos.current;

      let dx = 0;
      let dy = 0;
      for (const k of keys.current) {
        const [kx, ky] = MOVE_KEYS[k] ?? [0, 0];
        dx += kx;
        dy += ky;
      }
      if (!dx && !dy && target.current) {
        dx = target.current.x - p.x;
        dy = target.current.y - p.y;
        if (Math.hypot(dx, dy) < 4) {
          target.current = null;
          dx = dy = 0;
        }
      }
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const step = SPEED * dt;
        const nx = Math.max(RADIUS, Math.min(W - RADIUS, p.x + (dx / len) * step));
        const ny = Math.max(RADIUS, Math.min(H - RADIUS, p.y + (dy / len) * step));
        // Se resuelve cada eje por separado para poder deslizarse junto a las paredes.
        if (!blocked(nx, p.y)) p.x = nx;
        if (!blocked(p.x, ny)) p.y = ny;
        dirty = true;
      }
      if (dirty && t - lastSent > SEND_EVERY) {
        socket.emit("move", { x: p.x, y: p.y });
        lastSent = t;
        dirty = false;
      }

      if (!entering) {
        const room = event.rooms.find((r) => circleHitsRect(p.x, p.y, RADIUS, r.door));
        if (room) {
          entering = true;
          keys.current.clear();
          target.current = null;
          live.current.onEnterRoom(room.id);
        }
      }

      drawMap(ctx, event, users, me, p, live.current.now, readTheme(canvas));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [event, users, me]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = live.current.scale;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const room = event.rooms.find((r) => inside(r.area, x, y) || inside(r.door, x, y));
    if (room) return onEnterRoom(room.id);
    target.current = { x, y };
  };

  // Lista lateral: se recalcula cuando alguien entra, sale o cambia de sala.
  void usersVersion;
  const everyone = [...users.values()];
  const live_ = event.rooms
    .map((room) => ({ room, ...roomSchedule(event, room.id, now), count: everyone.filter((u) => u.roomId === room.id).length }))
    .filter((r) => r.current);
  const upcoming = event.talks
    .filter((t) => t.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);
  const roomById = new Map(event.rooms.map((r) => [r.id, r]));

  return (
    <main className="hall">
      <div className="map-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} onClick={onCanvasClick} aria-label="Mapa del salón principal" />
      </div>

      <aside className="side">
        <section>
          <h2 className="side-title">
            <span className="dot" /> En vivo ahora
          </h2>
          {live_.length === 0 && <p className="muted">No hay charlas en curso.</p>}
          <ul className="live-list">
            {live_.map(({ room, current, count }) => (
              <li key={room.id} className="live-card" style={{ "--room": room.color } as React.CSSProperties}>
                <div>
                  <p className="live-room">{room.name}</p>
                  <p className="live-title">{current!.title}</p>
                  <p className="muted small">
                    {current!.speaker} · {count} {count === 1 ? "persona" : "personas"}
                  </p>
                </div>
                <button className="btn sm" onClick={() => onEnterRoom(room.id)}>
                  Entrar
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="side-title">A continuación</h2>
          <ul className="upcoming-list">
            {upcoming.map((t) => (
              <li key={t.id}>
                <span className="upcoming-time">{formatTime(t.start)}</span>
                <div>
                  <p>{t.title}</p>
                  <p className="muted small">
                    {roomById.get(t.roomId)?.name} · {minutesUntil(t.start, now)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button className="link" onClick={onOpenAgenda}>
            Ver agenda completa
          </button>
        </section>

        <section>
          <h2 className="side-title">Personas en el evento ({everyone.length})</h2>
          <ul className="people-list">
            {everyone.map((u) => (
              <li key={u.id}>
                <span className="avatar sm" style={{ background: u.color }}>
                  {initials(u.name)}
                </span>
                <div>
                  <p>
                    {u.name}
                    {u.id === me.id && <span className="muted"> (tú)</span>}
                  </p>
                  <p className="muted small">{u.roomId ? roomById.get(u.roomId)?.name : "Salón principal"}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </main>
  );
}
