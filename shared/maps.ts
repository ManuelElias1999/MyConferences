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

// ---------- Recepción: un cowork tecnológico ----------

export const RECEPTIONIST_ID = "npc-recepcion";

export function receptionMap(): SceneMap {
  const w = 26;
  const h = 17;
  const furni: Furni[] = [
    { kind: "carpet", x: 12, y: 6, w: 2, d: 10, color: "#3d5a80" },
    // Mostrador de recepción en U.
    ...[10, 11, 12, 13, 14, 15].map((x) => ({ kind: "counter" as const, x, y: 5 })),
    { kind: "counter", x: 10, y: 4 },
    { kind: "counter", x: 15, y: 4 },
    { kind: "bigplant", x: 10, y: 3 },
    { kind: "bigplant", x: 15, y: 3 },
    // Zona de escritorios compartidos a la izquierda.
    { kind: "rug", x: 1, y: 7, w: 8, d: 7, color: "#c7d2e3" },
    { kind: "workdesk", x: 2, y: 8, w: 3 },
    { kind: "workdesk", x: 6, y: 8, w: 2 },
    { kind: "officechair", x: 2, y: 9 },
    { kind: "officechair", x: 3, y: 9 },
    { kind: "officechair", x: 4, y: 9 },
    { kind: "officechair", x: 6, y: 9 },
    { kind: "officechair", x: 7, y: 9 },
    { kind: "workdesk", x: 2, y: 11, w: 3 },
    { kind: "workdesk", x: 6, y: 11, w: 2 },
    { kind: "officechair", x: 2, y: 12 },
    { kind: "officechair", x: 3, y: 12 },
    { kind: "officechair", x: 4, y: 12 },
    { kind: "officechair", x: 6, y: 12 },
    { kind: "officechair", x: 7, y: 12 },
    { kind: "bookshelf", x: 1, y: 3 },
    { kind: "bookshelf", x: 2, y: 3 },
    { kind: "cooler", x: 4, y: 3 },
    { kind: "plant", x: 7, y: 3 },
    { kind: "bigplant", x: 1, y: 15 },
    { kind: "arcade", x: 8, y: 15 },
    // Sala de estar y café a la derecha.
    { kind: "coffeebar", x: 19, y: 3, w: 4 },
    { kind: "plant", x: 18, y: 3 },
    { kind: "vending", x: 24, y: 3 },
    { kind: "rug", x: 17, y: 7, w: 8, d: 6, color: "#f2c6a0" },
    { kind: "sofa", x: 18, y: 7, w: 3, color: "#5b7fd6", dir: "down" },
    { kind: "armchair", x: 22, y: 7, color: "#f08a5d" },
    { kind: "coffeetable", x: 18, y: 9, w: 3 },
    { kind: "beanbag", x: 22, y: 9, color: "#ffd166" },
    { kind: "sofa", x: 18, y: 11, w: 3, color: "#5b7fd6", dir: "up" },
    { kind: "beanbag", x: 23, y: 11, color: "#ef476f" },
    { kind: "pingpong", x: 18, y: 14, w: 3 },
    { kind: "bigplant", x: 24, y: 15 },
    { kind: "lamp", x: 24, y: 7 },
    { kind: "plant", x: 9, y: 7 },
    { kind: "plant", x: 16, y: 7 },
  ];
  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: "cowork",
    spawn: { x: 12, y: 14 },
    furni,
    decor: [
      { kind: "window", x: 1, w: 3 },
      { kind: "whiteboard", x: 5, w: 3 },
      { kind: "neon", x: 9, w: 8, text: "MyConferences", color: "#22d3ee" },
      { kind: "clock", x: 17 },
      { kind: "window", x: 19, w: 3 },
      { kind: "art", x: 23, w: 2, color: "#ef476f" },
      { kind: "entrance", x: 12, w: 2, y: h - 1 },
    ],
    npcs: [{ id: RECEPTIONIST_ID, name: "Recepcionista", look: RECEPTIONIST_LOOK, x: 12, y: 4, dir: "down" }],
    desk: [11, 12, 13, 14].map((x) => ({ x, y: 6 })),
    signs: [],
  });
}

// ---------- Salón: un edificio de varios pisos ----------

const FLOOR_W = 24;
const FLOOR_H = 16;
/** Puestos para puertas en cada piso: la planta baja usa los muros laterales y arriba se suma el muro norte. */
const GROUND_SLOTS: Omit<Span, "w">[] = [
  { side: "left", x: 0, y: 5 },
  { side: "right", x: FLOOR_W - 1, y: 5 },
  { side: "left", x: 0, y: 10 },
  { side: "right", x: FLOOR_W - 1, y: 10 },
];
const UPPER_SLOTS: Omit<Span, "w">[] = [...GROUND_SLOTS, { side: "top", x: 4, y: 2 }, { side: "top", x: FLOOR_W - 6, y: 2 }];

export function floorCount(rooms: number) {
  return 1 + Math.ceil(Math.max(0, rooms - GROUND_SLOTS.length) / UPPER_SLOTS.length);
}

export const floorName = (floor: number) => (floor === 0 ? "Planta baja" : `Piso ${floor}`);

const STAIRS_X = 11;

/** Un mapa por piso. Las salas se reparten en orden: primero la planta baja y luego hacia arriba. */
export function venueFloors(rooms: Pick<Room, "id" | "name" | "color" | "theme">[]): SceneMap[] {
  const floors = floorCount(rooms.length);
  const maps: SceneMap[] = [];
  let next = 0;
  for (let f = 0; f < floors; f++) {
    const slots = f === 0 ? GROUND_SLOTS : UPPER_SLOTS;
    const here = rooms.slice(next, next + slots.length);
    next += here.length;
    maps.push(floorMap(f, here, slots, f < floors - 1));
  }
  return maps;
}

function floorMap(floor: number, rooms: Pick<Room, "id" | "name" | "color" | "theme">[], slots: Omit<Span, "w">[], hasUp: boolean): SceneMap {
  const w = FLOOR_W;
  const h = FLOOR_H;
  const doors: Door[] = rooms.map((r, i) => ({ ...slots[i]!, w: 2, id: r.id, label: r.name, color: r.color, theme: r.theme }));
  const stairs: Stairs[] = [];
  if (hasUp) stairs.push({ side: "top", x: STAIRS_X, y: 2, w: 2, to: floor + 1, label: `Subir al ${floorName(floor + 1).toLowerCase()}` });
  if (floor > 0) stairs.push({ side: "bottom", x: STAIRS_X, y: h - 1, w: 2, to: floor - 1, label: `Bajar a ${floorName(floor - 1).toLowerCase()}` });
  const accent = ["#5b7fd6", "#14b8a6", "#f08a5d", "#8b5cf6"][floor % 4]!;
  const furni: Furni[] = [
    // Salas de estar entre las puertas, dejando libre el pasillo central.
    { kind: "rug", x: 4, y: 6, w: 5, d: 5, color: "#e6dccb" },
    { kind: "sofa", x: 5, y: 6, w: 3, color: accent, dir: "down" },
    { kind: "coffeetable", x: 5, y: 8, w: 3 },
    { kind: "beanbag", x: 4, y: 10, color: "#ffd166" },
    { kind: "beanbag", x: 8, y: 10, color: "#ef476f" },
    { kind: "rug", x: 15, y: 6, w: 5, d: 5, color: "#e6dccb" },
    { kind: "sofa", x: 16, y: 6, w: 3, color: accent, dir: "down" },
    { kind: "coffeetable", x: 16, y: 8, w: 3 },
    { kind: "armchair", x: 15, y: 10, color: "#f08a5d" },
    { kind: "armchair", x: 19, y: 10, color: "#f08a5d" },
    { kind: "carpet", x: STAIRS_X, y: 3, w: 2, d: h - 4, color: "#3d5a80" },
    { kind: "bigplant", x: 1, y: 3 },
    { kind: "bigplant", x: w - 2, y: 3 },
    { kind: "plant", x: 1, y: 8 },
    { kind: "plant", x: w - 2, y: 8 },
    { kind: "bigplant", x: 1, y: h - 2 },
    { kind: "bigplant", x: w - 2, y: h - 2 },
    { kind: "kiosk", x: 14, y: h - 3 },
    { kind: "bench", x: 3, y: h - 3, w: 3 },
    { kind: "bench", x: w - 6, y: h - 3, w: 3 },
  ];
  if (floor === 0) furni.push({ kind: "vending", x: 8, y: 3 }, { kind: "cooler", x: 15, y: 3 });
  const decor: Decor[] = [
    { kind: "window", x: 1, w: 2 },
    { kind: "art", x: 7, w: 2, color: accent },
    { kind: "window", x: 14, w: 3 },
    { kind: "clock", x: 18 },
    { kind: "window", x: w - 3, w: 2 },
  ];
  if (!hasUp) decor.push({ kind: "neon", x: 9, w: 6, text: floorName(floor), color: "#f472b6" });
  if (floor === 0) decor.push({ kind: "entrance", x: STAIRS_X, w: 2, y: h - 1 });
  // En el piso superior, los cuadros no tapan las puertas del muro norte.
  const topDoors = doors.filter((d) => d.side === "top");
  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: "lobby",
    spawn: floor === 0 ? { x: STAIRS_X, y: h - 3 } : { x: STAIRS_X, y: h - 2 },
    furni: furni.filter((f) => !topDoors.some((d) => f.y === 3 && f.x >= d.x - 1 && f.x <= d.x + d.w)),
    decor: decor.filter((d) => !topDoors.some((door) => d.x < door.x + door.w + 1 && d.x + (d.w ?? 1) > door.x - 1)),
    doors,
    stairs,
    exit: floor === 0 ? { side: "bottom", x: STAIRS_X, y: h - 1, w: 2 } : null,
    signs: hasUp ? [{ x: STAIRS_X - 3, w: 8, text: `${floorName(floor)} · Escaleras ↑` }] : [],
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
  const aisle: Record<ThemeId, string> = { tech: "#1e3a5f", minimal: "#d6d3cd", rustic: "#8e3b2f", medieval: "#9b2335", garden: "#c9b48a" };
  furni.push({ kind: "carpet", x: 9, y: 6, w: 2, d: h - 7, color: aisle[theme] });
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

  const decor: Decor[] = [{ kind: "screen", x: 6, w: 8 }];
  switch (theme) {
    case "tech":
      furni.push(
        { kind: "rack", x: 1, y: 3 },
        { kind: "rack", x: 2, y: 3 },
        { kind: "rack", x: 17, y: 3 },
        { kind: "rack", x: 18, y: 3 },
        { kind: "kiosk", x: 1, y: 9 },
        { kind: "kiosk", x: 18, y: 9 },
        { kind: "bigplant", x: 1, y: 15 },
        { kind: "bigplant", x: 18, y: 15 },
        { kind: "arcade", x: 1, y: 6 },
      );
      decor.push({ kind: "neon", x: 1, w: 4, text: "</>", color: "#22d3ee" }, { kind: "neon", x: 15, w: 4, text: "LIVE", color: "#f472b6" });
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
      decor.push({ kind: "art", x: 2, w: 2, color: "#e9b8a4" }, { kind: "art", x: 16, w: 2, color: "#a4c3e9" });
      break;
    case "rustic":
      furni.push(
        { kind: "barrel", x: 1, y: 3 },
        { kind: "barrel", x: 2, y: 3 },
        { kind: "bookshelf", x: 17, y: 3 },
        { kind: "bookshelf", x: 18, y: 3 },
        { kind: "lantern", x: 1, y: 8 },
        { kind: "lantern", x: 18, y: 8 },
        { kind: "plant", x: 1, y: 12 },
        { kind: "barrel", x: 18, y: 12 },
        { kind: "table", x: 1, y: 15, w: 2 },
        { kind: "bigplant", x: 18, y: 15 },
      );
      decor.push({ kind: "fireplace", x: 1, w: 3 }, { kind: "shelf", x: 16, w: 3 });
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
      decor.push({ kind: "torch", x: 2 }, { kind: "banner", x: 3, color }, { kind: "banner", x: 16, color }, { kind: "torch", x: 17 });
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
      decor.push({ kind: "ivy", x: 1, w: 4 }, { kind: "ivy", x: 15, w: 4 });
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
