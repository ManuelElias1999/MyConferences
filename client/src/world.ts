// Dibujo de los mapas vistos desde arriba, al estilo Gather: pisos y muros según el
// estilo de cada lugar, adornos, puertas, escaleras, muebles y la búsqueda de caminos.

import {
  isWalkable,
  spanTiles,
  type Decor,
  type Door,
  type Furni,
  type SceneMap,
  type Span,
  type Stairs,
  type StyleId,
  type Tile,
} from "../../shared/maps.ts";
import type { ThemeId } from "../../shared/themes.ts";
import { shade } from "./avatar.ts";

export const T = 32;
const FONT = '"DM Sans", Inter, ui-sans-serif, system-ui, sans-serif';
const LINE = "rgba(30, 30, 45, 0.55)";

/** Número pseudoaleatorio estable por posición, para variar tablas y piedras sin parpadeos. */
function hash(x: number, y: number, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const pick = <V>(list: V[], r: number) => list[Math.floor(r * list.length) % list.length]!;

/** Pies del personaje en coordenadas del mundo. */
export const feet = (x: number, y: number) => ({ x: (x + 0.5) * T, y: (y + 0.82) * T });

export const screenToTile = (wx: number, wy: number): Tile => ({ x: Math.floor(wx / T), y: Math.floor(wy / T) });

// ---------- Caminos ----------

/** A* en 4 direcciones. Devuelve las baldosas a recorrer (sin la inicial). */
export function findPath(map: SceneMap, from: Tile, to: Tile): Tile[] | null {
  if (!isWalkable(map, to.x, to.y)) return null;
  const key = (x: number, y: number) => y * map.w + x;
  const start = key(from.x, from.y);
  const goal = key(to.x, to.y);
  if (start === goal) return [];
  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open = new Set<number>([start]);
  const h = (k: number) => Math.abs((k % map.w) - to.x) + Math.abs(Math.floor(k / map.w) - to.y);
  while (open.size) {
    let current = -1;
    let best = Infinity;
    for (const k of open) {
      const f = g.get(k)! + h(k);
      if (f < best) {
        best = f;
        current = k;
      }
    }
    if (current === goal) {
      const path: Tile[] = [];
      for (let k = goal; k !== start; k = came.get(k)!) path.unshift({ x: k % map.w, y: Math.floor(k / map.w) });
      return path;
    }
    open.delete(current);
    const cx = current % map.w;
    const cy = Math.floor(current / map.w);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(map, nx, ny)) continue;
      const k = key(nx, ny);
      const cost = g.get(current)! + 1;
      if (cost < (g.get(k) ?? Infinity)) {
        g.set(k, cost);
        came.set(k, current);
        open.add(k);
      }
    }
  }
  return null;
}

// ---------- Pisos ----------

type Painter = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => void;

const planks =
  (colors: string[], line = "rgba(80,50,20,0.35)"): Painter =>
  (ctx, x0, y0, x1, y1) => {
    for (let cy = y0; cy < y1; cy += 8) {
      let cx = x0 - Math.floor(hash(0, cy, 5) * 48);
      while (cx < x1) {
        const len = 40 + Math.floor(hash(cx, cy, 6) * 56);
        const sx = Math.max(cx, x0);
        const w = Math.min(cx + len, x1) - sx;
        ctx.fillStyle = pick(colors, hash(cx, cy, 7));
        ctx.fillRect(sx, cy, w, 8);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(sx, cy, w, 1);
        ctx.fillStyle = line;
        ctx.fillRect(sx, cy + 7, w, 1);
        if (cx >= x0) ctx.fillRect(cx, cy, 1, 8);
        cx += len;
      }
    }
  };

const tiles =
  (colors: string[], size: number, seam: string): Painter =>
  (ctx, x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y += size) {
      for (let x = x0; x < x1; x += size) {
        ctx.fillStyle = pick(colors, hash(x, y, 9));
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(x, y, size, 1);
        ctx.fillStyle = seam;
        ctx.fillRect(x, y + size - 1, size, 1);
        ctx.fillRect(x + size - 1, y, 1, size);
      }
    }
  };

const flagstones =
  (colors: string[]): Painter =>
  (ctx, x0, y0, x1, y1) => {
    for (let cy = y0; cy < y1; cy += 16) {
      const offset = (cy / 16) % 2 ? 16 : 0;
      for (let cx = x0 - offset; cx < x1; cx += 32) {
        const sx = Math.max(cx, x0);
        const w = Math.min(cx + 32, x1) - sx;
        ctx.fillStyle = pick(colors, hash(cx, cy, 3));
        ctx.fillRect(sx, cy, w, 16);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(sx, cy, w, 1);
        ctx.fillStyle = "rgba(60,55,70,0.35)";
        ctx.fillRect(sx, cy + 15, w, 1);
        if (cx >= x0) ctx.fillRect(cx, cy, 1, 16);
      }
    }
  };

const grass: Painter = (ctx, x0, y0, x1, y1) => {
  const greens = ["#8fd16a", "#89cb63", "#95d671", "#86c65f"];
  for (let y = y0; y < y1; y += 8) {
    for (let x = x0; x < x1; x += 8) {
      ctx.fillStyle = pick(greens, hash(x, y, 13));
      ctx.fillRect(x, y, 8, 8);
      const r = hash(y, x, 14);
      if (r > 0.86) {
        ctx.fillStyle = "#6fb24e";
        ctx.fillRect(x + 2, y + 3, 1, 3);
        ctx.fillRect(x + 4, y + 2, 1, 4);
      } else if (r > 0.83) {
        ctx.fillStyle = pick(["#fff7a8", "#ffffff", "#ffb3c7"], hash(x, y, 15));
        ctx.fillRect(x + 3, y + 3, 2, 2);
      }
    }
  }
};

// ---------- Muros ----------

type FacePainter = (ctx: CanvasRenderingContext2D, px: number, py: number, row: number) => void;

const plaster =
  (top: string, lower: string | null, rail: string): FacePainter =>
  (ctx, px, py, row) => {
    ctx.fillStyle = top;
    ctx.fillRect(px, py, T, T);
    if (row === 1 && lower) {
      ctx.fillStyle = lower;
      ctx.fillRect(px, py + 10, T, T - 10);
      ctx.fillStyle = rail;
      ctx.fillRect(px, py + 8, T, 3);
    }
  };

const bricks =
  (colors: string[], mortar: string, w = 16, h = 8): FacePainter =>
  (ctx, px, py, row) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(px, py, T, T);
    for (let r = 0; r < T / h; r++) {
      const by = py + r * h;
      const offset = (row * (T / h) + r) % 2 ? w / 2 : 0;
      for (let bx = px - offset; bx < px + T; bx += w) {
        const sx = Math.max(bx, px);
        const bw = Math.min(bx + w, px + T) - sx - 1;
        if (bw <= 0) continue;
        ctx.fillStyle = pick(colors, hash(bx, by, 11));
        ctx.fillRect(sx, by, bw, h - 1);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(sx, by, bw, 1);
      }
    }
  };

const panels: FacePainter = (ctx, px, py, row) => {
  ctx.fillStyle = "#e3e8f0";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "#cfd6e2";
  ctx.fillRect(px + T - 1, py, 1, T);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(px, py, 1, T);
  if (row === 0) {
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(px, py + 6, T, 2);
    ctx.fillStyle = "rgba(56,189,248,0.25)";
    ctx.fillRect(px, py + 8, T, 3);
  }
};

const logs: FacePainter = (ctx, px, py) => {
  const colors = ["#b07a46", "#a8713f", "#b8834f", "#a26b3b"];
  for (let r = 0; r < 4; r++) {
    const ly = py + r * 8;
    ctx.fillStyle = pick(colors, hash(px >> 6, ly, 17));
    ctx.fillRect(px, ly, T, 8);
    ctx.fillStyle = "rgba(255,230,190,0.25)";
    ctx.fillRect(px, ly + 1, T, 1);
    ctx.fillStyle = "#6e4526";
    ctx.fillRect(px, ly + 7, T, 1);
  }
};

const hedge: FacePainter = (ctx, px, py) => {
  ctx.fillStyle = "#4e9a45";
  ctx.fillRect(px, py, T, T);
  for (let i = 0; i < 9; i++) {
    const r = hash(px, py, i);
    ctx.fillStyle = r > 0.5 ? "#5fae53" : "#438b3b";
    ctx.beginPath();
    ctx.arc(px + hash(py, px, i) * T, py + r * T, 4 + r * 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

interface Style {
  floor: Painter;
  face: FacePainter;
  cap: string;
  base: string;
}

const STYLES: Record<StyleId, Style> = {
  cowork: { floor: planks(["#e2c49a", "#dcbd91", "#e6caa2", "#d8b88b"]), face: bricks(["#c96f52", "#bf654a", "#d0785a", "#c46a4e"], "#ead8c8"), cap: "#5d6170", base: "#8b5a44" },
  lobby: { floor: tiles(["#dfe5ee", "#dae1eb"], 32, "rgba(120,135,160,0.25)"), face: plaster("#f3f5f9", "#c9d6ea", "#ffffff"), cap: "#6f7890", base: "#9fb0cc" },
  tech: { floor: tiles(["#e4e9f1", "#dfe5ee"], 32, "rgba(56,189,248,0.35)"), face: panels, cap: "#475569", base: "#38bdf8" },
  minimal: { floor: planks(["#efe3cf", "#eadcc5", "#f2e8d6", "#e8d8bf"], "rgba(150,120,80,0.25)"), face: plaster("#f8f6f2", null, "#e9e4dc"), cap: "#bdb6aa", base: "#ddd5c8" },
  rustic: { floor: planks(["#a87445", "#b07c4b", "#9f6c3f", "#a9784a"]), face: logs, cap: "#6b4a2f", base: "#5a3a22" },
  medieval: { floor: flagstones(["#c9c4b8", "#c2bdb0", "#cfcabe", "#bdb8ab"]), face: bricks(["#b5b0bf", "#aca7b7", "#bbb6c5", "#a8a3b2"], "#8f8a9b"), cap: "#7a7486", base: "#6c6779" },
  garden: { floor: grass, face: hedge, cap: "#3f7d3a", base: "#356b30" },
};

const tileAt = (map: SceneMap, x: number, y: number) => map.tiles[y]?.[x] ?? "#";

function wallCap(ctx: CanvasRenderingContext2D, map: SceneMap, style: Style, x: number, y: number) {
  const px = x * T;
  const py = y * T;
  ctx.fillStyle = style.cap;
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = shade(style.cap, 0.08);
  ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
  const open = (c: string) => c !== "#";
  ctx.fillStyle = shade(style.cap, -0.25);
  if (open(tileAt(map, x, y + 1))) ctx.fillRect(px, py + T - 3, T, 3);
  if (open(tileAt(map, x + 1, y))) ctx.fillRect(px + T - 3, py, 3, T);
  if (open(tileAt(map, x - 1, y))) ctx.fillRect(px, py, 3, T);
}

// ---------- Adornos del muro ----------

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = LINE;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function windowDecor(ctx: CanvasRenderingContext2D, d: Decor, style: StyleId) {
  const x = d.x * T + 4;
  const w = (d.w ?? 1) * T - 8;
  const y = T + 4;
  const h = 2 * T - 14;
  if (style === "medieval") {
    // Vitral.
    const panes = ["#5b8def", "#e5566a", "#f1c84b", "#5cc28a", "#9a72e6"];
    frame(ctx, x, y, w, h, "#9a95a8");
    for (let py = y + 3; py < y + h - 3; py += 6) {
      for (let px = x + 3; px < x + w - 3; px += 6) {
        ctx.fillStyle = pick(panes, hash(px, py, 21));
        ctx.fillRect(px, py, 5, 5);
      }
    }
    return;
  }
  const frameColor = style === "rustic" ? "#6e4526" : style === "cowork" ? "#2f3440" : "#ffffff";
  frame(ctx, x, y, w, h, frameColor);
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, "#7cc7f5");
  sky.addColorStop(1, "#cdeefe");
  ctx.fillStyle = sky;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(x + 8 + hash(d.x, 1) * (w - 30), y + 9, 14, 4);
  ctx.fillRect(x + 12 + hash(d.x, 1) * (w - 30), y + 6, 8, 4);
  if (style === "cowork" || style === "lobby" || style === "tech") {
    // Edificios de la ciudad.
    for (let bx = x + 3; bx < x + w - 3; bx += 7) {
      const bh = 10 + Math.floor(hash(bx, d.x, 22) * 18);
      ctx.fillStyle = pick(["#8aa4c8", "#7b97be", "#98b0d0"], hash(bx, 3));
      ctx.fillRect(bx, y + h - 3 - bh, 6, bh);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let wy = y + h - bh; wy < y + h - 6; wy += 4) ctx.fillRect(bx + 2, wy, 2, 1);
    }
  } else {
    ctx.fillStyle = "#7cc36a";
    ctx.fillRect(x + 3, y + h - 12, w - 6, 9);
  }
  ctx.fillStyle = frameColor;
  ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6);
  ctx.fillRect(x + 3, y + h / 2 - 1, w - 6, 2);
}

function neon(ctx: CanvasRenderingContext2D, d: Decor) {
  const cx = (d.x + (d.w ?? 1) / 2) * T;
  const color = d.color ?? "#22d3ee";
  const text = d.text ?? "";
  ctx.font = `700 ${text.length > 8 ? 20 : 24}px ${FONT}`;
  const width = Math.min((d.w ?? 1) * T - 8, ctx.measureText(text).width + 24);
  frame(ctx, cx - width / 2, T + 10, width, 40, "#1f2433");
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = shade(color, 0.55);
  ctx.textAlign = "center";
  ctx.fillText(text, cx, T + 38, width - 12);
  ctx.restore();
}

function art(ctx: CanvasRenderingContext2D, d: Decor) {
  const x = d.x * T + 6;
  const w = (d.w ?? 1) * T - 12;
  const y = T + 8;
  const h = 2 * T - 26;
  frame(ctx, x, y, w, h, "#3a3040");
  ctx.fillStyle = "#fbf6ec";
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  const c = d.color ?? "#ef476f";
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.5, Math.min(w, h) * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c, -0.3);
  ctx.fillRect(x + w * 0.5, y + h * 0.3, w * 0.3, h * 0.45);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x + w * 0.2, y + h * 0.7, w * 0.6, 3);
}

function whiteboard(ctx: CanvasRenderingContext2D, d: Decor) {
  const x = d.x * T + 4;
  const w = (d.w ?? 1) * T - 8;
  const y = T + 8;
  frame(ctx, x, y, w, 40, "#c8ced8");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 2, y + 2, w - 4, 34);
  const strokes: [string, number, number, number][] = [
    ["#3b82f6", 8, 10, 40],
    ["#ef4444", 8, 18, 28],
    ["#10b981", 8, 26, 50],
  ];
  for (const [color, sx, sy, len] of strokes) {
    ctx.fillStyle = color;
    ctx.fillRect(x + sx, y + sy, Math.min(len, w - 16), 2);
  }
  ctx.strokeStyle = "#8b5cf6";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w - 26, y + 8, 16, 14);
  ctx.fillStyle = "#9aa3b2";
  ctx.fillRect(x + 6, y + 40, w - 12, 3);
}

function clock(ctx: CanvasRenderingContext2D, d: Decor) {
  const cx = d.x * T + T / 2;
  const cy = T + 24;
  ctx.fillStyle = LINE;
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f2433";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 7);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 5, cy + 2);
  ctx.stroke();
}

function shelf(ctx: CanvasRenderingContext2D, d: Decor) {
  const x = d.x * T + 4;
  const w = (d.w ?? 1) * T - 8;
  for (const sy of [T + 22, 2 * T + 14]) {
    frame(ctx, x, sy, w, 4, "#8a5a32");
    for (let bx = x + 4; bx < x + w - 6; bx += 5) {
      if (hash(bx, sy, 31) > 0.75) continue;
      const bh = 8 + Math.floor(hash(sy, bx, 32) * 6);
      ctx.fillStyle = pick(["#ef476f", "#118ab2", "#ffd166", "#06d6a0", "#8b5cf6"], hash(bx, sy, 33));
      ctx.fillRect(bx, sy - bh, 4, bh);
    }
  }
}

function banner(ctx: CanvasRenderingContext2D, d: Decor) {
  const x = d.x * T;
  const top = T + 4;
  const color = d.color ?? "#9b2335";
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(x + 2, top, T - 4, 3);
  const l = x + 6;
  const r = x + T - 6;
  const bottom = top + 46;
  ctx.fillStyle = "#d4a73c";
  ctx.beginPath();
  ctx.moveTo(l - 1, top + 3);
  ctx.lineTo(r + 1, top + 3);
  ctx.lineTo(r + 1, bottom + 1);
  ctx.lineTo((l + r) / 2, bottom - 7);
  ctx.lineTo(l - 1, bottom + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(l + 1, top + 3);
  ctx.lineTo(r - 1, top + 3);
  ctx.lineTo(r - 1, bottom - 2);
  ctx.lineTo((l + r) / 2, bottom - 9);
  ctx.lineTo(l + 1, bottom - 2);
  ctx.closePath();
  ctx.fill();
  const cx = (l + r) / 2;
  ctx.fillStyle = "#f2d16b";
  ctx.fillRect(cx - 6, top + 20, 12, 5);
  ctx.fillRect(cx - 6, top + 16, 2, 4);
  ctx.fillRect(cx - 1, top + 14, 2, 6);
  ctx.fillRect(cx + 4, top + 16, 2, 4);
}

function fireplace(ctx: CanvasRenderingContext2D, d: Decor, style: StyleId) {
  const x = d.x * T;
  const w = (d.w ?? 2) * T;
  const stone = style === "rustic" ? ["#b9a58f", "#ad9a84", "#c3af98"] : ["#b5b0bf", "#aca7b7"];
  const masonry = bricks(stone, "#7d6f62", 12, 8);
  for (let bx = x; bx < x + w; bx += T) {
    masonry(ctx, bx, T + 8, 0);
    masonry(ctx, bx, 2 * T, 1);
  }
  ctx.fillStyle = "#6e4526";
  ctx.fillRect(x - 2, T + 6, w + 4, 6);
  const ox = x + 12;
  const ow = w - 24;
  ctx.fillStyle = "#2a1c18";
  ctx.beginPath();
  ctx.moveTo(ox, 3 * T);
  ctx.lineTo(ox, 2 * T + 6);
  ctx.quadraticCurveTo(ox + ow / 2, T + 22, ox + ow, 2 * T + 6);
  ctx.lineTo(ox + ow, 3 * T);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(ox + 6, 3 * T - 8, ow - 12, 5);
}

function ivy(ctx: CanvasRenderingContext2D, d: Decor) {
  for (let i = 0; i < (d.w ?? 1) * 3; i++) {
    const x = d.x * T + 6 + i * 10 + hash(i, d.x) * 4;
    const len = 20 + hash(d.x, i) * 30;
    for (let y = T; y < T + len; y += 5) {
      ctx.fillStyle = hash(x, y) > 0.5 ? "#2f7d32" : "#3f9a43";
      ctx.fillRect(x + Math.sin(y / 6) * 2, y, 5, 4);
    }
    if (hash(i, 9) > 0.5) {
      ctx.fillStyle = pick(["#ff8fab", "#ffd166", "#ffffff"], hash(i, d.x, 3));
      ctx.fillRect(x + 1, T + len - 3, 3, 3);
    }
  }
}

function entrance(ctx: CanvasRenderingContext2D, s: { x: number; y?: number; w?: number }) {
  const x = s.x * T;
  const y = (s.y ?? 0) * T;
  const w = (s.w ?? 2) * T;
  frame(ctx, x, y, w, T, "#3a3f4d");
  ctx.fillStyle = "#bfe6fb";
  ctx.fillRect(x + 3, y + 3, w / 2 - 4, T - 6);
  ctx.fillRect(x + w / 2 + 1, y + 3, w / 2 - 4, T - 6);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x + 6, y + 5, 3, T - 10);
  ctx.fillRect(x + w / 2 + 4, y + 5, 3, T - 10);
}

// ---------- Puertas y escaleras ----------

/** Puerta en el muro norte con el estilo de la sala a la que lleva. */
function topDoor(ctx: CanvasRenderingContext2D, door: Door) {
  const x = door.x * T + 3;
  const w = door.w * T - 6;
  const top = T + 4;
  const bottom = 3 * T;
  const h = bottom - top;
  switch (door.theme) {
    case "tech": {
      frame(ctx, x, top, w, h, "#334155");
      ctx.fillStyle = "#bde8fb";
      ctx.fillRect(x + 4, top + 8, w / 2 - 5, h - 8);
      ctx.fillRect(x + w / 2 + 1, top + 8, w / 2 - 5, h - 8);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(x + 8, top + 12, 3, h - 16);
      ctx.fillRect(x + w / 2 + 5, top + 12, 3, h - 16);
      ctx.fillStyle = door.color;
      ctx.fillRect(x + 4, top + 2, w - 8, 4);
      break;
    }
    case "minimal": {
      frame(ctx, x, top, w, h, "#d9d4cb");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 4, top + 4, w - 8, h - 4);
      ctx.fillStyle = "#e9e4dc";
      ctx.fillRect(x + w / 2 - 1, top + 4, 2, h - 4);
      ctx.fillStyle = door.color;
      ctx.beginPath();
      ctx.arc(x + w / 2 - 6, top + h / 2 + 4, 2.5, 0, Math.PI * 2);
      ctx.arc(x + w / 2 + 6, top + h / 2 + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "rustic": {
      frame(ctx, x, top, w, h, "#6e4526");
      for (let px = x + 4; px < x + w - 4; px += 6) {
        ctx.fillStyle = pick(["#b07a46", "#a8713f", "#b8834f"], hash(px, door.x));
        ctx.fillRect(px, top + 4, 5, h - 4);
      }
      ctx.fillStyle = "#3a2a22";
      ctx.fillRect(x + 4, top + 12, w - 8, 3);
      ctx.fillRect(x + 4, bottom - 14, w - 8, 3);
      break;
    }
    case "medieval": {
      const r = w / 2;
      ctx.fillStyle = "#9a95a8";
      ctx.beginPath();
      ctx.moveTo(x - 3, bottom);
      ctx.lineTo(x - 3, top + r);
      ctx.arc(x + r, top + r, r + 3, Math.PI, 0);
      ctx.lineTo(x + w + 3, bottom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7a4a2a";
      ctx.beginPath();
      ctx.moveTo(x + 2, bottom);
      ctx.lineTo(x + 2, top + r);
      ctx.arc(x + r, top + r, r - 2, Math.PI, 0);
      ctx.lineTo(x + w - 2, bottom);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let px = x + 7; px < x + w - 4; px += 7) ctx.fillRect(px, top + 8, 1, h - 8);
      ctx.fillStyle = "#3a2a30";
      ctx.fillRect(x + 2, top + 26, w - 4, 3);
      break;
    }
    case "garden": {
      ctx.fillStyle = "#3f8f3a";
      ctx.beginPath();
      ctx.arc(x + w / 2, top + w / 2, w / 2 + 2, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 2, top + w / 2, 8, h - w / 2);
      ctx.fillRect(x + w - 6, top + w / 2, 8, h - w / 2);
      ctx.fillStyle = "#a8dd8a";
      ctx.fillRect(x + 6, top + w / 2, w - 12, h - w / 2);
      ctx.fillStyle = "#e9dfc4";
      ctx.fillRect(x + 12, top + w / 2 + 8, w - 24, h - w / 2 - 8);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = pick(["#ff8fab", "#ffd166", "#ffffff"], hash(i, door.x));
        const a = Math.PI + (i / 7) * Math.PI;
        ctx.fillRect(x + w / 2 + Math.cos(a) * (w / 2) - 1, top + w / 2 + Math.sin(a) * (w / 2) - 1, 3, 3);
      }
      break;
    }
  }
}

/** Puerta en un muro lateral: un vano con la hoja abierta y un felpudo del color de la sala. */
function sideDoor(ctx: CanvasRenderingContext2D, map: SceneMap, door: Door) {
  const style = STYLES[map.style];
  const x = door.x * T;
  const y = door.y * T;
  const h = door.w * T;
  style.floor(ctx, x, y, x + T, y + h);
  const left = door.side === "left";
  // Jambas.
  ctx.fillStyle = shade(style.cap, -0.2);
  ctx.fillRect(x, y - 4, T, 6);
  ctx.fillRect(x, y + h - 2, T, 6);
  // Hoja abierta contra el muro, con el estilo de la sala.
  const leaf: Record<ThemeId, string> = { tech: "#bde8fb", minimal: "#ffffff", rustic: "#a8713f", medieval: "#7a4a2a", garden: "#3f8f3a" };
  const lx = left ? x + T - 8 : x + 2;
  frame(ctx, lx, y + 2, 6, h / 2, leaf[door.theme]);
  // Felpudo.
  const mx = left ? x + T + 2 : x - T + 2;
  ctx.fillStyle = shade(door.color, -0.2);
  ctx.fillRect(mx, y + 4, T - 4, h - 8);
  ctx.fillStyle = door.color;
  ctx.fillRect(mx + 2, y + 6, T - 8, h - 12);
  // Franja de color en el borde interior del vano.
  ctx.fillStyle = door.color;
  ctx.fillRect(left ? x + T - 2 : x, y, 2, h);
}

function bottomOpening(ctx: CanvasRenderingContext2D, map: SceneMap, s: Span, color: string) {
  const style = STYLES[map.style];
  const x = s.x * T;
  const y = s.y * T;
  const w = s.w * T;
  style.floor(ctx, x, y, x + w, y + T);
  ctx.fillStyle = shade(style.cap, -0.2);
  ctx.fillRect(x - 4, y, 6, T);
  ctx.fillRect(x + w - 2, y, 6, T);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y, w - 4, 3);
}

function topStairs(ctx: CanvasRenderingContext2D, s: Stairs) {
  const x = s.x * T;
  const w = s.w * T;
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const y = 3 * T - (i + 1) * ((2 * T) / steps);
    const inset = i * 1.5;
    ctx.fillStyle = shade("#c8b49a", -i * 0.06);
    ctx.fillRect(x + inset, y, w - inset * 2, (2 * T) / steps);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + inset, y + (2 * T) / steps - 2, w - inset * 2, 2);
  }
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x - 3, T + 2, 4, 2 * T - 2);
  ctx.fillRect(x + w - 1, T + 2, 4, 2 * T - 2);
}

function bottomStairs(ctx: CanvasRenderingContext2D, s: Stairs) {
  const x = s.x * T;
  const y = s.y * T;
  const w = s.w * T;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = shade("#c8b49a", -0.1 - i * 0.12);
    ctx.fillRect(x, y + i * 8, w, 8);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x, y + i * 8 + 6, w, 2);
  }
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(x - 3, y, 4, T);
  ctx.fillRect(x + w - 1, y, 4, T);
}

// ---------- Alfombras ----------

function carpet(ctx: CanvasRenderingContext2D, f: Furni) {
  const x = f.x * T;
  const y = f.y * T;
  const w = (f.w ?? 1) * T;
  const h = (f.d ?? 1) * T;
  const color = f.color ?? "#3d5a80";
  ctx.fillStyle = shade(color, -0.2);
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = y + 12; i < y + h - 4; i += 20) ctx.fillRect(x + w / 2 - 3, i, 6, 6);
}

function rug(ctx: CanvasRenderingContext2D, f: Furni) {
  const x = f.x * T + 4;
  const y = f.y * T + 4;
  const w = (f.w ?? 1) * T - 8;
  const h = (f.d ?? 1) * T - 8;
  const color = f.color ?? "#c7d2e3";
  ctx.fillStyle = shade(color, -0.15);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 6);
  ctx.fill();
  ctx.strokeStyle = shade(color, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 8, w - 16, h - 16, 4);
  ctx.stroke();
}

/** Dibuja todo lo que no cambia en un canvas aparte, que luego se copia en cada frame. */
export function renderStatic(map: SceneMap, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = map.w * T * scale;
  canvas.height = map.h * T * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  const style = STYLES[map.style];

  style.floor(ctx, T, 3 * T, (map.w - 1) * T, (map.h - 1) * T);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const c = tileAt(map, x, y);
      if (c === "#") wallCap(ctx, map, style, x, y);
      else if (c === "=") style.face(ctx, x * T, y * T, y - 1);
    }
  }
  // Zócalo del muro norte y una sombra suave sobre el piso.
  ctx.fillStyle = style.base;
  ctx.fillRect(T, 3 * T - 4, (map.w - 2) * T, 4);
  const shadow = ctx.createLinearGradient(0, 3 * T, 0, 3 * T + 10);
  shadow.addColorStop(0, "rgba(40,40,60,0.18)");
  shadow.addColorStop(1, "rgba(40,40,60,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(T, 3 * T, (map.w - 2) * T, 10);

  for (const f of map.furni) {
    if (f.kind === "rug") rug(ctx, f);
    if (f.kind === "carpet") carpet(ctx, f);
  }

  for (const d of map.decor) {
    switch (d.kind) {
      case "window":
        windowDecor(ctx, d, map.style);
        break;
      case "neon":
        neon(ctx, d);
        break;
      case "art":
        art(ctx, d);
        break;
      case "whiteboard":
        whiteboard(ctx, d);
        break;
      case "clock":
        clock(ctx, d);
        break;
      case "shelf":
        shelf(ctx, d);
        break;
      case "banner":
        banner(ctx, d);
        break;
      case "fireplace":
        fireplace(ctx, d, map.style);
        break;
      case "ivy":
        ivy(ctx, d);
        break;
      case "entrance":
        entrance(ctx, d);
        break;
      case "torch": {
        const cx = d.x * T + T / 2;
        ctx.fillStyle = "#3a3346";
        ctx.fillRect(cx - 2, 2 * T - 2, 4, 14);
        ctx.fillStyle = "#6e4526";
        ctx.fillRect(cx - 3, 2 * T - 8, 6, 8);
        break;
      }
      case "screen": {
        const x = d.x * T + 4;
        const w = (d.w ?? 4) * T - 8;
        const frameColor: Record<StyleId, string> = {
          tech: "#1f2937",
          minimal: "#d9d4cb",
          rustic: "#6e4526",
          medieval: "#5a3a22",
          garden: "#8a5a32",
          cowork: "#2f3440",
          lobby: "#2f3440",
        };
        frame(ctx, x - 4, T + 2, w + 8, 2 * T - 6, frameColor[map.style]);
        break;
      }
    }
  }
  for (const door of map.doors) {
    if (door.side === "top") topDoor(ctx, door);
    else if (door.side === "bottom") bottomOpening(ctx, map, door, door.color);
    else sideDoor(ctx, map, door);
  }
  for (const s of map.stairs) (s.side === "top" ? topStairs : bottomStairs)(ctx, s);
  if (map.exit && !map.decor.some((d) => d.kind === "entrance")) bottomOpening(ctx, map, map.exit, "#06c38d");
  return canvas;
}

// ---------- Fuego, agua y brillos ----------

export function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number) {
  const j = Math.sin(t / 90 + seed) * 0.5 + Math.sin(t / 53 + seed * 3) * 0.5;
  const h = size * (1 + j * 0.18);
  for (const [color, k] of [
    ["#f2662a", 1],
    ["#ffa53a", 0.72],
    ["#ffe9a0", 0.42],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.45 * k, y);
    ctx.quadraticCurveTo(x - size * 0.5 * k, y - h * 0.5 * k, x + j * 2, y - h * k);
    ctx.quadraticCurveTo(x + size * 0.5 * k, y - h * 0.5 * k, x + size * 0.45 * k, y);
    ctx.closePath();
    ctx.fill();
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace("ALPHA", String(alpha)));
  g.addColorStop(1, color.replace("ALPHA", "0"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Llamas de antorchas y chimeneas, y un brillo suave de neones y lámparas. */
export function drawAnimatedDecor(ctx: CanvasRenderingContext2D, map: SceneMap, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const d of map.decor) {
    const cx = (d.x + (d.w ?? 1) / 2) * T;
    const flicker = 0.85 + 0.15 * Math.sin(t / 120 + d.x);
    if (d.kind === "torch") glow(ctx, cx, 2 * T - 6, 60, "rgba(255,170,80,ALPHA)", 0.25 * flicker);
    if (d.kind === "fireplace") glow(ctx, cx, 3 * T - 10, 90, "rgba(255,170,80,ALPHA)", 0.25 * flicker);
    if (d.kind === "neon") glow(ctx, cx, T + 30, 80, `rgba(${hexRgb(d.color ?? "#22d3ee")},ALPHA)`, 0.18);
  }
  ctx.restore();
  for (const d of map.decor) {
    if (d.kind === "torch") drawFlame(ctx, d.x * T + T / 2, 2 * T - 7, 10, t, d.x);
    if (d.kind === "fireplace") {
      const x = d.x * T + 18;
      const w = (d.w ?? 2) * T - 36;
      for (let i = 0; i < 4; i++) drawFlame(ctx, x + (w * (i + 0.5)) / 4, 3 * T - 9, 13 + (i % 2) * 5, t, d.x + i);
    }
  }
}

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

// ---------- Muebles ordenados por profundidad ----------

export interface Drawable {
  key: number;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
}

/** Caja vista desde arriba con su frente visible: la tapa arriba y el frente abajo. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, top: number, front: number, color: string, topColor?: string) {
  ctx.fillStyle = LINE;
  ctx.fillRect(x - 1, y - 1, w + 2, top + front + 2);
  ctx.fillStyle = topColor ?? shade(color, 0.15);
  ctx.fillRect(x, y, w, top);
  ctx.fillStyle = shade(color, -0.12);
  ctx.fillRect(x, y + top, w, front);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x, y, w, 1);
}

function shadowUnder(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number) {
  ctx.fillStyle = "rgba(40,40,60,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function leaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, palette: string[]) {
  const blobs: [number, number, number][] = [
    [-0.55, 0.1, 0.55],
    [0.55, 0.1, 0.55],
    [0, -0.35, 0.65],
    [-0.3, -0.75, 0.45],
    [0.35, -0.7, 0.45],
  ];
  for (const [dx, dy, r] of blobs) {
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.arc(cx + dx * size, cy + dy * size, r * size + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  blobs.forEach(([dx, dy, r], i) => {
    ctx.fillStyle = palette[i % palette.length]!;
    ctx.beginPath();
    ctx.arc(cx + dx * size, cy + dy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function pot(ctx: CanvasRenderingContext2D, cx: number, base: number, w: number, color = "#f4f1ea") {
  box(ctx, cx - w / 2, base - 14, w, 4, 10, color);
}

const CHAIR: Record<StyleId, { frame: string; seat: string }> = {
  tech: { frame: "#1f2937", seat: "#334155" },
  minimal: { frame: "#e8dcc6", seat: "#ffffff" },
  rustic: { frame: "#7a4f2c", seat: "#a8713f" },
  medieval: { frame: "#6b4226", seat: "#9b2335" },
  garden: { frame: "#8a5a32", seat: "#c8e6a0" },
  cowork: { frame: "#2f3440", seat: "#5b7fd6" },
  lobby: { frame: "#2f3440", seat: "#5b7fd6" },
};

export function furniDrawables(map: SceneMap): Drawable[] {
  const out: Drawable[] = [];
  const add = (key: number, draw: Drawable["draw"]) => out.push({ key, draw });
  for (const f of map.furni) {
    const { x, y } = f;
    const w = f.w ?? 1;
    const d = f.d ?? 1;
    const px = x * T;
    const py = y * T;
    const cx = px + (w * T) / 2;
    const base = (y + d) * T;
    switch (f.kind) {
      case "workdesk":
        add(y + 1, (ctx) => {
          box(ctx, px + 2, py + 6, w * T - 4, 14, 8, "#e7d3b5", "#f0dfc4");
          for (let i = 0; i < w; i++) {
            const mx = px + i * T + 8;
            frame(ctx, mx, py - 4, 16, 11, "#1f2433");
            ctx.fillStyle = pick(["#7dd3fc", "#a7f3d0", "#fde68a", "#c4b5fd"], hash(x + i, y));
            ctx.fillRect(mx + 2, py - 2, 12, 7);
            ctx.fillStyle = "#1f2433";
            ctx.fillRect(mx + 7, py + 7, 2, 4);
            ctx.fillStyle = "#cbd5e1";
            ctx.fillRect(mx + 2, py + 12, 12, 3);
          }
        });
        break;
      case "officechair":
        add(y + 0.5, (ctx) => {
          shadowUnder(ctx, cx, py + 24, 9);
          frame(ctx, cx - 7, py + 10, 14, 12, "#2f3440");
          ctx.fillStyle = "#5b6070";
          ctx.fillRect(cx - 5, py + 12, 10, 8);
        });
        break;
      case "sofa": {
        const color = f.color ?? "#5b7fd6";
        const up = f.dir === "up";
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 2, (w * T) / 2);
          box(ctx, px + 2, py + 4, w * T - 4, 14, 10, color);
          ctx.fillStyle = shade(color, 0.25);
          ctx.fillRect(px + 6, up ? py + 4 : py + 12, w * T - 12, 8);
          ctx.fillStyle = shade(color, -0.1);
          ctx.fillRect(px + 2, py + 6, 5, 18);
          ctx.fillRect(px + w * T - 7, py + 6, 5, 18);
          for (let i = 1; i < w; i++) {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(px + i * T - 1, up ? py + 4 : py + 12, 2, 8);
          }
        });
        break;
      }
      case "armchair": {
        const color = f.color ?? "#f08a5d";
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 13);
          box(ctx, px + 4, py + 6, T - 8, 12, 9, color);
          ctx.fillStyle = shade(color, 0.25);
          ctx.fillRect(px + 9, py + 12, T - 18, 8);
        });
        break;
      }
      case "coffeetable":
        add(y + 1, (ctx) => {
          box(ctx, px + 6, py + 10, w * T - 12, 10, 5, "#8a5a32", "#b07a46");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 14, py + 12, 6, 5);
          ctx.fillStyle = "#06c38d";
          ctx.fillRect(cx + 4, py + 13, 10, 4);
        });
        break;
      case "beanbag": {
        const color = f.color ?? "#ffd166";
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 12);
          ctx.fillStyle = LINE;
          ctx.beginPath();
          ctx.ellipse(cx, py + 18, 13, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(cx, py + 18, 12, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = shade(color, 0.35);
          ctx.beginPath();
          ctx.ellipse(cx - 3, py + 14, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case "plant":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 10);
          pot(ctx, cx, base - 3, 16, "#e9e3d7");
          leaves(ctx, cx, base - 22, 9, ["#3aa457", "#46b865", "#2f8a4a", "#53c472", "#3aa457"]);
        });
        break;
      case "bigplant":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 12);
          pot(ctx, cx, base - 3, 20, "#d9734e");
          leaves(ctx, cx, base - 30, 13, ["#2f8a4a", "#3aa457", "#46b865", "#2f7d43", "#53c472"]);
        });
        break;
      case "tree":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 16);
          ctx.fillStyle = "#7a4f2c";
          ctx.fillRect(cx - 3, base - 22, 6, 18);
          leaves(ctx, cx, base - 38, 16, ["#3f9a43", "#4fae4f", "#348a39", "#5cbc5a", "#3f9a43"]);
        });
        break;
      case "flowerbed":
        add(y + d, (ctx) => {
          box(ctx, px + 2, py + 4, w * T - 4, d * T - 12, 6, "#8a5a32", "#6b4a2f");
          for (let i = 0; i < w * d * 6; i++) {
            const fx = px + 6 + hash(i, x, 1) * (w * T - 12);
            const fy = py + 8 + hash(i, y, 2) * (d * T - 20);
            ctx.fillStyle = "#3f9a43";
            ctx.fillRect(fx - 1, fy, 3, 4);
            ctx.fillStyle = pick(["#ff8fab", "#ffd166", "#ffffff", "#c084fc"], hash(i, x + y));
            ctx.fillRect(fx - 2, fy - 3, 4, 4);
          }
        });
        break;
      case "counter":
        add(y + 1, (ctx) => {
          box(ctx, px, py + 2, T, 12, 18, "#f4f4f6", "#c9a77c");
          ctx.fillStyle = "#06c38d";
          ctx.fillRect(px, py + 16, T, 2);
          if (x % 2 === 0) {
            frame(ctx, px + 9, py - 4, 14, 9, "#1f2433");
            ctx.fillStyle = "#7dd3fc";
            ctx.fillRect(px + 11, py - 2, 10, 5);
          }
        });
        break;
      case "coffeebar":
        add(y + 1, (ctx) => {
          box(ctx, px, py + 4, w * T, 12, 16, "#3f4656", "#c9a77c");
          frame(ctx, px + 6, py - 8, 18, 16, "#9aa3b2");
          ctx.fillStyle = "#1f2433";
          ctx.fillRect(px + 10, py - 4, 10, 6);
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(px + 20, py - 6, 2, 2);
          for (let i = 1; i < w; i++) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px + i * T + 8, py + 6, 6, 6);
            ctx.fillStyle = "#8a5a32";
            ctx.fillRect(px + i * T + 9, py + 7, 4, 2);
          }
        });
        break;
      case "bookshelf":
        add(y + 1, (ctx) => {
          frame(ctx, px + 2, base - 50, T - 4, 48, "#8a5a32");
          for (let s = 0; s < 3; s++) {
            const sy = base - 46 + s * 15;
            ctx.fillStyle = "#5a3a22";
            ctx.fillRect(px + 5, sy, T - 10, 12);
            for (let bx = px + 6; bx < px + T - 8; bx += 4) {
              const bh = 7 + Math.floor(hash(bx, sy, 42) * 5);
              ctx.fillStyle = pick(["#ef476f", "#118ab2", "#ffd166", "#06d6a0", "#8b5cf6"], hash(bx, sy, 41));
              ctx.fillRect(bx, sy + 12 - bh, 3, bh);
            }
          }
        });
        break;
      case "chair": {
        const c = CHAIR[map.style];
        const accent = f.color ?? c.seat;
        add(y + 0.3, (ctx) => {
          box(ctx, px + 6, py + 8, T - 12, 12, 3, c.frame, map.style === "tech" ? shade(accent, -0.2) : c.seat);
        });
        // El respaldo queda del lado sur y tapa las piernas de quien se sienta, como en Gather.
        add(y + 0.95, (ctx) => {
          box(ctx, px + 5, py + 18, T - 10, 4, 9, c.frame);
          ctx.fillStyle = map.style === "minimal" ? "#e8dcc6" : accent;
          ctx.fillRect(px + 8, py + 23, T - 16, 3);
        });
        break;
      }
      case "lectern": {
        const color = f.color ?? "#3b82f6";
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 12);
          const wood = map.style === "tech" ? "#e5e7eb" : map.style === "minimal" ? "#f4f1ea" : "#7a4f2c";
          box(ctx, px + 4, py - 2, T - 8, 9, 24, wood);
          ctx.fillStyle = color;
          ctx.fillRect(px + 9, py + 10, T - 18, 12);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + T / 2 - 2, py + 14, 4, 4);
        });
        break;
      }
      case "rack":
        add(y + 1, (ctx) => {
          frame(ctx, px + 3, base - 54, T - 6, 52, "#1f2937");
          for (let s = 0; s < 6; s++) {
            const sy = base - 50 + s * 8;
            ctx.fillStyle = "#374151";
            ctx.fillRect(px + 6, sy, T - 12, 6);
            ctx.fillStyle = (s + x) % 3 ? "#22c55e" : "#38bdf8";
            ctx.fillRect(px + 8, sy + 2, 2, 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fillRect(px + 12, sy + 2, 2, 2);
          }
        });
        break;
      case "arcade":
        add(y + 1, (ctx) => {
          frame(ctx, px + 4, base - 50, T - 8, 48, "#7c3aed");
          ctx.fillStyle = "#111827";
          ctx.fillRect(px + 8, base - 44, T - 16, 16);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(px + 10, base - 40, 4, 4);
          ctx.fillStyle = "#f472b6";
          ctx.fillRect(px + 17, base - 36, 4, 4);
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(px + 9, base - 24, T - 18, 6);
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(px + 12, base - 21, 2, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      case "pingpong":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 2, (w * T) / 2);
          box(ctx, px + 2, py + 6, w * T - 4, 16, 5, "#1d4ed8", "#2563eb");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 2, py + 13, w * T - 4, 1);
          ctx.fillRect(cx - 1, py + 4, 2, 20);
        });
        break;
      case "lamp":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 7);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(cx - 1, base - 34, 2, 30);
          ctx.fillRect(cx - 6, base - 5, 12, 3);
          frame(ctx, cx - 9, base - 46, 18, 12, "#fde9b6");
        });
        break;
      case "barrel":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 11);
          box(ctx, cx - 11, base - 28, 22, 8, 18, "#9b6a3c", "#b07a46");
          ctx.fillStyle = "#4b5563";
          ctx.fillRect(cx - 11, base - 16, 22, 2);
          ctx.fillRect(cx - 11, base - 8, 22, 2);
        });
        break;
      case "lantern":
        add(y + 1, (ctx, t) => {
          shadowUnder(ctx, cx, base - 4, 7);
          ctx.fillStyle = "#3a3346";
          ctx.fillRect(cx - 1, base - 26, 2, 22);
          frame(ctx, cx - 6, base - 38, 12, 12, "#3a3346");
          ctx.fillStyle = "#ffe9a0";
          ctx.fillRect(cx - 4, base - 36, 8, 8);
          drawFlame(ctx, cx, base - 29, 4, t, x);
        });
        break;
      case "armor":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 10);
          const parts: [number, number, number, number, string][] = [
            [-5, -18, 4, 12, "#8b93a5"],
            [1, -18, 4, 12, "#8b93a5"],
            [-7, -34, 14, 16, "#c9cfdb"],
            [-10, -33, 3, 13, "#8b93a5"],
            [7, -33, 3, 13, "#8b93a5"],
            [-5, -45, 10, 11, "#c9cfdb"],
            [-4, -40, 8, 2, "#1d1b24"],
            [-1, -50, 2, 5, "#e5484d"],
          ];
          for (const [dx, dy, ww, hh, c] of parts) frame(ctx, cx + dx, base - 4 + dy, ww, hh, c);
        });
        break;
      case "pillar":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx + 3, base - 3, 15);
          frame(ctx, cx - 14, base - 12, 28, 9, "#c9c4d4");
          const g = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
          g.addColorStop(0, "#e2dfea");
          g.addColorStop(1, "#a9a4b6");
          ctx.fillStyle = LINE;
          ctx.fillRect(cx - 10, base - 66, 20, 55);
          ctx.fillStyle = g;
          ctx.fillRect(cx - 9, base - 66, 18, 55);
          frame(ctx, cx - 14, base - 74, 28, 8, "#d6d2e0");
        });
        break;
      case "candelabra":
        add(y + 1, (ctx, t) => {
          ctx.fillStyle = "#c9993a";
          ctx.fillRect(cx - 6, base - 6, 12, 3);
          ctx.fillRect(cx - 1, base - 32, 2, 28);
          ctx.fillRect(cx - 9, base - 32, 18, 2);
          for (const fx of [cx - 8, cx, cx + 8]) {
            ctx.fillStyle = "#f1e6c8";
            ctx.fillRect(fx - 1.5, base - 39, 3, 7);
            drawFlame(ctx, fx, base - 39, 4, t, fx);
          }
        });
        break;
      case "fountain":
        add(y + d, (ctx, t) => {
          const fy = py + (d * T) / 2;
          ctx.fillStyle = LINE;
          ctx.beginPath();
          ctx.ellipse(cx, fy + 4, (w * T) / 2 - 2, (d * T) / 2 - 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#c9c4b8";
          ctx.beginPath();
          ctx.ellipse(cx, fy + 4, (w * T) / 2 - 3, (d * T) / 2 - 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6cc4f0";
          ctx.beginPath();
          ctx.ellipse(cx, fy + 2, (w * T) / 2 - 9, (d * T) / 2 - 12, 0, 0, Math.PI * 2);
          ctx.fill();
          const r = ((t / 600) % 1) * 14;
          ctx.strokeStyle = `rgba(255,255,255,${0.7 - r / 20})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(cx, fy + 2, 4 + r, 2 + r / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          frame(ctx, cx - 3, fy - 16, 6, 16, "#d6d2c6");
          ctx.fillStyle = "#a5dcf5";
          ctx.fillRect(cx - 1, fy - 22, 2, 7);
        });
        break;
      case "kiosk":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 9);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(cx - 2, base - 14, 4, 11);
          frame(ctx, cx - 11, base - 40, 22, 27, "#2f3440");
          ctx.fillStyle = "#e0f2fe";
          ctx.fillRect(cx - 9, base - 38, 18, 23);
          ctx.fillStyle = "#3b82f6";
          for (let i = 0; i < 4; i++) ctx.fillRect(cx - 7, base - 35 + i * 5, 6 + (i % 2) * 6, 2);
        });
        break;
      case "vending":
        add(y + 1, (ctx) => {
          frame(ctx, px + 3, base - 52, T - 6, 50, "#ef4444");
          ctx.fillStyle = "#e0f2fe";
          ctx.fillRect(px + 6, base - 48, T - 16, 32);
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 3; c++) {
              ctx.fillStyle = pick(["#fbbf24", "#22c55e", "#3b82f6", "#f472b6"], hash(r, c, x));
              ctx.fillRect(px + 8 + c * 5, base - 46 + r * 8, 3, 5);
            }
          ctx.fillStyle = "#1f2433";
          ctx.fillRect(px + 6, base - 12, T - 16, 6);
        });
        break;
      case "cooler":
        add(y + 1, (ctx) => {
          frame(ctx, cx - 8, base - 26, 16, 24, "#f4f4f6");
          ctx.fillStyle = "#93c5fd";
          ctx.beginPath();
          ctx.ellipse(cx, base - 32, 7, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#3b82f6";
          ctx.fillRect(cx - 3, base - 18, 6, 3);
        });
        break;
      case "bench":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, (w * T) / 2 - 4);
          box(ctx, px + 3, py + 10, w * T - 6, 8, 5, "#a8713f", "#c18a55");
        });
        break;
      case "table":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, (w * T) / 2 - 2);
          box(ctx, px + 2, py + 6, w * T - 4, 14, 6, "#8a5a32", "#b07a46");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(cx - 4, py + 10, 8, 6);
        });
        break;
      case "rug":
      case "carpet":
        break;
    }
  }
  return out;
}

// ---------- Textos sobre el mapa ----------

function plaque(ctx: CanvasRenderingContext2D, cx: number, y: number, title: string, sub: string, color: string, highlight: boolean, live: boolean) {
  ctx.font = `700 11px ${FONT}`;
  ctx.font = `700 11px ${FONT}`;
  const width = Math.min(150, Math.max(ctx.measureText(title).width + 22, 74));
  const x = cx - width / 2;
  ctx.fillStyle = "rgba(30,30,45,0.35)";
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 2, width, 28, 8);
  ctx.fill();
  ctx.fillStyle = highlight ? shade(color, 0.15) : color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 28, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(title, cx, y + 12, width - 12);
  ctx.font = `600 8.5px ${FONT}`;
  ctx.fillStyle = live ? "#fff6c8" : "rgba(255,255,255,0.88)";
  ctx.fillText(sub, cx, y + 23, width - 10);
  ctx.textAlign = "left";
}

export interface DoorStatus {
  live: boolean;
  count: number;
  label: string;
}

/** Placas de las puertas (nombre, estilo y si está en vivo), de las escaleras y de la salida. */
export function drawPlaques(ctx: CanvasRenderingContext2D, map: SceneMap, status: Map<string, DoorStatus> | null, hovered: string | null) {
  for (const door of map.doors) {
    if (door.id === "salida") continue;
    const s = status?.get(door.id);
    const sub = [s?.live ? "● EN VIVO" : "", s?.count ? `${s.count} dentro` : "", s?.label ?? ""].filter(Boolean).join(" · ");
    let cx: number;
    let y: number;
    if (door.side === "top") {
      cx = (door.x + door.w / 2) * T;
      y = 2;
    } else {
      // En los muros laterales la placa cuelga dentro del pasillo, sobre la puerta.
      cx = door.side === "left" ? 2.4 * T : (map.w - 2.4) * T;
      y = door.y * T - 34;
    }
    plaque(ctx, cx, y, door.label, sub || "Entrar", door.color, door.id === hovered, Boolean(s?.live));
  }
  const exits: (Span & { label: string })[] = [
    ...map.stairs.map((s) => ({ ...s, label: `${s.side === "top" ? "▲" : "▼"} ${s.label}` })),
    ...(map.exit ? [{ ...map.exit, label: "▼ Recepción" }] : []),
    ...map.doors.filter((d) => d.id === "salida").map((d) => ({ ...d, label: "▼ Salida" })),
  ];
  for (const e of exits) {
    const tiles = spanTiles(e);
    const cx = ((tiles[0]!.x + tiles[tiles.length - 1]!.x + 1) / 2) * T;
    const y = e.side === "top" ? 3 * T + 4 : e.y * T - 20;
    ctx.font = `700 10px ${FONT}`;
    const width = ctx.measureText(e.label).width + 16;
    ctx.fillStyle = "rgba(30,30,45,0.78)";
    ctx.beginPath();
    ctx.roundRect(cx - width / 2, y, width, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(e.label, cx, y + 11.5);
    ctx.textAlign = "left";
  }
}

export function drawSigns(ctx: CanvasRenderingContext2D, map: SceneMap) {
  for (const s of map.signs) {
    const cx = (s.x + s.w / 2) * T;
    ctx.font = `700 11px ${FONT}`;
    const width = ctx.measureText(s.text).width + 20;
    ctx.fillStyle = "#2f3440";
    ctx.beginPath();
    ctx.roundRect(cx - width / 2, 6, width, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(s.text, cx, 20);
    ctx.textAlign = "left";
  }
}

/** Contenido de la pantalla de la sala: título de la charla y si está en vivo. */
export function drawScreenContent(ctx: CanvasRenderingContext2D, map: SceneMap, color: string, title: string, live: boolean) {
  const d = map.decor.find((x) => x.kind === "screen");
  if (!d) return;
  const x = d.x * T + 4;
  const w = (d.w ?? 4) * T - 8;
  const top = T + 6;
  const h = 2 * T - 14;
  const g = ctx.createLinearGradient(x, top, x + w, top + h);
  g.addColorStop(0, shade(color, -0.15));
  g.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x, top, w, h / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(title, x + w / 2, top + h / 2 + 2, w - 16);
  if (live) {
    ctx.font = `700 9px ${FONT}`;
    ctx.fillStyle = "#ffe0e0";
    ctx.fillText("● EN VIVO", x + w / 2, top + h / 2 + 16);
  }
  ctx.textAlign = "left";
}

export function drawName(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, mine: boolean) {
  ctx.font = `600 10px ${FONT}`;
  const w = Math.ceil(ctx.measureText(text).width) + 12;
  ctx.fillStyle = mine ? "rgba(6, 195, 141, 0.95)" : "rgba(30, 30, 45, 0.7)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 7, w, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 3.5);
  ctx.textAlign = "left";
}

/** Globo de diálogo: nombre en negrita y el mensaje. */
export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, text: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `11px ${FONT}`;
  const maxW = 180;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  lines.push(line);
  const shown = lines.slice(0, 4);
  ctx.font = `700 10px ${FONT}`;
  const nameW = ctx.measureText(name).width;
  ctx.font = `11px ${FONT}`;
  const w = Math.max(nameW, ...shown.map((l) => ctx.measureText(l).width)) + 16;
  const h = shown.length * 14 + 20;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - h);
  ctx.fillStyle = "rgba(30,30,45,0.25)";
  ctx.beginPath();
  ctx.roundRect(bx + 1, by + 2, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 5, by + h - 0.5);
  ctx.lineTo(x, by + h + 6);
  ctx.lineTo(x + 5, by + h - 0.5);
  ctx.fill();
  ctx.fillStyle = "#4f46e5";
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText(name, bx + 8, by + 14);
  ctx.fillStyle = "#1f2433";
  ctx.font = `11px ${FONT}`;
  shown.forEach((l, i) => ctx.fillText(l, bx + 8, by + 28 + i * 14));
  ctx.restore();
}
