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
  | "hologram"
  | "ledpillar"
  | "robot"
  | "sculpture"
  | "neonpath"
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
  /** Techos de los edificios de sala, que llevan su nombre pintado. */
  roofs: Roof[];
  blocked: boolean[];
}

/** Techo de un edificio de sala visto desde arriba. */
export interface Roof {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  /** false si el puesto no tiene sala asignada. */
  open: boolean;
}

/** Lo que se puede pisar: alfombras, sillas (para sentarse) y caminos de luz. */
const FLAT: FurniKind[] = ["rug", "carpet", "chair", "officechair", "neonpath"];

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
function carve(w: number, h: number, floors: Rect[], base?: string[]) {
  const grid = base ? base.map((row) => [...row]) : Array.from({ length: h }, () => Array.from({ length: w }, () => "#"));
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
  // A las personas se las puede atravesar: nunca bloquean el paso.
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
  roofs: [],
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

/** Objetos de ambiente de cada estilo, que se reparten por rincones libres. */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["ledpillar", "robot", "rack", "ledpillar"],
  minimal: ["bigplant", "lamp", "sculpture", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
};

/** Pieza central de la plaza según el estilo. */
const CENTERPIECE: Record<ThemeId, FurniKind> = {
  tech: "hologram",
  minimal: "sculpture",
  rustic: "fountain",
  medieval: "fountain",
  garden: "fountain",
};

export const ROOMS_PER_EVENT = 8;
/** El auditorio principal más ocho salas. */
export const MAX_ROOMS = ROOMS_PER_EVENT + 1;

const VENUE_W = 50;
const VENUE_H = 36;
const EXIT_X = 24;
const BLOCK_W = 10;
const BLOCK_H = 6;

/** Edificios de sala: cuatro a la izquierda y cuatro a la derecha, alternando para repartirlas. */
const BLOCKS = [3, 11, 19, 27].flatMap((y, row) => [
  { x: 1, y, zone: `Lado izquierdo · ${row + 1}.ª fila` },
  { x: VENUE_W - 1 - BLOCK_W, y, zone: `Lado derecho · ${row + 1}.ª fila` },
]);

/**
 * El recinto: una gran plaza abierta con el auditorio principal al fondo y ocho
 * edificios de sala a los lados. Cada edificio muestra su nombre en el techo.
 */
export function venueMap(theme: ThemeId, rooms: Pick<Room, "id" | "name" | "color" | "main">[]): SceneMap {
  const main = rooms.find((r) => r.main) ?? rooms[0];
  const others = rooms.filter((r) => r !== main).slice(0, ROOMS_PER_EVENT);

  const grid = Array.from({ length: VENUE_H }, (_, y) =>
    Array.from({ length: VENUE_W }, (_, x) => (x >= 1 && x <= VENUE_W - 2 && y >= 3 && y <= VENUE_H - 2 ? "." : "#")),
  );
  const auditorium = { x: 15, y: 3, w: 20, h: 8 };
  for (const b of [auditorium, ...BLOCKS.map((b) => ({ ...b, w: BLOCK_W, h: BLOCK_H }))]) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) grid[y]![x] = "#";
  }
  const tiles = carve(
    VENUE_W,
    VENUE_H,
    [],
    grid.map((r) => r.join("")),
  );

  const doors: Door[] = [];
  const roofs: Roof[] = [];
  if (main) {
    roofs.push({ x: auditorium.x, y: auditorium.y, w: auditorium.w, h: auditorium.h - 2, label: main.name, color: main.color, open: true });
    doors.push({ side: "top", x: 23, y: auditorium.y + auditorium.h - 1, w: 4, id: main.id, label: main.name, color: main.color, theme, zone: "Al fondo de la plaza", main: true });
  }
  const decor: Decor[] = [];
  BLOCKS.forEach((b, i) => {
    const room = others[i];
    const facade = b.y + BLOCK_H - 1;
    roofs.push({ x: b.x, y: b.y, w: BLOCK_W, h: BLOCK_H - 2, label: room?.name ?? "Próximamente", color: room?.color ?? "#9aa5b1", open: Boolean(room) });
    if (room) doors.push({ side: "top", x: b.x + 4, y: facade, w: 2, id: room.id, label: room.name, color: room.color, theme, zone: b.zone, main: false });
    // Ventanas a los lados de la puerta para que la fachada no quede vacía.
    decor.push({ kind: room ? "window" : "art", x: b.x + 1, y: facade, w: 2, color: "#9aa5b1" }, { kind: room ? "window" : "art", x: b.x + 7, y: facade, w: 2, color: "#9aa5b1" });
  });
  decor.push(
    { kind: "sponsors", x: 16, y: 10, w: 5 },
    { kind: "sponsors", x: 29, y: 10, w: 5 },
    { kind: "entrance", x: EXIT_X, y: VENUE_H - 1, w: 2 },
  );

  const accents = ACCENTS[theme];
  const furni: Furni[] = [
    // Camino de la entrada al auditorio: de luz en el estilo tecnológico, alfombra en los demás.
    theme === "tech"
      ? { kind: "neonpath", x: EXIT_X, y: 11, w: 2, d: VENUE_H - 12, color: "#22d3ee" }
      : { kind: "carpet", x: EXIT_X, y: 11, w: 2, d: VENUE_H - 12, color: CARPET[theme] },
    // Caminos transversales hacia las salas de cada lado.
    ...[
      { x: 11, y: 9, w: 4 },
      { x: 35, y: 9, w: 4 },
      { x: 11, y: 17, w: 28 },
      { x: 11, y: 25, w: 28 },
      { x: 11, y: 33, w: 28 },
    ].map((l): Furni =>
      theme === "tech" ? { kind: "neonpath", ...l, d: 1, color: "#a78bfa" } : { kind: "carpet", ...l, d: 1, color: CARPET[theme] },
    ),
    { kind: CENTERPIECE[theme], x: 18, y: 20, w: 2, d: 2 },
    { kind: CENTERPIECE[theme], x: 30, y: 20, w: 2, d: 2 },
    { kind: "directory", x: 21, y: 30 },
    { kind: "directory", x: 28, y: 30 },
    { kind: "totem", x: 13, y: 13 },
    { kind: "totem", x: 36, y: 13 },
    { kind: "totem", x: 13, y: 29 },
    { kind: "totem", x: 36, y: 29 },
    { kind: accents[0]!, x: 12, y: 11 },
    { kind: accents[0]!, x: 37, y: 11 },
    { kind: accents[1]!, x: 12, y: 21 },
    { kind: accents[1]!, x: 37, y: 21 },
    { kind: accents[2]!, x: 16, y: 34 },
    { kind: accents[2]!, x: 33, y: 34 },
  ];
  if (theme === "tech") furni.push({ kind: "robot", x: 22, y: 24 }, { kind: "robot", x: 27, y: 16 });

  // Gente conversando en la plaza (se la puede atravesar).
  const crowd: Npc[] = [
    attendee(0, 16, 26, "right"),
    attendee(1, 17, 26, "left"),
    attendee(2, 32, 26, "right"),
    attendee(3, 33, 26, "left"),
    attendee(4, 20, 14, "down"),
    attendee(5, 20, 15, "up"),
    attendee(6, 29, 14, "right"),
    attendee(7, 30, 14, "left"),
    attendee(8, 13, 18, "right"),
    attendee(9, 14, 18, "left"),
    attendee(10, 35, 18, "right"),
    attendee(11, 36, 18, "left"),
  ];

  return finish({
    ...empty,
    w: VENUE_W,
    h: VENUE_H,
    tiles,
    style: theme,
    spawn: { x: EXIT_X, y: VENUE_H - 3 },
    furni,
    decor,
    doors,
    crowd,
    roofs,
    exit: { side: "bottom", x: EXIT_X, y: VENUE_H - 1, w: 2 },
    directories: [
      { x: 21, y: 30 },
      { x: 28, y: 30 },
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
    { kind: k[1]!, x: 1, y: h - 2 },
    { kind: k[1]!, x: r, y: h - 2 },
  ];
  const decor: Decor[] = [];
  if (theme === "tech") decor.push({ kind: "neon", x: 1, y: 2, w: 2, text: "</>", color: "#22d3ee" }, { kind: "neon", x: w - 3, y: 2, w: 2, text: "LIVE", color: "#ff5c39" });
  if (theme === "minimal") decor.push({ kind: "art", x: 1, y: 2, w: 2, color: "#e9b8a4" }, { kind: "art", x: w - 3, y: 2, w: 2, color: "#a4c3e9" });
  if (theme === "rustic") decor.push({ kind: "shelf", x: 1, y: 2, w: 2 }, { kind: "window", x: w - 3, y: 2, w: 2 });
  if (theme === "medieval") decor.push({ kind: "torch", x: 1, y: 2 }, { kind: "banner", x: 2, y: 2, color }, { kind: "banner", x: w - 3, y: 2, color }, { kind: "torch", x: w - 2, y: 2 });
  if (theme === "garden") decor.push({ kind: "ivy", x: 1, y: 2, w: 2 }, { kind: "ivy", x: w - 3, y: 2, w: 2 });
  return { furni, decor };
}

const STAGE_RUG: Record<ThemeId, string> = { tech: "#cfe3f7", minimal: "#e9e3d8", rustic: "#b5523b", medieval: "#7a2a3a", garden: "#e9dfc4" };

interface InteriorSpec {
  w: number;
  h: number;
  /** Columna izquierda del pasillo de dos baldosas que lleva a la salida. */
  aisle: number;
  screen: { x: number; w: number };
  sponsors: { x: number; w: number }[];
  stage: { x: number; w: number; d: number };
  podium: Tile;
  seats: Seat[];
  extra?: Furni[];
}

/** Arma una sala a partir de su distribución: escenario, pantalla, asientos y decoración. */
function interior(theme: ThemeId, color: string, spec: InteriorSpec): SceneMap {
  const { w, h, aisle } = spec;
  const furni: Furni[] = [
    { kind: "rug", x: spec.stage.x, y: 3, w: spec.stage.w, d: spec.stage.d, color: STAGE_RUG[theme] },
    theme === "tech"
      ? { kind: "neonpath", x: aisle, y: 3 + spec.stage.d, w: 2, d: h - 4 - spec.stage.d, color: "#22d3ee" }
      : { kind: "carpet", x: aisle, y: 3 + spec.stage.d, w: 2, d: h - 4 - spec.stage.d, color: CARPET[theme] },
    ...spec.seats.map((s): Furni => ({ kind: "chair", x: s.x, y: s.y, dir: s.dir, color })),
    { kind: "lectern", x: spec.podium.x, y: spec.podium.y + 1, color },
    ...(spec.extra ?? []),
  ];
  const corners = themedCorners(theme, w, h, color);
  furni.push(...corners.furni);
  const seatSet = new Set(spec.seats.map((s) => `${s.x},${s.y}`));
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
    // Los asientos se ocupan de adelante hacia atrás y del centro hacia afuera.
    seats: [...spec.seats].sort((a, b) => a.y - b.y || Math.abs(a.x - w / 2) - Math.abs(b.x - w / 2)),
    standing: Array.from({ length: w - 6 }, (_, i) => ({ x: i + 3, y: h - 2 })).filter((t) => !seatSet.has(`${t.x},${t.y}`) && (t.x < aisle || t.x > aisle + 1)),
    podium: spec.podium,
  });
}

const rows = (ys: number[], xs: number[], dir: Dir): Seat[] => ys.flatMap((y) => xs.map((x) => ({ x, y, dir })));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Aula clásica: filas mirando a la pantalla. */
const classroom = (theme: ThemeId, color: string) =>
  interior(theme, color, {
    w: 20,
    h: 17,
    aisle: 9,
    screen: { x: 6, w: 8 },
    sponsors: [
      { x: 3, w: 2 },
      { x: 15, w: 2 },
    ],
    stage: { x: 6, w: 8, d: 3 },
    podium: { x: 10, y: 4 },
    seats: rows([8, 10, 12, 14], [...range(3, 8), ...range(11, 16)], "up"),
  });

/** Sala ancha y baja, con un escenario largo. */
const wideHall = (theme: ThemeId, color: string) =>
  interior(theme, color, {
    w: 28,
    h: 14,
    aisle: 13,
    screen: { x: 9, w: 10 },
    sponsors: [
      { x: 3, w: 4 },
      { x: 21, w: 4 },
    ],
    stage: { x: 6, w: 16, d: 2 },
    podium: { x: 14, y: 3 },
    seats: rows([7, 9, 11], [...range(3, 12), ...range(15, 24)], "up"),
  });

/** Taller: mesas con sillas a ambos lados. */
const workshop = (theme: ThemeId, color: string) => {
  const tables = [3, 7, 13, 17].flatMap((x) => [8, 12].map((y) => ({ x, y })));
  return interior(theme, color, {
    w: 22,
    h: 17,
    aisle: 10,
    screen: { x: 7, w: 8 },
    sponsors: [
      { x: 3, w: 3 },
      { x: 16, w: 3 },
    ],
    stage: { x: 7, w: 8, d: 3 },
    podium: { x: 11, y: 4 },
    seats: tables.flatMap((t) => [
      { x: t.x, y: t.y - 1, dir: "down" as const },
      { x: t.x + 1, y: t.y - 1, dir: "down" as const },
      { x: t.x, y: t.y + 1, dir: "up" as const },
      { x: t.x + 1, y: t.y + 1, dir: "up" as const },
    ]),
    extra: tables.map((t): Furni => ({ kind: "table", x: t.x, y: t.y, w: 2 })),
  });
};

/** Anfiteatro en U: el público rodea el centro desde tres lados. */
const arena = (theme: ThemeId, color: string) =>
  interior(theme, color, {
    w: 22,
    h: 18,
    aisle: 10,
    screen: { x: 7, w: 8 },
    sponsors: [
      { x: 2, w: 4 },
      { x: 16, w: 4 },
    ],
    stage: { x: 6, w: 10, d: 3 },
    podium: { x: 11, y: 4 },
    seats: [
      ...rows(range(7, 13), [3, 4], "right"),
      ...rows(range(7, 13), [17, 18], "left"),
      ...rows([15], [...range(5, 9), ...range(12, 16)], "up"),
    ],
    extra: [{ kind: "rug", x: 6, y: 7, w: 10, d: 6, color: STAGE_RUG[theme] }],
  });

/** Auditorio principal: más grande, con escenario amplio y pantallas de patrocinadores enormes. */
export const auditoriumMap = (theme: ThemeId, color: string) =>
  interior(theme, color, {
    w: 30,
    h: 23,
    aisle: 14,
    screen: { x: 9, w: 12 },
    sponsors: [
      { x: 3, w: 5 },
      { x: 22, w: 5 },
    ],
    stage: { x: 5, w: 20, d: 5 },
    podium: { x: 15, y: 6 },
    seats: rows([10, 12, 14, 16, 18, 20], [...range(3, 13), ...range(16, 26)], "up"),
  });

const LAYOUTS = [classroom, workshop, arena, wideHall];

/** Mapa interior de una sala: el auditorio, o una de cuatro distribuciones según su lugar en el evento. */
export function interiorFor(theme: ThemeId, rooms: Pick<Room, "id" | "color" | "main">[], roomId: string): SceneMap {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.main) return auditoriumMap(theme, room?.color ?? "#5b5bf0");
  const index = rooms.filter((r) => !r.main).findIndex((r) => r.id === roomId);
  return LAYOUTS[Math.max(0, index) % LAYOUTS.length]!(theme, room.color);
}
