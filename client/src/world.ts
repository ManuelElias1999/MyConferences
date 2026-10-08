// Dibujo de los mapas vistos desde arriba, al estilo Gather: pisos y muros según el
// estilo de cada lugar, adornos, puertas, escaleras, muebles y la búsqueda de caminos.

import {
  isWalkable,
  spanTiles,
  type AreaFloor,
  type Decor,
  type Door,
  type Furni,
  type Roof,
  type SceneMap,
  type Span,
  type Stairs,
  type StyleId,
  type Tile,
} from "../../shared/maps.ts";
import type { ThemeId } from "../../shared/themes.ts";
import type { Sponsor } from "../../shared/types.ts";
import { shade } from "./avatar.ts";

export const T = 32;
const FONT = '"Space Grotesk", Inter, ui-sans-serif, system-ui, sans-serif';
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
      // Los muebles se pueden atravesar, pero el camino los rodea si puede.
      const cost = g.get(current)! + (map.soft[k] && k !== goal ? 5 : 1);
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

/** Piso liso, sin vetas ni baldosas: lo único que se ve encima son personas y muebles. */
const flat =
  (color: string): Painter =>
  (ctx, x0, y0, x1, y1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };

// ---------- Muros ----------

type FacePainter = (ctx: CanvasRenderingContext2D, px: number, py: number, row: number) => void;

/** Pared lisa en dos tonos, con una moldura que la separa del piso. */
const plaster =
  (top: string, lower: string, rail: string): FacePainter =>
  (ctx, px, py, row) => {
    ctx.fillStyle = row === 1 ? lower : top;
    ctx.fillRect(px, py, T, T);
    if (row === 1) {
      ctx.fillStyle = rail;
      ctx.fillRect(px, py, T, 3);
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
      }
    }
  };

/** Paneles de un azul pizarra con una franja de luz: bien distintos del piso claro. */
const panels: FacePainter = (ctx, px, py, row) => {
  ctx.fillStyle = row === 1 ? "#4f5f80" : "#5d6e91";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(px + T - 1, py, 1, T);
  if (row === 0) {
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(px, py + 10, T, 2);
  }
};

const logs: FacePainter = (ctx, px, py) => {
  const colors = ["#8a5a32", "#83552f", "#915f36", "#7d512c"];
  for (let r = 0; r < 4; r++) {
    const ly = py + r * 8;
    ctx.fillStyle = pick(colors, hash(px >> 6, ly, 17));
    ctx.fillRect(px, ly, T, 8);
    ctx.fillStyle = "#4e321c";
    ctx.fillRect(px, ly + 7, T, 1);
  }
};

const hedge: FacePainter = (ctx, px, py, row) => {
  ctx.fillStyle = row === 1 ? "#3b7f37" : "#46923f";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 4; i++) ctx.fillRect(px + ((i * 9 + (py >> 3)) % 28), py + i * 8 + 2, 4, 3);
};

/** Paneles negros con una línea amarilla y alguna estrella, al estilo de la red Stellar. */
const stellarPanels: FacePainter = (ctx, px, py, row) => {
  ctx.fillStyle = row === 1 ? "#18181f" : "#212129";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(px + T - 1, py, 1, T);
  if (row === 0) {
    ctx.fillStyle = "#fdda24";
    ctx.fillRect(px, py + 10, T, 2);
    if (hash(px, py, 21) > 0.6) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px + 6 + Math.floor(hash(py, px, 22) * 18), py + 18, 2, 2);
    }
  }
};

/** Paneles azul noche con tiras de luz cian y magenta: un hackathon tecnológico. */
const hackPanels: FacePainter = (ctx, px, py, row) => {
  ctx.fillStyle = row === 1 ? "#141b2d" : "#1b2440";
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(px + T - 1, py, 1, T);
  if (row === 0) {
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(px, py + 8, T, 2);
    ctx.fillStyle = "rgba(34,211,238,0.25)";
    ctx.fillRect(px, py + 10, T, 3);
  } else {
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(px, py + 24, T, 1);
  }
};

interface Style {
  floor: Painter;
  face: FacePainter;
  /** Borde superior de los muros, visto desde arriba. */
  cap: string;
  /** Zócalo: la línea donde la pared toca el piso. */
  base: string;
  /** Lo que queda fuera del recinto o entre edificios. */
  outside: string;
}

const STYLES: Record<StyleId, Style> = {
  // Cowork moderno: roble claro, paredes grafito con una línea de bronce.
  cowork: { floor: flat("#eee5d6"), face: plaster("#3b404c", "#333844", "#c8a46a"), cap: "#22252d", base: "#c8a46a", outside: "#cfd3da" },
  tech: { floor: flat("#f3f6fa"), face: panels, cap: "#2b3448", base: "#22d3ee", outside: "#c6cfdc" },
  minimal: { floor: flat("#f7f3ec"), face: plaster("#b9aa94", "#a8987f", "#8a7a63"), cap: "#5e5244", base: "#6f604c", outside: "#ddd5c7" },
  rustic: { floor: flat("#e7cda6"), face: logs, cap: "#4a3220", base: "#3e2a18", outside: "#b6a27f" },
  medieval: { floor: flat("#e0dbcf"), face: bricks(["#8f899e", "#878196", "#958fa4", "#827c91"], "#6b6579"), cap: "#433e55", base: "#3a3548", outside: "#a7b892" },
  garden: { floor: flat("#f1e8d2"), face: hedge, cap: "#2c5a28", base: "#24481f", outside: "#a7d084" },
  stellar: { floor: flat("#fbfaf5"), face: stellarPanels, cap: "#0f0f14", base: "#fdda24", outside: "#d6d1ef" },
  hackathon: { floor: flat("#eef1f6"), face: hackPanels, cap: "#0b1020", base: "#22d3ee", outside: "#c5ccda" },
};

const tileAt = (map: SceneMap, x: number, y: number) => map.tiles[y]?.[x] ?? "#";

/**
 * Muro visto desde arriba. Solo la franja que toca un piso se pinta como
 * muro (oscura, con borde); lo demás es el exterior, en un tono suave.
 */
function wallCap(ctx: CanvasRenderingContext2D, map: SceneMap, style: Style, x: number, y: number, outside: Set<number>) {
  const px = x * T;
  const py = y * T;
  const open = (c: string) => c !== "#";
  if (outside.has(y * map.w + x)) {
    ctx.fillStyle = style.outside;
    ctx.fillRect(px, py, T, T);
    return;
  }
  ctx.fillStyle = style.cap;
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = shade(style.cap, 0.25);
  if (open(tileAt(map, x, y + 1))) ctx.fillRect(px, py + T - 3, T, 3);
  if (open(tileAt(map, x + 1, y))) ctx.fillRect(px + T - 3, py, 3, T);
  if (open(tileAt(map, x - 1, y))) ctx.fillRect(px, py, 3, T);
  if (open(tileAt(map, x, y - 1))) ctx.fillRect(px, py, T, 3);
}

/** Baldosas de muro sin piso al lado y conectadas con el borde del mapa: el exterior. */
function outsideTiles(map: SceneMap) {
  const far = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(map, x + dx, y + dy) !== "#") return false;
    return true;
  };
  const seen = new Set<number>();
  const queue: Tile[] = [];
  for (let x = 0; x < map.w; x++) queue.push({ x, y: 0 }, { x, y: map.h - 1 });
  for (let y = 0; y < map.h; y++) queue.push({ x: 0, y }, { x: map.w - 1, y });
  while (queue.length) {
    const t = queue.pop()!;
    const k = t.y * map.w + t.x;
    if (t.x < 0 || t.y < 0 || t.x >= map.w || t.y >= map.h || seen.has(k) || !far(t.x, t.y)) continue;
    seen.add(k);
    queue.push({ x: t.x + 1, y: t.y }, { x: t.x - 1, y: t.y }, { x: t.x, y: t.y + 1 }, { x: t.x, y: t.y - 1 });
  }
  return seen;
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
  if (style === "cowork" || style === "tech") {
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
  frame(ctx, cx - 10, cy - 10, 20, 20, "#ffffff");
  ctx.fillStyle = "#1f2433";
  ctx.fillRect(cx - 1, cy - 7, 2, 8);
  ctx.fillRect(cx, cy - 1, 6, 2);
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
    case "hackathon":
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
    case "stellar": {
      // Puerta negra con marco amarillo y una estrella de cuatro puntas.
      frame(ctx, x, top, w, h, "#fdda24");
      ctx.fillStyle = "#16161d";
      ctx.fillRect(x + 3, top + 3, w - 6, h - 3);
      ctx.fillStyle = "#2a2a33";
      ctx.fillRect(x + w / 2 - 1, top + 3, 2, h - 3);
      const sx = x + w / 2;
      const sy = top + 16;
      ctx.fillStyle = door.color;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx + 2, sy - 2);
      ctx.lineTo(sx + 8, sy);
      ctx.lineTo(sx + 2, sy + 2);
      ctx.lineTo(sx, sy + 8);
      ctx.lineTo(sx - 2, sy + 2);
      ctx.lineTo(sx - 8, sy);
      ctx.lineTo(sx - 2, sy - 2);
      ctx.closePath();
      ctx.fill();
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
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(x + 3, y + 3, w - 6, h - 6);
  ctx.fill();
  ctx.strokeStyle = shade(color, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x + 8, y + 8, w - 16, h - 16);
  ctx.stroke();
}

const AREA_FLOOR: Record<AreaFloor, Painter> = {
  grass: flat("#b3dc93"),
  wood: flat("#dcb88d"),
  deck: flat("#cfbea6"),
  stone: flat("#d2ccbf"),
  tiles: flat("#eeebe5"),
};

const STEP: Record<StyleId, { tread: string; rail: string }> = {
  tech: { tread: "#d5dde9", rail: "#38bdf8" },
  minimal: { tread: "#e9e2d6", rail: "#6f604c" },
  rustic: { tread: "#c9965f", rail: "#5a3a22" },
  medieval: { tread: "#c4bdae", rail: "#4f4a5c" },
  garden: { tread: "#d9cfb6", rail: "#6b4a2f" },
  cowork: { tread: "#d5dde9", rail: "#4b5563" },
  stellar: { tread: "#e8e6dd", rail: "#fdda24" },
  hackathon: { tread: "#d9dee8", rail: "#22d3ee" },
};

/** Ascensor: marco amarillo, letrero luminoso «ASCENSOR», puertas de acero y el visor con la flecha. Nada que ver con una puerta de sala. */
function elevator(ctx: CanvasRenderingContext2D, s: Stairs) {
  const x = s.x * T + 2;
  const w = s.w * T - 4;
  const top = T - 6;
  const bottom = 3 * T;
  // Marco amarillo con franjas, bien distinto de las puertas de las salas.
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(x - 6, top, w + 12, bottom - top);
  ctx.fillStyle = "#16161d";
  for (let yy = top + 4; yy < bottom; yy += 10) {
    ctx.fillRect(x - 6, yy, 3, 5);
    ctx.fillRect(x + w + 3, yy, 3, 5);
  }
  // Letrero luminoso.
  ctx.fillStyle = "#16161d";
  ctx.fillRect(x - 2, top + 3, w + 4, 13);
  ctx.font = `700 8px ${FONT}`;
  ctx.fillStyle = "#fbbf24";
  ctx.textAlign = "center";
  ctx.fillText(`${s.dir === "up" ? "▲" : "▼"} ASCENSOR`, x + w / 2, top + 12.5, w);
  ctx.textAlign = "left";
  // Puertas de acero.
  ctx.fillStyle = "#c9d0da";
  ctx.fillRect(x, top + 19, w / 2 - 1, bottom - top - 19);
  ctx.fillRect(x + w / 2 + 1, top + 19, w / 2 - 1, bottom - top - 19);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(x + 4, top + 22, 2, bottom - top - 26);
  ctx.fillRect(x + w / 2 + 5, top + 22, 2, bottom - top - 26);
  ctx.fillStyle = "#5b6475";
  ctx.fillRect(x + w / 2 - 1, top + 19, 2, bottom - top - 19);
}

/** Escalera angosta dentro de un arco: se ven los peldaños que suben (o bajan) por dentro del muro. */
function stairwell(ctx: CanvasRenderingContext2D, style: StyleId, s: Stairs) {
  const c = STEP[style];
  const x = s.x * T + 4;
  const w = s.w * T - 8;
  const top = T + 2;
  const bottom = 3 * T;
  const r = w / 2;
  ctx.fillStyle = shade(c.rail, -0.2);
  ctx.beginPath();
  ctx.moveTo(x - 4, bottom);
  ctx.lineTo(x - 4, top + r);
  ctx.arc(x + r, top + r, r + 4, Math.PI, 0);
  ctx.lineTo(x + w + 4, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, top + r);
  ctx.arc(x + r, top + r, r, Math.PI, 0);
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#1f1d26";
  ctx.fillRect(x, top, w, bottom - top);
  const steps = 7;
  const stepH = (bottom - top) / steps;
  for (let i = 0; i < steps; i++) {
    // Al subir, los peldaños de arriba quedan más lejos y oscuros; al bajar, al revés.
    const k = s.dir === "up" ? i / steps : 1 - i / steps;
    const y = bottom - (i + 1) * stepH;
    ctx.fillStyle = shade(c.tread, -k * 0.6);
    ctx.fillRect(x + 2, y, w - 4, stepH - 1);
  }
  ctx.restore();
  // Flecha sobre el arco.
  ctx.fillStyle = "#ffb703";
  ctx.beginPath();
  const ax = x + r;
  if (s.dir === "up") {
    ctx.moveTo(ax, top - 8);
    ctx.lineTo(ax + 5, top - 2);
    ctx.lineTo(ax - 5, top - 2);
  } else {
    ctx.moveTo(ax, top - 2);
    ctx.lineTo(ax + 5, top - 8);
    ctx.lineTo(ax - 5, top - 8);
  }
  ctx.closePath();
  ctx.fill();
}

/** Puerta en un muro lateral: un marco grueso del color de la sala, el vano abierto y la hoja hacia adentro. */
function sideDoor(ctx: CanvasRenderingContext2D, style: StyleId, door: Door) {
  const x = door.x * T;
  const y = door.y * T;
  const h = door.w * T;
  const toRoom = door.side === "left" ? -1 : 1;
  frame(ctx, x, y - 4, T, h + 8, shade(door.color, -0.3));
  ctx.fillStyle = door.color;
  ctx.fillRect(x + 2, y - 2, T - 4, 6);
  ctx.fillRect(x + 2, y + h - 4, T - 4, 6);
  // Vano: el piso entra a la sala, con una sombra del lado de adentro.
  STYLES[style].floor(ctx, x + 4, y + 6, x + T - 4, y + h - 6);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(toRoom < 0 ? x + 4 : x + T - 12, y + 6, 8, h - 12);
  // Hoja abierta pegada al marco, con su manija.
  const leaf = toRoom < 0 ? x + 4 : x + T - 10;
  ctx.fillStyle = shade(door.color, -0.15);
  ctx.fillRect(leaf, y + 6, 6, h / 2 - 2);
  ctx.fillStyle = "#f2c94c";
  ctx.fillRect(leaf + 2, y + h / 2 - 10, 2, 5);
  // Felpudo del color de la sala en el lado del pasillo, para que se vea la entrada.
  ctx.fillStyle = door.color;
  ctx.fillRect(toRoom < 0 ? x + T - 4 : x, y + 6, 4, h - 12);
}

/** Vano entre dos zonas: postes, dintel y el nombre de la zona a la que lleva. */
function portal(ctx: CanvasRenderingContext2D, style: StyleId, d: Decor) {
  const x0 = d.x * T;
  const x1 = (d.x + (d.w ?? 2)) * T;
  const c = STEP[style].rail;
  for (const px of [x0 - 10, x1 + 2]) {
    frame(ctx, px, T - 4, 8, 2 * T + 4, shade(c, 0.1));
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px, T - 4, 2, 2 * T + 4);
  }
  frame(ctx, x0 - 12, T - 10, x1 - x0 + 24, 18, "#16161d");
  ctx.fillStyle = c;
  ctx.fillRect(x0 - 12, T + 6, x1 - x0 + 24, 2);
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(d.text ?? "", (x0 + x1) / 2, T + 3, x1 - x0 + 16);
  ctx.textAlign = "left";
}

/** Puerta de un cuarto: marco de color, dos hojas de vidrio corridas a los lados y el umbral. */
function roomDoor(ctx: CanvasRenderingContext2D, d: Decor) {
  const x0 = d.x * T;
  const x1 = (d.x + (d.w ?? 2)) * T;
  const color = d.color ?? "#2f6bff";
  // Marco.
  ctx.fillStyle = shade(color, -0.35);
  ctx.fillRect(x0 - 8, T - 2, 8, 2 * T + 2);
  ctx.fillRect(x1, T - 2, 8, 2 * T + 2);
  ctx.fillRect(x0 - 8, T - 6, x1 - x0 + 16, 8);
  ctx.fillStyle = color;
  ctx.fillRect(x0 - 6, T - 4, x1 - x0 + 12, 3);
  // Hojas de vidrio abiertas contra el marco.
  for (const hx of [x0 - 6, x1 - 2]) {
    ctx.fillStyle = "rgba(186,230,253,0.85)";
    ctx.fillRect(hx, T + 6, 8, 2 * T - 8);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(hx + 2, T + 9, 2, 2 * T - 16);
  }
  // Umbral.
  ctx.fillStyle = shade(color, -0.2);
  ctx.fillRect(x0, 3 * T - 3, x1 - x0, 3);
}

/** Cartel con flecha en la pared, para indicar hacia dónde sigue una zona. */
function sign(ctx: CanvasRenderingContext2D, d: Decor) {
  const x = d.x * T + 2;
  const w = (d.w ?? 2) * T - 4;
  frame(ctx, x, T + 12, w, 18, "#16161d");
  ctx.fillStyle = "#ff5c39";
  ctx.fillRect(x, T + 12, w, 2);
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(d.text ?? "", x + w / 2, T + 25, w - 6);
  ctx.textAlign = "left";
}

/** Desplaza el dibujo para que un adorno pensado para la cara de muro de las filas 1-2 quede en `y`. */
function atRow(ctx: CanvasRenderingContext2D, y: number, draw: () => void) {
  ctx.save();
  ctx.translate(0, (y - 2) * T);
  draw();
  ctx.restore();
}

/** Entrada monumental del auditorio principal: columnas, puertas dobles altas y alfombra roja. */
function mainDoor(ctx: CanvasRenderingContext2D, door: Door) {
  const x = door.x * T;
  const w = door.w * T;
  const top = T + 2;
  const bottom = 3 * T;
  // Columnas a los lados.
  for (const cx of [x - 10, x + w + 2]) {
    frame(ctx, cx, top - 6, 8, bottom - top + 6, "#e9e4dc");
    ctx.fillStyle = "#c9c3b8";
    ctx.fillRect(cx + 5, top - 6, 3, bottom - top + 6);
    frame(ctx, cx - 2, top - 8, 12, 4, "#f4f1ea");
  }
  frame(ctx, x - 2, top - 2, w + 4, bottom - top + 2, "#3a2f2a");
  // Hojas de la puerta con paneles y tiradores dorados.
  for (const lx of [x + 2, x + w / 2 + 1]) {
    ctx.fillStyle = shade(door.color, -0.35);
    ctx.fillRect(lx, top + 2, w / 2 - 3, bottom - top - 2);
    ctx.fillStyle = shade(door.color, -0.15);
    ctx.fillRect(lx + 4, top + 7, w / 2 - 11, 18);
    ctx.fillRect(lx + 4, top + 30, w / 2 - 11, 22);
  }
  ctx.fillStyle = "#f2c94c";
  ctx.fillRect(x + w / 2 - 6, top + 30, 3, 10);
  ctx.fillRect(x + w / 2 + 3, top + 30, 3, 10);
}

const ROOF: Record<StyleId, { base: string; line: string }> = {
  tech: { base: "#dbe3ee", line: "#c3cedd" },
  minimal: { base: "#f1ede6", line: "#e2ddd3" },
  rustic: { base: "#b07443", line: "#8f5a30" },
  medieval: { base: "#9a95a6", line: "#7f7a8c" },
  garden: { base: "#d39a6a", line: "#bd8456" },
  cowork: { base: "#dbe3ee", line: "#c3cedd" },
  stellar: { base: "#2a2a33", line: "#34343f" },
  hackathon: { base: "#1e2638", line: "#263049" },
};

/** Techo de un edificio de sala: claro, con el color de la sala y su nombre bien grande. */
function drawRoof(ctx: CanvasRenderingContext2D, style: StyleId, roof: Roof) {
  const x = roof.x * T;
  const y = roof.y * T;
  const w = roof.w * T;
  const h = roof.h * T;
  const r = ROOF[style];
  ctx.fillStyle = r.base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = r.line;
  for (let ly = y + 8; ly < y + h; ly += 8) ctx.fillRect(x, ly, w, 1);
  if (style === "tech") {
    // Paneles solares y ventilaciones.
    for (let px = x + 10; px < x + w - 26; px += 34) {
      ctx.fillStyle = "#2f4a7a";
      ctx.fillRect(px, y + 8, 22, 12);
      ctx.fillStyle = "#4f74b3";
      ctx.fillRect(px + 1, y + 9, 10, 5);
    }
  }
  if (style === "hackathon") {
    // Techo oscuro con una grilla de luces.
    ctx.fillStyle = "rgba(34,211,238,0.5)";
    for (let lx = x + 12; lx < x + w - 8; lx += 24) ctx.fillRect(lx, y + 6, 2, h - 14);
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(x, y + 4, w, 2);
  }
  if (style === "stellar") {
    // Techo oscuro con estrellas y una franja amarilla.
    for (let i = 0; i < roof.w * roof.h; i++) {
      ctx.fillStyle = i % 4 ? "rgba(255,255,255,0.7)" : "#fdda24";
      ctx.fillRect(x + 6 + ((i * 37) % (w - 12)), y + 6 + ((i * 23) % (h - 12)), 2, 2);
    }
    ctx.fillStyle = "#fdda24";
    ctx.fillRect(x, y + 4, w, 2);
  }
  if (style === "garden") {
    // Pabellón con tejas: una cumbrera al medio.
    ctx.fillStyle = "#a8683e";
    ctx.fillRect(x, y + 4, w, 3);
  }
  ctx.fillStyle = "rgba(22,22,29,0.35)";
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = roof.open ? roof.color : "#b9b4ab";
  ctx.fillRect(x, y + h - 6, w, 6);
  // Nombre pintado sobre un cartel en el techo.
  ctx.font = `700 ${roof.w > 12 ? 16 : 12}px ${FONT}`;
  const label = roof.open ? `🎤 ${roof.label.toUpperCase()}` : roof.label.toUpperCase();
  const tw = Math.min(w - 16, ctx.measureText(label).width + 18);
  const ty = y + Math.round(h * 0.38);
  ctx.fillStyle = roof.open ? "#16161d" : "rgba(22,22,29,0.35)";
  ctx.fillRect(x + w / 2 - tw / 2, ty - 12, tw, 22);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, ty + 4, tw - 10);
  ctx.textAlign = "left";
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

  style.floor(ctx, 0, 0, map.w * T, map.h * T);
  const outside = outsideTiles(map);
  for (const area of map.areas) AREA_FLOOR[area.floor](ctx, area.x * T, area.y * T, (area.x + area.w) * T, (area.y + area.h) * T);
  // Mesas de equipo: un rectángulo de color suave con borde, para que se vea hasta dónde llega la conversación.
  for (const z of map.zones) {
    if (z.room) continue;
    if (z.id.startsWith("stand-")) {
      // El cuadrado de un stand: apenas marcado, para saber dónde se escucha.
      ctx.strokeStyle = "rgba(100,116,139,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(z.x * T + 2, z.y * T + 2, z.w * T - 4, z.h * T - 4);
      ctx.setLineDash([]);
      continue;
    }
    const x = z.x * T + 2;
    const y = z.y * T + 2;
    const w = z.w * T - 4;
    const h = z.h * T - 4;
    ctx.fillStyle = `rgba(${hexRgb(z.color)},0.12)`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
  }
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const c = tileAt(map, x, y);
      if (c === "#") wallCap(ctx, map, style, x, y, outside);
      else if (c === "=") {
        const lower = tileAt(map, x, y + 1) === ".";
        style.face(ctx, x * T, y * T, lower ? 1 : 0);
        if (lower) {
          // Zócalo y una sombra sobre el piso: marca bien dónde termina la pared.
          ctx.fillStyle = style.base;
          ctx.fillRect(x * T, (y + 1) * T - 5, T, 5);
          ctx.fillStyle = "rgba(40,40,60,0.18)";
          ctx.fillRect(x * T, (y + 1) * T, T, 7);
        }
      }
    }
  }
  // Sombra de los muros laterales sobre el piso.
  ctx.fillStyle = "rgba(40,40,60,0.12)";
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (tileAt(map, x, y) !== ".") continue;
      if (tileAt(map, x - 1, y) === "#") ctx.fillRect(x * T, y * T, 5, T);
      if (tileAt(map, x + 1, y) === "#") ctx.fillRect((x + 1) * T - 3, y * T, 3, T);
    }
  }

  for (const roof of map.roofs) drawRoof(ctx, map.style, roof);

  for (const f of map.furni) {
    if (f.kind === "rug") rug(ctx, f);
    if (f.kind === "carpet") carpet(ctx, f);
  }

  for (const d of map.decor) {
    if (d.kind === "entrance") {
      entrance(ctx, d);
      continue;
    }
    atRow(ctx, d.y, () => {
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
        case "portal":
          portal(ctx, map.style, d);
          break;
        case "sign":
          sign(ctx, d);
          break;
        case "roomdoor":
          roomDoor(ctx, d);
          break;
        case "torch": {
          const cx = d.x * T + T / 2;
          ctx.fillStyle = "#3a3346";
          ctx.fillRect(cx - 2, 2 * T - 2, 4, 14);
          ctx.fillStyle = "#6e4526";
          ctx.fillRect(cx - 3, 2 * T - 8, 6, 8);
          break;
        }
        case "sponsors": {
          const x = d.x * T + 3;
          const w = (d.w ?? 2) * T - 6;
          frame(ctx, x - 2, T + 4, w + 4, 2 * T - 12, "#16161d");
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(x + w / 2 - 6, 3 * T - 9, 12, 5);
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
            stellar: "#16161d",
            hackathon: "#1f2937",
          };
          frame(ctx, x - 4, T + 2, w + 8, 2 * T - 6, frameColor[map.style]);
          break;
        }
      }
    });
  }
  for (const door of map.doors) {
    if (door.side === "top") atRow(ctx, door.y, () => (door.main ? mainDoor(ctx, door) : topDoor(ctx, door)));
    else if (door.side === "bottom") bottomOpening(ctx, map, door, door.color);
    else sideDoor(ctx, map.style, door);
  }
  // Ascensor en los estilos modernos; escalera bajo un arco en los clásicos.
  const classic = map.style === "rustic" || map.style === "medieval" || map.style === "garden";
  for (const st of map.stairs) atRow(ctx, st.y, () => (classic ? stairwell(ctx, map.style, st) : elevator(ctx, st)));
  if (map.exit && !map.decor.some((d) => d.kind === "entrance")) bottomOpening(ctx, map, map.exit, "#ff5c39");
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

/** Llamas de antorchas y chimeneas, y un brillo suave de neones. */
export function drawAnimatedDecor(ctx: CanvasRenderingContext2D, map: SceneMap, t: number) {
  for (const d of map.decor) {
    if (d.kind !== "torch" && d.kind !== "fireplace" && d.kind !== "neon") continue;
    atRow(ctx, d.y, () => {
      const cx = (d.x + (d.w ?? 1) / 2) * T;
      const flicker = 0.85 + 0.15 * Math.sin(t / 120 + d.x);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (d.kind === "torch") glow(ctx, cx, 2 * T - 6, 60, "rgba(255,170,80,ALPHA)", 0.25 * flicker);
      if (d.kind === "fireplace") glow(ctx, cx, 3 * T - 10, 90, "rgba(255,170,80,ALPHA)", 0.25 * flicker);
      if (d.kind === "neon") glow(ctx, cx, T + 30, 80, `rgba(${hexRgb(d.color ?? "#22d3ee")},ALPHA)`, 0.18);
      ctx.restore();
      if (d.kind === "torch") drawFlame(ctx, d.x * T + T / 2, 2 * T - 7, 10, t, d.x);
      if (d.kind === "fireplace") {
        const x = d.x * T + 18;
        const w = (d.w ?? 2) * T - 36;
        for (let i = 0; i < 4; i++) drawFlame(ctx, x + (w * (i + 0.5)) / 4, 3 * T - 9, 13 + (i % 2) * 5, t, d.x + i);
      }
    });
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
  ctx.fillStyle = "rgba(30,28,45,0.16)";
  // Sombra baja y pareja: en muebles anchos no debe volverse un bloque gris.
  const h = Math.max(3, Math.min(8, Math.round(rx * 0.6)));
  ctx.fillRect(Math.round(cx - rx), Math.round(cy - h / 2), Math.round(rx * 2), h);
}

/** Follaje de bloques: varios cuadrados superpuestos con luz arriba a la izquierda. */
function leaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, palette: string[]) {
  const blocks: [number, number, number][] = [
    [-0.9, -0.2, 0.9],
    [0, -0.25, 0.9],
    [-0.5, -0.95, 0.95],
    [-0.35, -0.55, 0.8],
  ];
  for (const [dx, dy, k] of blocks) {
    const s0 = Math.round(size * k);
    ctx.fillStyle = LINE;
    ctx.fillRect(Math.round(cx + dx * size) - 1, Math.round(cy + dy * size) - 1, s0 + 2, s0 + 2);
  }
  blocks.forEach(([dx, dy, k], i) => {
    const s0 = Math.round(size * k);
    const x = Math.round(cx + dx * size);
    const y = Math.round(cy + dy * size);
    ctx.fillStyle = palette[i % palette.length]!;
    ctx.fillRect(x, y, s0, s0);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, s0, 2);
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
  cowork: { frame: "#2f3440", seat: "#2f6bff" },
  stellar: { frame: "#16161d", seat: "#fdda24" },
  hackathon: { frame: "#1f2937", seat: "#22d3ee" },
};

export function furniDrawables(map: SceneMap, media?: () => Media): Drawable[] {
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
        const color = f.color ?? "#ffb703";
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 4, 12);
          box(ctx, px + 6, py + 8, T - 12, 10, 8, color);
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
        const seatTop = map.style === "tech" ? shade(accent, -0.2) : c.seat;
        const strip = map.style === "minimal" ? "#e8dcc6" : accent;
        if (f.dir === "down") {
          // Mira hacia abajo: el respaldo queda arriba, detrás de quien se sienta.
          add(y + 0.3, (ctx) => {
            box(ctx, px + 5, py + 1, T - 10, 4, 9, c.frame);
            ctx.fillStyle = strip;
            ctx.fillRect(px + 8, py + 6, T - 16, 3);
            box(ctx, px + 6, py + 12, T - 12, 10, 4, c.frame, seatTop);
          });
        } else if (f.dir === "left" || f.dir === "right") {
          // De costado: el respaldo va del lado contrario hacia donde mira.
          const bx = f.dir === "right" ? px + 4 : px + T - 10;
          add(y + 0.3, (ctx) => {
            box(ctx, px + 7, py + 10, T - 14, 10, 4, c.frame, seatTop);
            box(ctx, bx, py + 2, 6, 6, 18, c.frame);
            ctx.fillStyle = strip;
            ctx.fillRect(bx + 1, py + 10, 4, 10);
          });
        } else {
          add(y + 0.3, (ctx) => box(ctx, px + 6, py + 8, T - 12, 12, 3, c.frame, seatTop));
          // El respaldo queda del lado sur y tapa las piernas de quien se sienta.
          add(y + 0.95, (ctx) => {
            box(ctx, px + 5, py + 18, T - 10, 4, 9, c.frame);
            ctx.fillStyle = strip;
            ctx.fillRect(px + 8, py + 23, T - 16, 3);
          });
        }
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
          frame(ctx, px + 3, py + 4, w * T - 6, d * T - 8, "#c9c4b8");
          ctx.fillStyle = "#6cc4f0";
          ctx.fillRect(px + 8, py + 9, w * T - 16, d * T - 18);
          const r = Math.floor(((t / 600) % 1) * 10);
          ctx.strokeStyle = `rgba(255,255,255,${0.7 - r / 15})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx - 3 - r, py + (d * T) / 2 - 3 - r / 2, 6 + r * 2, 6 + r);
          frame(ctx, cx - 3, py + (d * T) / 2 - 16, 6, 14, "#d6d2c6");
          ctx.fillStyle = "#a5dcf5";
          ctx.fillRect(cx - 1, py + (d * T) / 2 - 22, 2, 7);
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
          frame(ctx, cx - 6, base - 40, 12, 14, "#93c5fd");
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
      case "neonpath": {
        // Camino de luz fijo en el piso.
        const color = f.color ?? "#22d3ee";
        const vertical = d > w;
        add(-1000, (ctx) => {
          ctx.fillStyle = "rgba(22,22,29,0.1)";
          ctx.fillRect(px + 4, py + 4, w * T - 8, d * T - 8);
          ctx.fillStyle = color;
          if (vertical) {
            ctx.fillRect(px + 6, py, 2, d * T);
            ctx.fillRect(px + w * T - 8, py, 2, d * T);
          } else {
            ctx.fillRect(px, py + 6, w * T, 2);
            ctx.fillRect(px, py + d * T - 8, w * T, 2);
          }
        });
        break;
      }
      case "hologram": {
        // Base baja con anillo de luz y un holograma que gira y flota sobre ella.
        add(y + d, (ctx, t) => {
          const by = py + d * T - 10;
          frame(ctx, px + 10, by - 10, w * T - 20, 12, "#1f2937");
          ctx.fillStyle = `hsl(${(t / 15) % 360}, 90%, 60%)`;
          ctx.fillRect(px + 14, by - 7, w * T - 28, 3);
          const float = Math.sin(t / 450) * 4;
          const top = by - 58 + float;
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = "#22d3ee";
          ctx.beginPath();
          ctx.moveTo(px + 14, by - 9);
          ctx.lineTo(px + w * T - 14, by - 9);
          ctx.lineTo(cx + 14, top + 10);
          ctx.lineTo(cx - 14, top + 10);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.9;
          ctx.translate(cx, top + 14);
          ctx.rotate(t / 900);
          ctx.strokeStyle = "#67e8f9";
          ctx.lineWidth = 2;
          ctx.strokeRect(-11, -11, 22, 22);
          ctx.rotate(Math.PI / 4);
          ctx.strokeStyle = "#f0abfc";
          ctx.strokeRect(-7, -7, 14, 14);
          ctx.restore();
          // Líneas de barrido del holograma.
          ctx.fillStyle = "rgba(103,232,249,0.5)";
          const scan = (t / 25) % 40;
          ctx.fillRect(cx - 14, top + scan - 6, 28, 1);
        });
        break;
      }
      case "ledpillar": {
        add(y + 1, (ctx, t) => {
          shadowUnder(ctx, cx, base - 3, 10);
          frame(ctx, cx - 7, base - 58, 14, 56, "#1f2937");
          for (let k = 0; k < 6; k++) {
            const hue = (t / 20 + k * 40 + x * 30) % 360;
            ctx.fillStyle = `hsl(${hue}, 90%, 62%)`;
            ctx.fillRect(cx - 5, base - 55 + k * 9, 10, 6);
          }
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(cx - 9, base - 61, 18, 4);
        });
        break;
      }
      case "robot": {
        add(y + 1, (ctx, t) => {
          const bob = Math.round(Math.sin(t / 350 + x) * 1.5);
          shadowUnder(ctx, cx, base - 3, 9);
          frame(ctx, cx - 8, base - 22 + bob, 16, 16, "#e5e7eb");
          frame(ctx, cx - 7, base - 36 + bob, 14, 12, "#f9fafb");
          ctx.fillStyle = "#1f2937";
          ctx.fillRect(cx - 5, base - 33 + bob, 10, 6);
          const blink = Math.floor(t / 1600 + x) % 4 === 0 && t % 1600 < 140;
          ctx.fillStyle = "#22d3ee";
          if (!blink) {
            ctx.fillRect(cx - 4, base - 31 + bob, 3, 3);
            ctx.fillRect(cx + 1, base - 31 + bob, 3, 3);
          }
          ctx.fillStyle = "#ff5c39";
          ctx.fillRect(cx - 1, base - 41 + bob, 2, 5);
          ctx.fillStyle = "#2f6bff";
          ctx.fillRect(cx - 4, base - 17 + bob, 8, 4);
          ctx.fillStyle = "#9ca3af";
          ctx.fillRect(cx - 7, base - 6, 5, 4);
          ctx.fillRect(cx + 2, base - 6, 5, 4);
        });
        break;
      }
      case "sculpture":
        add(y + d, (ctx) => {
          shadowUnder(ctx, cx, base - 3, (w * T) / 2 - 4);
          frame(ctx, cx - 14, base - 14, 28, 10, "#d9d4cb");
          frame(ctx, cx - 10, base - 36, 9, 22, "#f8f6f2");
          frame(ctx, cx - 2, base - 48, 9, 34, "#ff5c39");
          frame(ctx, cx + 6, base - 28, 7, 14, "#2f6bff");
        });
        break;
      case "pingpong":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 2, (w * T) / 2);
          box(ctx, px + 2, py + 6, w * T - 4, 16, 5, "#1d4ed8", "#2563eb");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 2, py + 13, w * T - 4, 1);
          ctx.fillRect(cx - 1, py + 4, 2, 20);
          ctx.fillStyle = "#ff5c39";
          ctx.fillRect(px + 8, py + 9, 4, 4);
        });
        break;
      case "foosball":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 2, (w * T) / 2);
          box(ctx, px + 2, py + 4, w * T - 4, 18, 8, "#7a4f2c", "#2f8a4a");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(cx - 1, py + 4, 2, 18);
          for (let rx = px + 10; rx < px + w * T - 6; rx += 12) {
            ctx.fillStyle = "#9ca3af";
            ctx.fillRect(rx, py + 2, 2, 22);
            ctx.fillStyle = rx < cx ? "#ef4444" : "#2f6bff";
            ctx.fillRect(rx - 2, py + 10, 6, 4);
          }
        });
        break;
      case "cafetable":
        // Mesa de café con dos banquetas.
        add(y + 1, (ctx) => {
          for (const sx of [px + 2, px + w * T - 12]) {
            shadowUnder(ctx, sx + 5, py + 26, 6);
            box(ctx, sx, py + 16, 10, 6, 4, "#3a3f4d", map.style === "minimal" ? "#e9e4dc" : "#c18a55");
          }
          shadowUnder(ctx, cx, py + 26, (w * T) / 2 - 8);
          box(ctx, px + 8, py + 6, w * T - 16, 12, 4, "#e9e4dc", map.style === "medieval" || map.style === "rustic" ? "#a8713f" : "#f4f1ea");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 14, py + 8, 6, 5);
          ctx.fillStyle = "#8a5a32";
          ctx.fillRect(px + 15, py + 9, 4, 2);
          ctx.fillStyle = "#ffb703";
          ctx.fillRect(px + w * T - 22, py + 9, 6, 4);
        });
        break;
      case "parasol":
        // Mesa con sombrilla: la tela va por encima de quien se sienta cerca.
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, py + 28, (w * T) / 2 - 2);
          box(ctx, cx - 10, py + 12, 20, 10, 4, "#e9e4dc", "#f4f1ea");
          ctx.fillStyle = "#6b7280";
          ctx.fillRect(cx - 1, py - 14, 2, 26);
        });
        add(y + 1.2, (ctx) => {
          const colors = ["#ff5c39", "#ffffff"];
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = colors[i % 2]!;
            ctx.fillRect(cx - 24 + i * 8, py - 22, 8, 10);
          }
          ctx.fillStyle = "rgba(22,22,29,0.35)";
          ctx.fillRect(cx - 24, py - 13, 48, 2);
        });
        break;
      case "eventscreen":
        // Pantalla gigante del lobby con el logo del evento.
        add(y + 1, (ctx, t) => {
          const m = media?.() ?? { sponsors: [], title: "" };
          const sw = w * T;
          shadowUnder(ctx, cx, base - 3, sw / 2 - 6);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(px + 16, base - 18, 6, 15);
          ctx.fillRect(px + sw - 22, base - 18, 6, 15);
          frame(ctx, px, base - 96, sw, 80, "#16161d");
          const sx = px + 5;
          const sy = base - 91;
          const iw = sw - 10;
          const ih = 70;
          const g = ctx.createLinearGradient(sx, sy, sx + iw, sy + ih);
          g.addColorStop(0, "#1e1b4b");
          g.addColorStop(1, "#0f172a");
          ctx.fillStyle = g;
          ctx.fillRect(sx, sy, iw, ih);
          const img = m.logoUrl ? logoImage(m.logoUrl) : null;
          if (img) {
            const scale = Math.min((iw - 16) / img.naturalWidth, (ih - 12) / img.naturalHeight);
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(img, sx + (iw - img.naturalWidth * scale) / 2, sy + (ih - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
            ctx.imageSmoothingEnabled = false;
          } else {
            ctx.fillStyle = "#ffffff";
            ctx.font = `700 ${sw > 200 ? 18 : 14}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.fillText(m.title.toUpperCase(), sx + iw / 2, sy + ih / 2 + 2, iw - 16);
            ctx.font = `600 9px ${FONT}`;
            ctx.fillStyle = "#ffb703";
            ctx.fillText("BIENVENIDOS", sx + iw / 2, sy + ih / 2 + 18);
            ctx.textAlign = "left";
          }
          // Brillo que recorre la pantalla de vez en cuando.
          const sweep = (t / 12) % (iw * 3);
          if (sweep < iw) {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            ctx.fillRect(sx + sweep, sy, 18, ih);
          }
          ctx.fillStyle = "#ff5c39";
          ctx.fillRect(sx, sy + ih - 3, iw, 3);
        });
        break;
      case "signpost": {
        // Poste con carteles: una línea por destino, con su flecha.
        const lines = (f.label ?? "").split("|");
        add(y + 1, (ctx) => {
          ctx.font = `700 9px ${FONT}`;
          const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
          const bh = lines.length * 14 + 6;
          shadowUnder(ctx, cx, base - 3, 8);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(cx - 2, base - 30, 4, 27);
          const top = base - 30 - bh;
          ctx.fillStyle = "#16161d";
          ctx.fillRect(cx - bw / 2 - 2, top - 2, bw + 4, bh + 4);
          lines.forEach((l, i) => {
            ctx.fillStyle = ["#ff5c39", "#2f6bff", "#10b981", "#a78bfa", "#f59e0b"][i % 5]!;
            ctx.fillRect(cx - bw / 2, top + 3 + i * 14, 3, 11);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(l, cx - bw / 2 + 7, top + 12 + i * 14);
          });
        });
        break;
      }
      case "frontdesk":
        // Mostrador de recepción: cubierta blanca, frente grafito con línea de luz, el logo y monitores.
        add(y + 1, (ctx) => {
          const dw = w * T;
          shadowUnder(ctx, px + dw / 2, py + T + 4, dw / 2);
          box(ctx, px, py - 4, dw, 12, 30, "#262a34", "#f8f8f6");
          ctx.fillStyle = "#c8a46a";
          ctx.fillRect(px, py + 8, dw, 2);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(px + 6, py + 34, dw - 12, 2);
          ctx.fillStyle = "rgba(34,211,238,0.22)";
          ctx.fillRect(px + 6, py + 29, dw - 12, 5);
          // Logo: cuatro cuadrados y el nombre.
          const lx = px + dw / 2 - 62;
          const ly = py + 14;
          for (const [dx, dy, c] of [
            [0, 0, "#ff5c39"],
            [7, 0, "#fbbf24"],
            [0, 7, "#2f6bff"],
            [7, 7, "#ffffff"],
          ] as const) {
            ctx.fillStyle = c;
            ctx.fillRect(lx + dx, ly + dy, 6, 6);
          }
          ctx.font = `700 12px ${FONT}`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText("MyConferences", lx + 19, ly + 11);
          // Monitores sobre la cubierta.
          for (const k of [0.15, 0.38, 0.62, 0.85]) {
            const mx = px + dw * k;
            frame(ctx, mx - 10, py - 18, 20, 12, "#1f2433");
            ctx.fillStyle = "#7dd3fc";
            ctx.fillRect(mx - 8, py - 16, 16, 8);
            ctx.fillStyle = "#3a3f4d";
            ctx.fillRect(mx - 2, py - 6, 4, 3);
          }
        });
        break;
      case "stanchion":
        // Dos postes cromados unidos por un cordón rojo, para ordenar la fila.
        add(y + d, (ctx) => {
          const top = py + 12;
          const bottom = (y + d) * T - 4;
          ctx.strokeStyle = "#b91c1c";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, top - 16);
          ctx.quadraticCurveTo(cx + 4, (top + bottom) / 2 - 12, cx, bottom - 16);
          ctx.stroke();
          for (const yy of [top, bottom]) {
            ctx.fillStyle = "#64748b";
            ctx.fillRect(cx - 5, yy, 10, 3);
            ctx.fillStyle = "#cbd5e1";
            ctx.fillRect(cx - 1.5, yy - 20, 3, 20);
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(cx - 3, yy - 22, 6, 3);
          }
        });
        break;
      case "countdown":
        // Pantalla gigante con la cuenta regresiva del hackathon.
        add(y + 1, (ctx, t) => {
          const sw = w * T;
          shadowUnder(ctx, cx, base - 3, sw / 2 - 6);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(px + 16, base - 18, 6, 15);
          ctx.fillRect(px + sw - 22, base - 18, 6, 15);
          frame(ctx, px, base - 96, sw, 80, "#0b1020");
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(px + 5, base - 91, sw - 10, 70);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(px + 5, base - 91, sw - 10, 2);
          ctx.fillStyle = "#f472b6";
          ctx.fillRect(px + 5, base - 23, sw - 10, 2);
          const left = Math.max(0, 48 * 3600 - Math.floor(t / 1000) % (48 * 3600));
          const hh = String(Math.floor(left / 3600)).padStart(2, "0");
          const mm = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
          const ss = String(left % 60).padStart(2, "0");
          ctx.textAlign = "center";
          ctx.font = `700 9px ${FONT}`;
          ctx.fillStyle = "#94a3b8";
          ctx.fillText("TIEMPO RESTANTE", cx, base - 74);
          ctx.font = `700 26px ${FONT}`;
          ctx.fillStyle = "#22d3ee";
          ctx.fillText(`${hh}:${mm}:${ss}`, cx, base - 44);
          ctx.textAlign = "left";
        });
        break;
      case "rocket":
        // Cohete a escala sobre un pedestal.
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 12);
          box(ctx, cx - 11, base - 14, 22, 4, 9, "#2a2a33", "#3a3a45");
          ctx.fillStyle = "#fdda24";
          ctx.fillRect(cx - 11, base - 6, 22, 2);
          // Aletas, cuerpo y ventanilla.
          ctx.fillStyle = "#e5484d";
          ctx.fillRect(cx - 10, base - 26, 5, 12);
          ctx.fillRect(cx + 5, base - 26, 5, 12);
          frame(ctx, cx - 5, base - 52, 10, 38, "#f4f4f5");
          ctx.fillStyle = "#e5484d";
          ctx.beginPath();
          ctx.moveTo(cx - 5, base - 52);
          ctx.lineTo(cx, base - 62);
          ctx.lineTo(cx + 5, base - 52);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#2f6bff";
          ctx.fillRect(cx - 3, base - 44, 6, 6);
          ctx.fillStyle = "#fdda24";
          ctx.fillRect(cx - 3, base - 18, 6, 3);
        });
        break;
      case "constellation":
        // Columna con nodos de luz unidos: la red.
        add(y + 1, (ctx, t) => {
          shadowUnder(ctx, cx, base - 3, 9);
          frame(ctx, cx - 4, base - 54, 8, 50, "#16161d");
          const nodes = [
            [-10, -58],
            [8, -66],
            [12, -48],
            [-8, -40],
            [0, -74],
          ] as const;
          ctx.strokeStyle = "rgba(253,218,36,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          nodes.forEach(([dx, dy], i) => (i ? ctx.lineTo(cx + dx, base + dy) : ctx.moveTo(cx + dx, base + dy)));
          ctx.stroke();
          nodes.forEach(([dx, dy], i) => {
            const on = (Math.floor(t / 400) + i) % 5 !== 0;
            ctx.fillStyle = on ? "#fdda24" : "#ffffff";
            ctx.fillRect(cx + dx - 2, base + dy - 2, 4, 4);
          });
        });
        break;
      case "partition":
        // Mampara de vidrio: marco fino y vidrio celeste translúcido.
        add(y + d, (ctx) => {
          const pw = w * T;
          const ph = d * T;
          if (w >= d) {
            ctx.fillStyle = "rgba(186,230,253,0.45)";
            ctx.fillRect(px, py + ph - 30, pw, 26);
            ctx.fillStyle = "#64748b";
            ctx.fillRect(px, py + ph - 32, pw, 2);
            ctx.fillRect(px, py + ph - 5, pw, 2);
            for (let i = 0; i <= w; i++) ctx.fillRect(px + i * T - (i === w ? 2 : 0), py + ph - 32, 2, 29);
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.fillRect(px + 6, py + ph - 26, 3, 18);
          } else {
            ctx.fillStyle = "rgba(186,230,253,0.45)";
            ctx.fillRect(px + 12, py - 20, 8, ph + 16);
            ctx.fillStyle = "#64748b";
            ctx.fillRect(px + 11, py - 22, 2, ph + 18);
            ctx.fillRect(px + 19, py - 22, 2, ph + 18);
          }
        });
        break;
      case "booth": {
        // Stand de un patrocinador: panel en la pared, dos roll-ups y el mostrador con su logo.
        // Sin patrocinador: un puesto vacío, gris, que dice «espacio disponible».
        const empty = f.n === undefined;
        const n = f.n ?? 0;
        const color = empty ? "#9aa5b1" : BOOTH_COLORS[n % BOOTH_COLORS.length]!;
        const sponsor = () => {
          if (empty) return { id: "libre", name: "Espacio disponible", logoUrl: "", url: null, pitch: "" };
          const m = media?.();
          return (m?.stands ?? m?.sponsors)?.[n] ?? null;
        };
        const sw = 3 * T;
        add(y - 0.5, (ctx) => {
          const sp = sponsor();
          frame(ctx, px + 2, py - 2 * T + 6, sw - 4, 2 * T - 2, "#ffffff");
          ctx.fillStyle = color;
          ctx.fillRect(px + 2, py - 2 * T + 6, sw - 4, 8);
          ctx.fillRect(px + 2, py - 6, sw - 4, 4);
          // Logo y nombre arriba, por encima de la cabeza de quien atiende.
          if (sp) logoIn(ctx, sp, px + 10, py - 2 * T + 16, sw - 20, 16);
          ctx.fillStyle = "#16161d";
          ctx.font = `700 8px ${FONT}`;
          ctx.textAlign = "center";
          ctx.fillText((sp?.name ?? "").toUpperCase(), px + sw / 2, py - 2 * T + 41, sw - 12);
          ctx.textAlign = "left";
        });
        // Un roll-up al medio; a los costados se paran las dos personas que atienden.
        for (const rx of [cx - 10]) {
          add(y + 0.9, (ctx) => {
            const sp = sponsor();
            const b = py + T - 2;
            shadowUnder(ctx, rx + 10, b, 12);
            ctx.fillStyle = "#3a3f4d";
            ctx.fillRect(rx - 1, b - 4, 22, 4);
            frame(ctx, rx, b - 62, 20, 58, "#ffffff");
            ctx.fillStyle = color;
            ctx.fillRect(rx, b - 62, 20, 6);
            ctx.fillRect(rx, b - 18, 20, 14);
            if (sp) logoIn(ctx, sp, rx + 2, b - 50, 16, 26);
          });
        }
        add(y + 1.9, (ctx) => {
          const sp = sponsor();
          const top = py + T + 4;
          shadowUnder(ctx, cx, top + 26, sw / 2 - 4);
          box(ctx, px + 4, top, sw - 8, 8, 18, color, "#f4f1ea");
          frame(ctx, cx - 20, top + 10, 40, 14, "#ffffff");
          if (sp) logoIn(ctx, sp, cx - 18, top + 11, 36, 12);
        });
        break;
      }
      case "crenel":
        // Almena de piedra en el borde de la azotea.
        add(y + 1, (ctx) => {
          box(ctx, px + 2, py + 2, T - 4, 10, 18, "#a8a3b2", "#bcb7c6");
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.fillRect(px + 2, py + 20, T - 4, 1);
        });
        break;
      case "telescope":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 8);
          ctx.fillStyle = "#5a3a22";
          ctx.fillRect(cx - 7, base - 18, 2, 15);
          ctx.fillRect(cx + 5, base - 18, 2, 15);
          ctx.fillRect(cx - 1, base - 18, 2, 15);
          frame(ctx, cx - 4, base - 30, 18, 7, "#c9993a");
          ctx.fillStyle = "#1d1b26";
          ctx.fillRect(cx + 12, base - 29, 2, 5);
        });
        break;
      case "chess":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, (w * T) / 2 - 4);
          box(ctx, px + 4, py + 6, w * T - 8, 16, 6, "#7a4f2c", "#a8713f");
          const bs = 12;
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
              ctx.fillStyle = (r + c) % 2 ? "#3a2a22" : "#f1e6c8";
              ctx.fillRect(cx - bs + c * 6, py + 8 + r * 3, 6, 3);
            }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(cx - 9, py + 4, 3, 5);
          ctx.fillStyle = "#1d1b26";
          ctx.fillRect(cx + 5, py + 4, 3, 5);
        });
        break;
      case "directory":
        add(y + 1, (ctx) => {
          shadowUnder(ctx, cx, base - 3, 12);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(cx - 3, base - 12, 6, 9);
          ctx.fillRect(cx - 10, base - 5, 20, 3);
          frame(ctx, cx - 14, base - 50, 28, 39, "#16161d");
          ctx.fillStyle = "#f6f5f2";
          ctx.fillRect(cx - 12, base - 48, 24, 35);
          // Mini plano con caminos de colores.
          ctx.fillStyle = "#ff5c39";
          ctx.fillRect(cx - 9, base - 30, 18, 3);
          ctx.fillStyle = "#2f6bff";
          ctx.fillRect(cx - 2, base - 44, 3, 17);
          ctx.fillStyle = "#16161d";
          ctx.fillRect(cx - 10, base - 22, 20, 7);
          ctx.fillStyle = "#ffffff";
          ctx.font = `700 6px ${FONT}`;
          ctx.textAlign = "center";
          ctx.fillText("SALAS", cx, base - 16.5);
          ctx.textAlign = "left";
        });
        break;
      case "totem": {
        const slot = 10 + x;
        add(y + 1, (ctx, t) => {
          shadowUnder(ctx, cx, base - 3, 12);
          ctx.fillStyle = "#3a3f4d";
          ctx.fillRect(cx - 2, base - 12, 4, 9);
          ctx.fillRect(cx - 9, base - 5, 18, 3);
          frame(ctx, cx - 14, base - 48, 28, 37, "#1f2433");
          sponsorSlide(ctx, cx - 12, base - 46, 24, 33, media?.() ?? { sponsors: [], title: "" }, t, slot);
        });
        break;
      }
      case "rug":
      case "carpet":
        break;
    }
  }
  return out;
}

// ---------- Textos sobre el mapa ----------

export interface DoorStatus {
  live: boolean;
  count: number;
  /** Charla en curso o la próxima, y su horario ("10:00–10:45"). */
  title: string;
  time: string;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Placa de una sala: nombre, charla y horario. Va sobre el muro, nunca en el pasillo. */
function doorPlate(ctx: CanvasRenderingContext2D, cx: number, y: number, door: Door, s: DoorStatus | undefined, hovered: boolean) {
  const width = door.w * T + 52;
  const x = Math.round(cx - width / 2);
  const h = 30;
  ctx.fillStyle = "#16161d";
  ctx.fillRect(x - 1, y - 1, width + 2, h + 2);
  ctx.fillStyle = hovered ? "#2a2a36" : "#20202a";
  ctx.fillRect(x, y, width, h);
  ctx.fillStyle = door.color;
  ctx.fillRect(x, y, 4, h);
  ctx.font = `700 9px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  // 🎤: es una sala de charlas, no un espacio para pasar el rato.
  let name = `🎤 ${door.label}`;
  if (s?.count) name += ` · ${s.count}`;
  ctx.fillText(truncate(ctx, name, width - (s?.live ? 34 : 12)), x + 8, y + 11);
  if (s?.live) {
    ctx.fillStyle = "#ff5c39";
    ctx.fillRect(x + width - 26, y + 3, 23, 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 7px ${FONT}`;
    ctx.fillText("VIVO", x + width - 23, y + 10.5);
  }
  ctx.font = `500 8px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const line = s?.title ? `${s.time} ${s.title}` : "Sin charlas programadas";
  ctx.fillText(truncate(ctx, line, width - 12), x + 8, y + 24);
}

/** Marquesina con luces sobre la entrada del auditorio principal. */
function marquee(ctx: CanvasRenderingContext2D, door: Door, s: DoorStatus | undefined, t: number) {
  const cx = (door.x + door.w / 2) * T;
  const width = door.w * T + 120;
  const x = Math.round(cx - width / 2);
  const y = (door.y - 2) * T - 18;
  const h = 44;
  ctx.fillStyle = "#16161d";
  ctx.fillRect(x - 2, y - 2, width + 4, h + 4);
  ctx.fillStyle = door.color;
  ctx.fillRect(x, y, width, h);
  ctx.fillStyle = "#20202a";
  ctx.fillRect(x + 6, y + 6, width - 12, h - 12);
  // Bombillas alrededor, encendiéndose en secuencia.
  const bulbs = Math.floor(width / 10);
  for (let i = 0; i < bulbs; i++) {
    const on = (Math.floor(t / 180) + i) % 3 === 0;
    ctx.fillStyle = on ? "#fff3b0" : "#c9a227";
    ctx.fillRect(x + 3 + i * 10, y + 1, 4, 4);
    ctx.fillRect(x + 3 + i * 10, y + h - 5, 4, 4);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText(door.label.toUpperCase(), cx, y + 21, width - 24);
  ctx.font = `500 8px ${FONT}`;
  ctx.fillStyle = s?.live ? "#ffd6c9" : "rgba(255,255,255,0.75)";
  const line = s?.title ? `${s.live ? "● EN VIVO · " : ""}${s.time} ${s.title}` : "Auditorio principal";
  ctx.fillText(truncate(ctx, line, width - 24), cx, y + 33);
  ctx.textAlign = "left";
}

/** Placas de las salas, marquesina del auditorio y la etiqueta de la salida. */
export function drawPlaques(ctx: CanvasRenderingContext2D, map: SceneMap, status: Map<string, DoorStatus> | null, hovered: string | null, t: number) {
  for (const door of map.doors) {
    if (door.id === "salida") continue;
    const s = status?.get(door.id);
    if (door.main) {
      marquee(ctx, door, s, t);
      continue;
    }
    // Arriba: sobre el muro, encima de la cara. Abajo: sobre el muro sur, debajo del vano.
    // En los muros laterales, sobre el techo del edificio de la sala.
    if (door.side === "top") doorPlate(ctx, (door.x + door.w / 2) * T, (door.y - 2) * T - 4, door, s, door.id === hovered);
    else if (door.side === "bottom") doorPlate(ctx, (door.x + door.w / 2) * T, (door.y + 1) * T + 1, door, s, door.id === hovered);
    else doorPlate(ctx, (door.side === "left" ? door.x - 2.5 : door.x + 3.5) * T, (door.y + 3) * T - 36, door, s, door.id === hovered);
  }
  // Salas todavía cerradas: oscurecidas, con un cartel que dice cuándo se habilitan.
  for (const c of map.closed) {
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.fillRect(c.x * T, (c.y - 2) * T, c.w * T, (c.h + 2) * T);
    ctx.font = `700 13px ${FONT}`;
    const width = ctx.measureText(c.label).width + 28;
    const cx = (c.x + c.w / 2) * T;
    const cy = (c.y + c.h / 2) * T;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(cx - width / 2, cy - 18, width, 36);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(cx - width / 2, cy - 18, width, 2);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`🔒 ${c.label}`, cx, cy + 5);
    ctx.textAlign = "left";
  }
  // Nombre de cada cuarto sobre su puerta, como una placa.
  for (const d of map.decor) {
    if (d.kind !== "roomdoor") continue;
    ctx.font = `700 12px ${FONT}`;
    const text = d.text ?? "";
    const width = ctx.measureText(text).width + 22;
    const cx = (d.x + (d.w ?? 2) / 2) * T;
    const y = (d.y - 2) * T - 18;
    ctx.fillStyle = "#16161d";
    ctx.fillRect(cx - width / 2 - 2, y - 2, width + 4, 26);
    ctx.fillStyle = d.color ?? "#2f6bff";
    ctx.fillRect(cx - width / 2, y, 5, 22);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(text, cx + 2, y + 15);
    ctx.textAlign = "left";
  }
  // Cartel de cada mesa de equipo, en su esquina.
  for (const z of map.zones) {
    if (z.id.startsWith("stand-") || z.room) continue;
    ctx.font = `700 9px ${FONT}`;
    const text = `${z.label} · hasta ${z.seats}`;
    const width = ctx.measureText(text).width + 12;
    const x = z.x * T + 6;
    const y = z.y * T + 6;
    ctx.fillStyle = z.color;
    ctx.fillRect(x, y, width, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x + 6, y + 10);
  }
  // Cartel amarillo y grande sobre cada ascensor o escalera, para que se vea desde lejos.
  for (const st of map.stairs) {
    const label = `${st.dir === "up" ? "▲" : "▼"} ${st.label}`;
    ctx.font = `700 11px ${FONT}`;
    const width = ctx.measureText(label).width + 18;
    const cx = (st.x + st.w / 2) * T;
    const y = (st.y - 2) * T - 22;
    ctx.fillStyle = "#16161d";
    ctx.fillRect(cx - width / 2 - 2, y - 2, width + 4, 22);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(cx - width / 2, y, width, 18);
    ctx.fillStyle = "#16161d";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, y + 13);
    ctx.textAlign = "left";
  }
  const exits: { cx: number; y: number; label: string }[] = [
    ...[...(map.exit ? [{ ...map.exit, label: "Salida a recepción" }] : []), ...map.doors.filter((d) => d.id === "salida").map((d) => ({ ...d, label: "Salida" }))].map((e) => {
      const tiles = spanTiles(e);
      return { cx: ((tiles[0]!.x + tiles[tiles.length - 1]!.x + 1) / 2) * T, y: e.y * T - 14, label: e.label };
    }),
  ];
  for (const e of exits) {
    const { cx, y } = e;
    ctx.font = `700 9px ${FONT}`;
    const width = ctx.measureText(e.label).width + 14;
    ctx.fillStyle = "#16161d";
    ctx.fillRect(cx - width / 2, y, width, 13);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(e.label, cx, y + 9.5);
    ctx.textAlign = "left";
  }
}

// ---------- Patrocinadores ----------

const logoCache = new Map<string, HTMLImageElement>();

/** Imagen del logo, o null mientras carga. */
function logoImage(url: string) {
  let img = logoCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    logoCache.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export interface Media {
  sponsors: Sponsor[];
  /** Texto para las pantallas cuando el evento no tiene patrocinadores. */
  title: string;
  /** Logo del evento para la pantalla grande del lobby. */
  logoUrl?: string | null;
  /** Quién atiende cada stand (los patrocinadores y el organizador). */
  stands?: Sponsor[];
}

/** Colores de los stands, para que cada patrocinador se distinga. */
const BOOTH_COLORS = ["#2f6bff", "#ff5c39", "#10b981", "#a78bfa", "#f59e0b", "#ef476f"];

/** Logo de un patrocinador ajustado a un rectángulo (o su nombre mientras carga). */
function logoIn(ctx: CanvasRenderingContext2D, sponsor: Sponsor, x: number, y: number, w: number, h: number) {
  const img = logoImage(sponsor.logoUrl);
  if (img) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x + (w - img.naturalWidth * scale) / 2, y + (h - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.imageSmoothingEnabled = false;
    return;
  }
  ctx.fillStyle = "#16161d";
  ctx.font = `700 ${Math.min(10, h - 2)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(sponsor.name, x + w / 2, y + h / 2 + 3, w);
  ctx.textAlign = "left";
}

const SLIDE_MS = 5000;

/** Pinta en un rectángulo el logo que toca según el tiempo, con un fundido suave entre logos. */
function sponsorSlide(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, media: Media, t: number, slot: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  if (!media.sponsors.length) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#5b5bf0");
    g.addColorStop(1, "#06c38d");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${w > 80 ? 11 : 8}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(media.title, x + w / 2, y + h / 2 + 4, w - 8);
    ctx.textAlign = "left";
    return;
  }
  const n = media.sponsors.length;
  const index = (Math.floor(t / SLIDE_MS) + slot) % n;
  const sponsor = media.sponsors[index]!;
  const img = logoImage(sponsor.logoUrl);
  const into = t % SLIDE_MS;
  ctx.save();
  ctx.globalAlpha = Math.min(1, into / 350);
  if (img) {
    const pad = 4;
    const scale = Math.min((w - pad * 2) / img.naturalWidth, (h - pad * 2) / img.naturalHeight);
    const iw = img.naturalWidth * scale;
    const ih = img.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.imageSmoothingEnabled = false;
  } else {
    ctx.fillStyle = "#1f2433";
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(sponsor.name, x + w / 2, y + h / 2 + 3, w - 6);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/** Pantallas de patrocinadores en el muro del fondo. */
export function drawSponsorScreens(ctx: CanvasRenderingContext2D, map: SceneMap, media: Media, t: number) {
  map.decor
    .filter((d) => d.kind === "sponsors")
    .forEach((d, i) => atRow(ctx, d.y, () => {
      const x = d.x * T + 3;
      const w = (d.w ?? 2) * T - 6;
      sponsorSlide(ctx, x, T + 6, w, 2 * T - 16, media, t, i);
      if (media.sponsors.length && w > 80) {
        ctx.font = `700 7px ${FONT}`;
        ctx.fillStyle = "rgba(31,36,51,0.55)";
        ctx.textAlign = "center";
        ctx.fillText("PATROCINADORES", x + w / 2, 3 * T - 12);
        ctx.textAlign = "left";
      }
    }));
}


/** Contenido de la pantalla de la sala: título de la charla y si está en vivo. */
export function drawScreenContent(ctx: CanvasRenderingContext2D, map: SceneMap, color: string, title: string, live: boolean) {
  const d = map.decor.find((x) => x.kind === "screen");
  if (!d) return;
  atRow(ctx, d.y, () => screenContent(ctx, d, color, title, live));
}

function screenContent(ctx: CanvasRenderingContext2D, d: Decor, color: string, title: string, live: boolean) {
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
  ctx.fillStyle = mine ? "rgba(255, 92, 57, 0.95)" : "rgba(22, 22, 29, 0.75)";
  ctx.beginPath();
  ctx.rect(x - w / 2, y - 7, w, 14);
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
  ctx.rect(bx + 1, by + 2, w, h);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.rect(bx, by, w, h);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 5, by + h - 0.5);
  ctx.lineTo(x, by + h + 6);
  ctx.lineTo(x + 5, by + h - 0.5);
  ctx.fill();
  ctx.fillStyle = "#ff5c39";
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText(name, bx + 8, by + 14);
  ctx.fillStyle = "#1f2433";
  ctx.font = `11px ${FONT}`;
  shown.forEach((l, i) => ctx.fillText(l, bx + 8, by + 28 + i * 14));
  ctx.restore();
}
