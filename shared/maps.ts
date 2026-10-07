// Mapas vistos desde arriba. Los usa el cliente para dibujar y caminar, y el
// servidor para saber dónde aparece cada persona.
//
// Terreno: "#" muro visto desde arriba, "=" cara de muro (la pared que se ve de
// frente, siempre dos baldosas de alto sobre un piso) y "." piso.

import { HAIR_COLORS, HAIR_STYLES, PANTS, RECEPTIONIST_LOOK, SHIRTS, SHOES, SKINS } from "./look.ts";
import type { ThemeId } from "./themes.ts";
import type { Look, Room } from "./types.ts";

export interface Tile {
  x: number;
  y: number;
}

export type Dir = "down" | "up" | "left" | "right";

/** Estilo visual de un mapa: los de evento más el de la recepción. */
export type StyleId = ThemeId | "cowork";

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
  | "lamp"
  | "barrel"
  | "lantern"
  | "armor"
  | "pillar"
  | "candelabra"
  | "fountain"
  | "kiosk"
  | "directory"
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

/** Adornos pegados a una cara de muro; `y` es la fila de abajo de esa cara. */
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
  y: number;
  w?: number;
  color?: string;
  text?: string;
}

export type Side = "top" | "bottom";

/** Tramo horizontal de baldosas sobre un muro (arriba o abajo de un piso). */
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
  /** Zona del recinto donde está, para indicar cómo llegar. */
  zone: string;
  /** La entrada del auditorio principal, distinta a todas. */
  main: boolean;
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
  /** Personajes con los que se puede hablar (la recepcionista). */
  npcs: Npc[];
  /** Asistentes de ambiente que conversan en pasillos y sillones. */
  crowd: Npc[];
  seats: Seat[];
  /** Baldosas libres para quedarse de pie si no hay asientos. */
  standing: Tile[];
  /** Dónde se para el ponente. */
  podium: Tile | null;
  /** Salida que lleva de vuelta a recepción. */
  exit: Span | null;
  /** Baldosas desde las que se puede hablar con la recepcionista. */
  desk: Tile[];
  /** Pantallas de directorio: se usan para saber cómo llegar a cada sala. */
  directories: Tile[];
  blocked: boolean[];
}

const FLAT: FurniKind[] = ["rug", "carpet", "chair", "officechair"];

export const spanTiles = (s: Span): Tile[] => Array.from({ length: s.w }, (_, i) => ({ x: s.x + i, y: s.y }));

export const onSpan = (t: Tile, s: Span) => t.y === s.y && t.x >= s.x && t.x < s.x + s.w;

/** Baldosa del piso justo delante de una puerta. */
export const inFront = (s: Span): Tile => ({ x: s.x, y: s.side === "top" ? s.y + 1 : s.y - 1 });

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Arma el terreno a partir de las zonas de piso: todo lo demás es muro, y las
 * dos filas de muro sobre cada piso se convierten en cara de muro.
 */
function carve(w: number, h: number, floors: Rect[]) {
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => "#"));
  for (const r of floors) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y]![x] = ".";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x] === "#" && grid[y + 1]?.[x] === ".") grid[y]![x] = "=";
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x] === "#" && grid[y + 1]?.[x] === "=" && grid[y + 2]?.[x] === ".") grid[y]![x] = "=";
    }
  }
  return grid.map((row) => row.join(""));
}

const enclosure = (w: number, h: number) => carve(w, h, [{ x: 1, y: 3, w: w - 2, h: h - 4 }]);

function finish(map: Omit<SceneMap, "blocked">): SceneMap {
  const blocked = new Array<boolean>(map.w * map.h).fill(false);
  map.tiles.forEach((row, y) => [...row].forEach((c, x) => (blocked[y * map.w + x] = c !== ".")));
  for (const f of map.furni) {
    if (FLAT.includes(f.kind)) continue;
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) blocked[(f.y + dy) * map.w + f.x + dx] = true;
  }
  for (const n of [...map.npcs, ...map.crowd]) blocked[n.y * map.w + n.x] = true;
  // Puertas y salida se pueden pisar aunque estén en el muro.
  for (const s of [...map.doors, ...(map.exit ? [map.exit] : [])]) for (const t of spanTiles(s)) blocked[t.y * map.w + t.x] = false;
  return { ...map, blocked };
}

export const isWalkable = (map: SceneMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < map.w && y < map.h && !map.blocked[y * map.w + x];

export const sameTile = (a: Tile, b: Tile) => Math.round(a.x) === b.x && Math.round(a.y) === b.y;

const empty = {
  doors: [],
  npcs: [],
  crowd: [],
  seats: [],
  standing: [],
  podium: null,
  exit: null,
  desk: [],
  directories: [],
};

/** Asistente de ambiente con una apariencia estable según su número. */
function attendee(i: number, x: number, y: number, dir: Dir): Npc {
  const pick = <V>(list: V[], k: number) => list[(i * 7 + k * 3) % list.length]!;
  return {
    id: `crowd-${i}`,
    name: "Asistente",
    look: {
      skin: pick(SKINS, 1),
      hair: pick(HAIR_STYLES, 2).id,
      hairColor: pick(HAIR_COLORS, 3),
      shirt: pick(SHIRTS, 4),
      pants: pick(PANTS, 5),
      shoes: pick(SHOES, 6),
    },
    x,
    y,
    dir,
  };
}

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
      { kind: "carpet", x: 7, y: 5, w: 2, d: 5, color: "#2b2d42" },
      // Mostrador en U: la recepcionista queda adentro, a tres pasos de la entrada.
      ...[5, 6, 7, 8, 9, 10].map((x) => ({ kind: "counter" as const, x, y: 4 })),
      { kind: "counter", x: 5, y: 3 },
      { kind: "counter", x: 10, y: 3 },
      { kind: "bigplant", x: 9, y: 3 },
      { kind: "bookshelf", x: 1, y: 3 },
      { kind: "cooler", x: 3, y: 3 },
      { kind: "workdesk", x: 1, y: 6, w: 3 },
      { kind: "officechair", x: 1, y: 7 },
      { kind: "officechair", x: 2, y: 7 },
      { kind: "officechair", x: 3, y: 7 },
      { kind: "bigplant", x: 1, y: 9 },
      { kind: "arcade", x: 4, y: 9 },
      { kind: "coffeebar", x: 11, y: 3, w: 3 },
      { kind: "vending", x: 14, y: 3 },
      { kind: "rug", x: 11, y: 5, w: 4, d: 4, color: "#f4a261" },
      { kind: "sofa", x: 11, y: 5, w: 3, color: "#2f6bff", dir: "down" },
      { kind: "coffeetable", x: 11, y: 7, w: 2 },
      { kind: "beanbag", x: 14, y: 7, color: "#ffb703" },
      { kind: "bigplant", x: 14, y: 9 },
    ],
    decor: [
      { kind: "window", x: 1, y: 2, w: 3 },
      { kind: "neon", x: 5, y: 2, w: 6, text: "MyConferences", color: "#ff5c39" },
      { kind: "clock", x: 11, y: 2 },
      { kind: "art", x: 12, y: 2, w: 2, color: "#2f6bff" },
      { kind: "entrance", x: 7, y: h - 1, w: 2 },
    ],
    npcs: [{ id: RECEPTIONIST_ID, name: "Recepcionista", look: RECEPTIONIST_LOOK, x: 7, y: 3, dir: "down" }],
    desk: [6, 7, 8, 9].map((x) => ({ x, y: 5 })),
  });
}

// ---------- Recinto del evento ----------

const CARPET: Record<ThemeId, string> = { tech: "#1e3a5f", minimal: "#d6d3cd", rustic: "#8e3b2f", medieval: "#9b2335", garden: "#c9b48a" };
const SOFA: Record<ThemeId, string> = { tech: "#2f6bff", minimal: "#9aa5b1", rustic: "#a0522d", medieval: "#7a2a3a", garden: "#5a8f3e" };

/** Objetos de ambiente de cada estilo, que se reparten por rincones libres. */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["rack", "arcade", "bigplant", "kiosk"],
  minimal: ["bigplant", "lamp", "plant", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
};

/** Puestos de puerta en orden de llenado: se alternan oeste y este para repartir las salas. */
const SLOTS: (Omit<Span, "w"> & { zone: string })[] = [
  { side: "top", x: 12, y: 32, zone: "Ala oeste" },
  { side: "top", x: 48, y: 32, zone: "Ala este" },
  { side: "bottom", x: 9, y: 39, zone: "Ala oeste" },
  { side: "bottom", x: 51, y: 39, zone: "Ala este" },
  { side: "top", x: 18, y: 32, zone: "Ala oeste" },
  { side: "top", x: 42, y: 32, zone: "Ala este" },
  { side: "bottom", x: 16, y: 39, zone: "Ala oeste" },
  { side: "bottom", x: 44, y: 39, zone: "Ala este" },
  { side: "top", x: 4, y: 13, zone: "Plaza oeste" },
  { side: "top", x: 58, y: 13, zone: "Plaza este" },
  { side: "top", x: 12, y: 13, zone: "Plaza oeste" },
  { side: "top", x: 50, y: 13, zone: "Plaza este" },
];

/** El auditorio principal más una sala por cada puesto de puerta. */
export const MAX_ROOMS = SLOTS.length + 1;

const VENUE_W = 64;
const VENUE_H = 46;
const EXIT_X = 31;

/**
 * El recinto: atrio de entrada, pasillo central hasta el auditorio principal,
 * alas oeste y este con salas a ambos lados y plazas de networking al fondo.
 */
export function venueMap(theme: ThemeId, rooms: Pick<Room, "id" | "name" | "color" | "main">[]): SceneMap {
  const tiles = carve(VENUE_W, VENUE_H, [
    { x: 24, y: 30, w: 16, h: 13 }, // atrio
    { x: 28, y: 12, w: 8, h: 18 }, // pasillo central
    { x: 6, y: 33, w: 18, h: 6 }, // ala oeste
    { x: 6, y: 26, w: 4, h: 7 }, // pasaje oeste
    { x: 3, y: 14, w: 12, h: 12 }, // plaza oeste
    { x: 40, y: 33, w: 18, h: 6 }, // ala este
    { x: 54, y: 26, w: 4, h: 7 }, // pasaje este
    { x: 49, y: 14, w: 12, h: 12 }, // plaza este
  ]);

  const main = rooms.find((r) => r.main) ?? rooms[0];
  const others = rooms.filter((r) => r !== main);
  const doors: Door[] = [];
  if (main) doors.push({ side: "top", x: 30, y: 11, w: 4, id: main.id, label: main.name, color: main.color, theme, zone: "Pasillo central", main: true });
  others.slice(0, SLOTS.length).forEach((r, i) => {
    const slot = SLOTS[i]!;
    doors.push({ ...slot, w: 2, id: r.id, label: r.name, color: r.color, theme, main: false });
  });

  // Los puestos de puerta del muro norte que quedan libres se usan para cuadros.
  const freeTop = SLOTS.slice(others.length).filter((s) => s.side === "top");
  const decor: Decor[] = [
    // Anuncios gigantes a los lados de la entrada al pasillo central, en las alas y en las plazas.
    { kind: "sponsors", x: 24, y: 29, w: 4 },
    { kind: "sponsors", x: 36, y: 29, w: 4 },
    { kind: "sponsors", x: 14, y: 32, w: 4 },
    { kind: "sponsors", x: 44, y: 32, w: 4 },
    { kind: "sponsors", x: 7, y: 13, w: 4 },
    { kind: "sponsors", x: 53, y: 13, w: 4 },
    { kind: "clock", x: 21, y: 32 },
    { kind: "clock", x: 51, y: 32 },
    { kind: theme === "medieval" ? "torch" : "art", x: 28, y: 11, color: "#ff5c39" },
    { kind: theme === "medieval" ? "torch" : "art", x: 35, y: 11, color: "#2f6bff" },
    { kind: "entrance", x: EXIT_X, y: VENUE_H - 3, w: 2 },
    ...freeTop.map((s) => ({ kind: "art" as const, x: s.x, y: s.y, w: 2, color: "#9aa5b1" })),
  ];

  const sofa = SOFA[theme];
  const furni: Furni[] = [
    // Alfombras que marcan el camino: de la entrada al auditorio y por cada ala.
    { kind: "carpet", x: EXIT_X, y: 12, w: 2, d: 31, color: CARPET[theme] },
    { kind: "carpet", x: 6, y: 35, w: 18, d: 2, color: CARPET[theme] },
    { kind: "carpet", x: 40, y: 35, w: 18, d: 2, color: CARPET[theme] },
    // Atrio: directorios junto a la entrada, tótems y dos salas de estar.
    { kind: "directory", x: 28, y: 39 },
    { kind: "directory", x: 35, y: 39 },
    { kind: "totem", x: 29, y: 31 },
    { kind: "totem", x: 34, y: 31 },
    { kind: "rug", x: 24, y: 33, w: 4, d: 4, color: "#e9e4dc" },
    { kind: "sofa", x: 24, y: 33, w: 3, color: sofa, dir: "down" },
    { kind: "coffeetable", x: 24, y: 35, w: 2 },
    { kind: "rug", x: 36, y: 33, w: 4, d: 4, color: "#e9e4dc" },
    { kind: "sofa", x: 37, y: 33, w: 3, color: sofa, dir: "down" },
    { kind: "coffeetable", x: 38, y: 35, w: 2 },
    { kind: "bigplant", x: 24, y: 41 },
    { kind: "bigplant", x: 39, y: 41 },
    // Pasillo central: tótems y bancos para conversar camino al auditorio.
    { kind: "totem", x: 28, y: 18 },
    { kind: "totem", x: 35, y: 18 },
    { kind: "bench", x: 28, y: 25, w: 2 },
    { kind: "bench", x: 34, y: 25, w: 2 },
    { kind: "plant", x: 28, y: 28 },
    { kind: "plant", x: 35, y: 28 },
    // Alas: bancos contra el muro sur, entre puertas.
    { kind: "bench", x: 12, y: 38, w: 3 },
    { kind: "bench", x: 47, y: 38, w: 3 },
    { kind: "plant", x: 6, y: 38 },
    { kind: "plant", x: 21, y: 38 },
    { kind: "plant", x: 41, y: 38 },
    { kind: "plant", x: 57, y: 38 },
    // Plazas de networking: sillones, café y un directorio.
    ...[5, 51].flatMap((px): Furni[] => [
      { kind: "rug", x: px, y: 17, w: 8, d: 6, color: "#e9e4dc" },
      { kind: "sofa", x: px + 1, y: 17, w: 3, color: sofa, dir: "down" },
      { kind: "coffeetable", x: px + 1, y: 19, w: 3 },
      { kind: "sofa", x: px + 1, y: 21, w: 3, color: sofa, dir: "up" },
      { kind: "armchair", x: px + 5, y: 18, color: "#ffb703" },
      { kind: "armchair", x: px + 5, y: 20, color: "#ffb703" },
    ]),
    { kind: "coffeebar", x: 11, y: 25, w: 3 },
    { kind: "coffeebar", x: 50, y: 25, w: 3 },
    { kind: "directory", x: 13, y: 22 },
    { kind: "directory", x: 50, y: 22 },
  ];
  const accentSpots: Tile[] = [
    { x: 3, y: 14 },
    { x: 14, y: 14 },
    { x: 3, y: 25 },
    { x: 14, y: 25 },
    { x: 49, y: 14 },
    { x: 60, y: 14 },
    { x: 49, y: 25 },
    { x: 60, y: 25 },
    { x: 24, y: 30 },
    { x: 39, y: 30 },
  ];
  accentSpots.forEach((t, i) => furni.push({ kind: ACCENTS[theme][i % ACCENTS[theme].length]!, x: t.x, y: t.y }));

  // Gente conversando en grupos, mirándose entre sí.
  const crowd: Npc[] = [
    attendee(0, 25, 38, "right"),
    attendee(1, 26, 38, "left"),
    attendee(2, 37, 38, "right"),
    attendee(3, 38, 38, "left"),
    attendee(4, 29, 22, "right"),
    attendee(5, 30, 22, "left"),
    attendee(6, 34, 14, "down"),
    attendee(7, 34, 15, "up"),
    attendee(8, 14, 34, "right"),
    attendee(9, 15, 34, "left"),
    attendee(10, 49, 34, "right"),
    attendee(11, 50, 34, "left"),
    attendee(12, 6, 24, "right"),
    attendee(13, 7, 24, "left"),
    attendee(14, 57, 23, "down"),
    attendee(15, 57, 24, "up"),
    attendee(16, 12, 16, "down"),
    attendee(17, 12, 17, "up"),
  ];

  return finish({
    ...empty,
    w: VENUE_W,
    h: VENUE_H,
    tiles,
    style: theme,
    spawn: { x: EXIT_X, y: VENUE_H - 5 },
    furni,
    decor,
    doors,
    crowd,
    exit: { side: "bottom", x: EXIT_X, y: VENUE_H - 3, w: 2 },
    directories: [
      { x: 28, y: 39 },
      { x: 35, y: 39 },
      { x: 13, y: 22 },
      { x: 50, y: 22 },
    ],
  });
}

// ---------- Salas de charla ----------

function themedCorners(theme: ThemeId, w: number, h: number, color: string): { furni: Furni[]; decor: Decor[] } {
  const r = w - 2;
  const k = ACCENTS[theme];
  const furni: Furni[] = [
    { kind: k[0]!, x: 1, y: 3 },
    { kind: k[0]!, x: r, y: 3 },
    { kind: k[1]!, x: 1, y: 9 },
    { kind: k[1]!, x: r, y: 9 },
    { kind: k[2]!, x: 1, y: h - 2 },
    { kind: k[2]!, x: r, y: h - 2 },
  ];
  const decor: Decor[] = [];
  if (theme === "tech") decor.push({ kind: "neon", x: 1, y: 2, w: 2, text: "</>", color: "#22d3ee" }, { kind: "neon", x: w - 3, y: 2, w: 2, text: "LIVE", color: "#ff5c39" });
  if (theme === "minimal") decor.push({ kind: "art", x: 1, y: 2, w: 2, color: "#e9b8a4" }, { kind: "art", x: w - 3, y: 2, w: 2, color: "#a4c3e9" });
  if (theme === "rustic") decor.push({ kind: "shelf", x: 1, y: 2, w: 2 }, { kind: "window", x: w - 3, y: 2, w: 2 });
  if (theme === "medieval") decor.push({ kind: "torch", x: 1, y: 2 }, { kind: "banner", x: 2, y: 2, color }, { kind: "banner", x: w - 3, y: 2, color }, { kind: "torch", x: w - 2, y: 2 });
  if (theme === "garden") decor.push({ kind: "ivy", x: 1, y: 2, w: 2 }, { kind: "ivy", x: w - 3, y: 2, w: 2 });
  return { furni, decor };
}

interface HallSpec {
  w: number;
  h: number;
  rows: number[];
  /** Columnas de asientos a la izquierda y a la derecha del pasillo. */
  left: number[];
  right: number[];
  aisle: number;
  screen: { x: number; w: number };
  sponsors: { x: number; w: number }[];
  stage: { x: number; w: number; d: number };
}

function hall(theme: ThemeId, color: string, spec: HallSpec): SceneMap {
  const { w, h, aisle } = spec;
  const seats: Seat[] = [];
  const stageRug: Record<ThemeId, string> = { tech: "#cfe3f7", minimal: "#e9e3d8", rustic: "#b5523b", medieval: "#7a2a3a", garden: "#e9dfc4" };
  const furni: Furni[] = [
    { kind: "rug", x: spec.stage.x, y: 3, w: spec.stage.w, d: spec.stage.d, color: stageRug[theme] },
    { kind: "carpet", x: aisle, y: 3 + spec.stage.d, w: 2, d: h - 4 - spec.stage.d, color: CARPET[theme] },
  ];
  const center = aisle + 0.5;
  for (const y of spec.rows) {
    for (const x of [...spec.left, ...spec.right].sort((a, b) => Math.abs(a - center) - Math.abs(b - center))) {
      seats.push({ x, y, dir: "up" });
      furni.push({ kind: "chair", x, y, color });
    }
  }
  const podium = { x: aisle + 1, y: 1 + spec.stage.d };
  furni.push({ kind: "lectern", x: podium.x, y: podium.y + 1, color });
  const corners = themedCorners(theme, w, h, color);
  furni.push(...corners.furni);
  return finish({
    ...empty,
    w,
    h,
    tiles: enclosure(w, h),
    style: theme,
    spawn: { x: aisle, y: h - 1 },
    furni,
    decor: [
      { kind: "screen", x: spec.screen.x, y: 2, w: spec.screen.w },
      ...spec.sponsors.map((s) => ({ kind: "sponsors" as const, x: s.x, y: 2, w: s.w })),
      ...corners.decor,
    ],
    doors: [{ id: "salida", side: "bottom", x: aisle, y: h - 1, w: 2, label: "Salida", color, theme, zone: "", main: false }],
    seats,
    standing: [...spec.left, ...spec.right].map((x) => ({ x, y: h - 2 })),
    podium,
  });
}

/** Sala de charla: misma distribución en todos los estilos, con decoración propia. */
export const roomMap = (theme: ThemeId, color: string) =>
  hall(theme, color, {
    w: 20,
    h: 17,
    rows: [8, 10, 12, 14],
    left: [3, 4, 5, 6, 7, 8],
    right: [11, 12, 13, 14, 15, 16],
    aisle: 9,
    screen: { x: 6, w: 8 },
    sponsors: [
      { x: 3, w: 2 },
      { x: 15, w: 2 },
    ],
    stage: { x: 6, w: 8, d: 3 },
  });

/** Auditorio principal: más grande, con escenario amplio y pantallas de patrocinadores enormes. */
export const auditoriumMap = (theme: ThemeId, color: string) =>
  hall(theme, color, {
    w: 30,
    h: 23,
    rows: [10, 12, 14, 16, 18, 20],
    left: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    right: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
    aisle: 14,
    screen: { x: 9, w: 12 },
    sponsors: [
      { x: 3, w: 5 },
      { x: 22, w: 5 },
    ],
    stage: { x: 5, w: 20, d: 5 },
  });
