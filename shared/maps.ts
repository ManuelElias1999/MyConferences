// Mapas vistos desde arriba, al estilo Gather. Los usa el cliente para dibujar y
// caminar, y el servidor para saber dónde aparece cada persona.
//
// Terreno: "#" tope de muro, "=" cara de muro (la pared que se ve de frente), "." piso.

import { RECEPTIONIST_LOOK } from "./look.ts";
import type { ThemeId } from "./themes.ts";
import type { Look, Room } from "./types.ts";

export interface Tile {
  x: number;
  y: number;
}

export type Dir = "down" | "up" | "left" | "right";

/** Estilo visual de un mapa: los de sala más los de recepción y pasillos. */
export type StyleId = ThemeId | "cowork" | "lobby";

export type FurniKind =
  | "workdesk"
  | "officechair"
  | "sofa"
  | "armchair"
  | "coffeetable"
  | "beanbag"
  | "plant"
  | "bigplant"
  | "tree"
  | "flowerbed"
  | "counter"
  | "coffeebar"
  | "bookshelf"
  | "chair"
  | "lectern"
  | "rack"
  | "arcade"
  | "pingpong"
  | "lamp"
  | "barrel"
  | "lantern"
  | "armor"
  | "pillar"
  | "candelabra"
  | "fountain"
  | "kiosk"
  | "vending"
  | "cooler"
  | "bench"
  | "table"
  | "totem"
  | "rug"
  | "carpet";

export interface Furni {
  kind: FurniKind;
  x: number;
  y: number;
  w?: number;
  d?: number;
  color?: string;
  dir?: Dir;
}

/** Adornos pegados a la cara del muro norte; `x` es la primera columna que ocupan. */
export type DecorKind =
  | "window"
  | "neon"
  | "screen"
  | "art"
  | "whiteboard"
  | "clock"
  | "shelf"
  | "torch"
  | "banner"
  | "fireplace"
  | "ivy"
  | "sponsors"
  | "entrance";

export interface Decor {
  kind: DecorKind;
  x: number;
  w?: number;
  color?: string;
  text?: string;
  /** Solo para "entrance": la fila del muro sur en la que está. */
  y?: number;
}

export type Side = "top" | "bottom" | "left" | "right";

/** Tramo de baldosas sobre un muro: horizontal en "top"/"bottom", vertical en "left"/"right". */
export interface Span {
  side: Side;
  x: number;
  y: number;
  w: number;
}

export interface Door extends Span {
  id: string;
  label: string;
  color: string;
  theme: ThemeId;
}

export interface Stairs extends Span {
  to: number;
  label: string;
}

export interface Npc {
  id: string;
  name: string;
  look: Look;
  x: number;
  y: number;
  dir: Dir;
}

export interface Seat extends Tile {
  dir: Dir;
}

export interface SceneMap {
  w: number;
  h: number;
  tiles: string[];
  style: StyleId;
  spawn: Tile;
  furni: Furni[];
  decor: Decor[];
  doors: Door[];
  stairs: Stairs[];
  npcs: Npc[];
  seats: Seat[];
  /** Baldosas libres para quedarse de pie si no hay asientos. */
  standing: Tile[];
  /** Dónde se para el ponente. */
  podium: Tile | null;
  /** Salida que lleva de vuelta a recepción. */
  exit: Span | null;
  /** Baldosas desde las que se puede hablar con la recepcionista. */
  desk: Tile[];
  /** Letrero sobre el muro norte. */
  signs: { x: number; w: number; text: string }[];
  blocked: boolean[];
}

const FLAT: FurniKind[] = ["rug", "carpet", "chair", "officechair"];

export function spanTiles(s: Span): Tile[] {
  const vertical = s.side === "left" || s.side === "right";
  return Array.from({ length: s.w }, (_, i) => (vertical ? { x: s.x, y: s.y + i } : { x: s.x + i, y: s.y }));
}

export const onSpan = (t: Tile, s: Span) => spanTiles(s).some((p) => p.x === t.x && p.y === t.y);

/** Baldosa del piso justo delante de una puerta o escalera. */
export function inFront(s: Span): Tile {
  const off = { top: { x: 0, y: 1 }, bottom: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } }[s.side];
  return { x: s.x + off.x, y: s.y + off.y };
}

/** Recinto rectangular: tope de muro arriba, dos filas de cara de muro y muros laterales. */
function enclosure(w: number, h: number) {
  const rows: string[] = ["#".repeat(w)];
  for (let i = 0; i < 2; i++) rows.push(`#${"=".repeat(w - 2)}#`);
  for (let y = 3; y < h - 1; y++) rows.push(`#${".".repeat(w - 2)}#`);
  rows.push("#".repeat(w));
  return rows;
}

function finish(map: Omit<SceneMap, "blocked">): SceneMap {
  const blocked = new Array<boolean>(map.w * map.h).fill(false);
  map.tiles.forEach((row, y) => [...row].forEach((c, x) => (blocked[y * map.w + x] = c !== ".")));
  for (const f of map.furni) {
    if (FLAT.includes(f.kind)) continue;
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) blocked[(f.y + dy) * map.w + f.x + dx] = true;
  }
  for (const n of map.npcs) blocked[n.y * map.w + n.x] = true;
  // Puertas, escaleras y la salida se pueden pisar aunque estén en el muro.
  for (const s of [...map.doors, ...map.stairs, ...(map.exit ? [map.exit] : [])]) {
    for (const t of spanTiles(s)) blocked[t.y * map.w + t.x] = false;
  }
  return { ...map, blocked };
}

export const isWalkable = (map: SceneMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < map.w && y < map.h && !map.blocked[y * map.w + x];

export const sameTile = (a: Tile, b: Tile) => Math.round(a.x) === b.x && Math.round(a.y) === b.y;

const empty = { doors: [], stairs: [], npcs: [], seats: [], standing: [], podium: null, exit: null, desk: [], signs: [] };

// ---------- Recepción: un cowork tecnológico pequeño ----------

export const RECEPTIONIST_ID = "npc-recepcion";

export function receptionMap(): SceneMap {
  const w = 16;
  const h = 11;
  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: "cowork",
    spawn: { x: 7, y: 8 },
    furni: [
      { kind: "carpet", x: 7, y: 5, w: 2, d: 5, color: "#3d5a80" },
      // Mostrador en U: la recepcionista queda adentro, a tres pasos de la entrada.
      ...[5, 6, 7, 8, 9, 10].map((x) => ({ kind: "counter" as const, x, y: 4 })),
      { kind: "counter", x: 5, y: 3 },
      { kind: "counter", x: 10, y: 3 },
      { kind: "bigplant", x: 9, y: 3 },
      // Escritorios compartidos a la izquierda.
      { kind: "bookshelf", x: 1, y: 3 },
      { kind: "cooler", x: 3, y: 3 },
      { kind: "workdesk", x: 1, y: 6, w: 3 },
      { kind: "officechair", x: 1, y: 7 },
      { kind: "officechair", x: 2, y: 7 },
      { kind: "officechair", x: 3, y: 7 },
      { kind: "bigplant", x: 1, y: 9 },
      { kind: "arcade", x: 4, y: 9 },
      // Café y sala de estar a la derecha.
      { kind: "coffeebar", x: 11, y: 3, w: 3 },
      { kind: "vending", x: 14, y: 3 },
      { kind: "rug", x: 11, y: 5, w: 4, d: 4, color: "#f2c6a0" },
      { kind: "sofa", x: 11, y: 5, w: 3, color: "#5b7fd6", dir: "down" },
      { kind: "coffeetable", x: 11, y: 7, w: 2 },
      { kind: "beanbag", x: 14, y: 7, color: "#ffd166" },
      { kind: "bigplant", x: 14, y: 9 },
    ],
    decor: [
      { kind: "window", x: 1, w: 3 },
      { kind: "neon", x: 5, w: 6, text: "MyConferences", color: "#22d3ee" },
      { kind: "clock", x: 11 },
      { kind: "art", x: 12, w: 2, color: "#ef476f" },
      { kind: "entrance", x: 7, w: 2, y: h - 1 },
    ],
    npcs: [{ id: RECEPTIONIST_ID, name: "Recepcionista", look: RECEPTIONIST_LOOK, x: 7, y: 3, dir: "down" }],
    desk: [6, 7, 8, 9].map((x) => ({ x, y: 5 })),
  });
}

// ---------- Lugar del evento ----------

const FLOOR_W = 22;
const FLOOR_H = 12;
/** Puertas en el muro del fondo; al centro va la pantalla de patrocinadores. */
const DOOR_SLOTS = [2, 6, 14, 18];
const EXIT_X = 10;

export function floorCount(rooms: number) {
  return Math.max(1, Math.ceil(rooms / DOOR_SLOTS.length));
}

export const floorName = (floor: number) => (floor === 0 ? "Planta baja" : `Piso ${floor}`);

const CARPET: Record<ThemeId, string> = { tech: "#1e3a5f", minimal: "#d6d3cd", rustic: "#8e3b2f", medieval: "#9b2335", garden: "#c9b48a" };

/** Muebles y adornos propios de cada estilo para los pasillos del evento. */
function lobbyDecor(theme: ThemeId): { furni: Furni[]; decor: Decor[] } {
  switch (theme) {
    case "tech":
      return {
        furni: [
          { kind: "rack", x: 1, y: 3 },
          { kind: "rack", x: 20, y: 3 },
          { kind: "kiosk", x: 1, y: 8 },
          { kind: "beanbag", x: 4, y: 9, color: "#22d3ee" },
          { kind: "beanbag", x: 17, y: 9, color: "#f472b6" },
          { kind: "arcade", x: 20, y: 8 },
        ],
        decor: [
          { kind: "neon", x: 4, w: 2, text: "</>", color: "#22d3ee" },
          { kind: "neon", x: 16, w: 2, text: "AI", color: "#f472b6" },
        ],
      };
    case "minimal":
      return {
        furni: [
          { kind: "bigplant", x: 1, y: 3 },
          { kind: "bigplant", x: 20, y: 3 },
          { kind: "lamp", x: 1, y: 8 },
          { kind: "lamp", x: 20, y: 8 },
          { kind: "bench", x: 3, y: 9, w: 3 },
          { kind: "bench", x: 16, y: 9, w: 3 },
        ],
        decor: [
          { kind: "art", x: 4, w: 2, color: "#e9b8a4" },
          { kind: "art", x: 16, w: 2, color: "#a4c3e9" },
        ],
      };
    case "rustic":
      return {
        furni: [
          { kind: "barrel", x: 1, y: 3 },
          { kind: "bookshelf", x: 20, y: 3 },
          { kind: "lantern", x: 1, y: 8 },
          { kind: "lantern", x: 20, y: 8 },
          { kind: "table", x: 3, y: 9, w: 2 },
          { kind: "barrel", x: 17, y: 9 },
          { kind: "barrel", x: 18, y: 9 },
        ],
        decor: [
          { kind: "shelf", x: 4, w: 2 },
          { kind: "window", x: 16, w: 2 },
        ],
      };
    case "medieval":
      return {
        furni: [
          { kind: "armor", x: 1, y: 3 },
          { kind: "armor", x: 20, y: 3 },
          { kind: "candelabra", x: 1, y: 8 },
          { kind: "candelabra", x: 20, y: 8 },
          { kind: "pillar", x: 4, y: 8 },
          { kind: "pillar", x: 17, y: 8 },
        ],
        decor: [
          { kind: "banner", x: 4, color: "#9b2335" },
          { kind: "torch", x: 5 },
          { kind: "torch", x: 16 },
          { kind: "banner", x: 17, color: "#9b2335" },
        ],
      };
    case "garden":
      return {
        furni: [
          { kind: "tree", x: 1, y: 3 },
          { kind: "tree", x: 20, y: 3 },
          { kind: "flowerbed", x: 1, y: 7, d: 2 },
          { kind: "flowerbed", x: 20, y: 7, d: 2 },
          { kind: "fountain", x: 3, y: 8, w: 2, d: 2 },
          { kind: "lantern", x: 17, y: 9 },
        ],
        decor: [
          { kind: "ivy", x: 4, w: 2 },
          { kind: "ivy", x: 16, w: 2 },
        ],
      };
  }
}

/** Un mapa por piso. Las salas se reparten de a cuatro por piso, en orden. */
export function venueFloors(theme: ThemeId, rooms: Pick<Room, "id" | "name" | "color">[]): SceneMap[] {
  const floors = floorCount(rooms.length);
  return Array.from({ length: floors }, (_, f) =>
    floorMap(theme, f, rooms.slice(f * DOOR_SLOTS.length, (f + 1) * DOOR_SLOTS.length), f < floors - 1),
  );
}

function floorMap(theme: ThemeId, floor: number, rooms: Pick<Room, "id" | "name" | "color">[], hasUp: boolean): SceneMap {
  const w = FLOOR_W;
  const h = FLOOR_H;
  const doors: Door[] = rooms.map((r, i) => ({ side: "top", x: DOOR_SLOTS[i]!, y: 2, w: 2, id: r.id, label: r.name, color: r.color, theme }));
  const stairs: Stairs[] = [];
  if (hasUp) stairs.push({ side: "bottom", x: 2, y: h - 1, w: 2, to: floor + 1, label: `Subir al ${floorName(floor + 1).toLowerCase()}` });
  if (floor > 0) stairs.push({ side: "bottom", x: w - 4, y: h - 1, w: 2, to: floor - 1, label: `Bajar a ${floorName(floor - 1).toLowerCase()}` });
  const themed = lobbyDecor(theme);
  const furni: Furni[] = [
    { kind: "carpet", x: EXIT_X, y: 4, w: 2, d: h - 5, color: CARPET[theme] },
    // Tótems con los logos de los patrocinadores, a los lados de la alfombra.
    { kind: "totem", x: 7, y: 6 },
    { kind: "totem", x: 14, y: 6 },
    ...themed.furni,
  ];
  const decor: Decor[] = [
    { kind: "sponsors", x: 9, w: 4 },
    { kind: "clock", x: 8 },
    { kind: "clock", x: 13 },
    ...themed.decor,
  ];
  if (floor === 0) decor.push({ kind: "entrance", x: EXIT_X, w: 2, y: h - 1 });
  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: theme,
    spawn: floor === 0 ? { x: EXIT_X, y: h - 3 } : { x: w - 4, y: h - 2 },
    furni,
    decor: decor.filter((d) => d.kind === "clock" || !doors.some((door) => d.x < door.x + door.w && d.x + (d.w ?? 1) > door.x)),
    doors,
    stairs,
    exit: floor === 0 ? { side: "bottom", x: EXIT_X, y: h - 1, w: 2 } : null,
  });
}

/** Dónde aparece alguien que llega a `floor` por la escalera desde `from`. */
export function stairsArrival(floors: SceneMap[], floor: number, from: number): Tile {
  const map = floors[floor]!;
  const st = map.stairs.find((s) => s.to === from);
  return st ? inFront(st) : map.spawn;
}

// ---------- Salas de charla ----------

/** Sala de conferencias: misma distribución de asientos en todos los estilos, con decoración propia. */
export function roomMap(theme: ThemeId, color: string): SceneMap {
  const w = 20;
  const h = 17;
  const seats: Seat[] = [];
  const furni: Furni[] = [];
  furni.push({ kind: "carpet", x: 9, y: 6, w: 2, d: h - 7, color: CARPET[theme] });
  const stageRug: Record<ThemeId, string> = { tech: "#cfe3f7", minimal: "#e9e3d8", rustic: "#b5523b", medieval: "#7a2a3a", garden: "#e9dfc4" };
  furni.push({ kind: "rug", x: 6, y: 3, w: 8, d: 3, color: stageRug[theme] });
  for (const y of [8, 10, 12, 14]) {
    const row = [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16].sort((a, b) => Math.abs(a - 9.5) - Math.abs(b - 9.5));
    for (const x of row) {
      seats.push({ x, y, dir: "up" });
      furni.push({ kind: "chair", x, y, color });
    }
  }
  furni.push({ kind: "lectern", x: 10, y: 5, color });

  // Pantalla principal al centro y una de patrocinadores a cada lado.
  const decor: Decor[] = [
    { kind: "screen", x: 6, w: 8 },
    { kind: "sponsors", x: 3, w: 2 },
    { kind: "sponsors", x: 15, w: 2 },
  ];
  switch (theme) {
    case "tech":
      furni.push(
        { kind: "rack", x: 1, y: 3 },
        { kind: "rack", x: 18, y: 3 },
        { kind: "kiosk", x: 1, y: 9 },
        { kind: "kiosk", x: 18, y: 9 },
        { kind: "bigplant", x: 1, y: 15 },
        { kind: "bigplant", x: 18, y: 15 },
      );
      decor.push({ kind: "neon", x: 1, w: 2, text: "</>", color: "#22d3ee" }, { kind: "neon", x: 17, w: 2, text: "LIVE", color: "#f472b6" });
      break;
    case "minimal":
      furni.push(
        { kind: "bigplant", x: 1, y: 3 },
        { kind: "bigplant", x: 18, y: 3 },
        { kind: "lamp", x: 1, y: 8 },
        { kind: "lamp", x: 18, y: 8 },
        { kind: "plant", x: 1, y: 12 },
        { kind: "plant", x: 18, y: 12 },
        { kind: "bigplant", x: 1, y: 15 },
        { kind: "bigplant", x: 18, y: 15 },
      );
      decor.push({ kind: "art", x: 1, w: 2, color: "#e9b8a4" }, { kind: "art", x: 17, w: 2, color: "#a4c3e9" });
      break;
    case "rustic":
      furni.push(
        { kind: "barrel", x: 1, y: 3 },
        { kind: "bookshelf", x: 18, y: 3 },
        { kind: "lantern", x: 1, y: 8 },
        { kind: "lantern", x: 18, y: 8 },
        { kind: "plant", x: 1, y: 12 },
        { kind: "barrel", x: 18, y: 12 },
        { kind: "table", x: 1, y: 15, w: 2 },
        { kind: "bigplant", x: 18, y: 15 },
      );
      decor.push({ kind: "shelf", x: 1, w: 2 }, { kind: "window", x: 17, w: 2 });
      break;
    case "medieval":
      furni.push(
        { kind: "armor", x: 1, y: 3 },
        { kind: "armor", x: 18, y: 3 },
        { kind: "candelabra", x: 1, y: 8 },
        { kind: "candelabra", x: 18, y: 8 },
        { kind: "pillar", x: 1, y: 12 },
        { kind: "pillar", x: 18, y: 12 },
        { kind: "barrel", x: 1, y: 15 },
        { kind: "plant", x: 18, y: 15 },
      );
      decor.push({ kind: "torch", x: 1 }, { kind: "banner", x: 2, color }, { kind: "banner", x: 17, color }, { kind: "torch", x: 18 });
      break;
    case "garden":
      furni.push(
        { kind: "tree", x: 1, y: 3 },
        { kind: "tree", x: 18, y: 3 },
        { kind: "flowerbed", x: 1, y: 7, d: 2 },
        { kind: "flowerbed", x: 18, y: 7, d: 2 },
        { kind: "fountain", x: 1, y: 11, w: 2, d: 2 },
        { kind: "lantern", x: 18, y: 11 },
        { kind: "tree", x: 18, y: 14 },
        { kind: "flowerbed", x: 1, y: 15, w: 2 },
      );
      decor.push({ kind: "ivy", x: 1, w: 2 }, { kind: "ivy", x: 17, w: 2 });
      break;
  }

  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: theme,
    spawn: { x: 9, y: h - 1 },
    furni,
    decor,
    doors: [{ id: "salida", side: "bottom", x: 9, y: h - 1, w: 2, label: "Salida", color, theme }],
    seats,
    standing: [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16].map((x) => ({ x, y: 15 })),
    podium: { x: 10, y: 4 },
  });
}
