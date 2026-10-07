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

const CARPET: Record<ThemeId, string> = { tech: "#1e3a5f", minimal: "#d6d3cd", rustic: "#8e6a45", medieval: "#9b2335", garden: "#d9c49a" };

/** Objetos de ambiente de cada estilo (también se usan en las salas). */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["ledpillar", "robot", "rack", "ledpillar"],
  minimal: ["bigplant", "lamp", "sculpture", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
};

export const ROOMS_PER_EVENT = 8;
/** El auditorio principal más ocho salas. */
export const MAX_ROOMS = ROOMS_PER_EVENT + 1;

/** Plano de un recinto: zonas de piso, entrada, auditorio, puertas de sala y decoración. */
interface Layout {
  w: number;
  h: number;
  floors: Rect[];
  /** Salida a recepción, en el muro sur (dos baldosas). */
  exit: Tile;
  spawn: Tile;
  /** Puerta del auditorio principal (cuatro baldosas) en la cara de muro de abajo. */
  main: Tile;
  /** Puestos de las ocho salas, en el orden en que se llenan. */
  slots: (Tile & { zone: string })[];
  decor: Decor[];
  furni: Furni[];
  crowd: [x: number, y: number, dir: Dir][];
  directories: Tile[];
}

const path = (theme: ThemeId, x: number, y: number, w: number, d: number, neon = "#22d3ee"): Furni =>
  theme === "tech" ? { kind: "neonpath", x, y, w, d, color: neon } : { kind: "carpet", x, y, w, d, color: CARPET[theme] };

/** Campus futurista: atrio, pasillo central al auditorio, dos laboratorios y dos alas de salas. */
function techCampus(): Layout {
  return {
    w: 60,
    h: 40,
    floors: [
      { x: 22, y: 28, w: 16, h: 10 }, // atrio
      { x: 26, y: 10, w: 8, h: 18 }, // pasillo central
      { x: 10, y: 12, w: 16, h: 9 }, // laboratorio oeste
      { x: 34, y: 12, w: 16, h: 9 }, // laboratorio este
      { x: 4, y: 31, w: 18, h: 5 }, // ala oeste
      { x: 38, y: 31, w: 18, h: 5 }, // ala este
    ],
    exit: { x: 29, y: 38 },
    spawn: { x: 29, y: 35 },
    main: { x: 28, y: 9 },
    slots: [
      { x: 18, y: 30, zone: "Ala oeste" },
      { x: 40, y: 30, zone: "Ala este" },
      { x: 14, y: 30, zone: "Ala oeste" },
      { x: 44, y: 30, zone: "Ala este" },
      { x: 10, y: 30, zone: "Ala oeste" },
      { x: 48, y: 30, zone: "Ala este" },
      { x: 6, y: 30, zone: "Ala oeste" },
      { x: 52, y: 30, zone: "Ala este" },
    ],
    decor: [
      { kind: "sponsors", x: 22, y: 27, w: 4 },
      { kind: "sponsors", x: 34, y: 27, w: 4 },
      { kind: "sponsors", x: 11, y: 11, w: 5 },
      { kind: "sponsors", x: 19, y: 11, w: 5 },
      { kind: "sponsors", x: 36, y: 11, w: 5 },
      { kind: "sponsors", x: 44, y: 11, w: 5 },
      { kind: "neon", x: 26, y: 9, w: 2, text: "AI", color: "#22d3ee" },
      { kind: "neon", x: 32, y: 9, w: 2, text: "</>", color: "#f472b6" },
    ],
    furni: [
      { kind: "neonpath", x: 29, y: 10, w: 2, d: 28, color: "#22d3ee" },
      { kind: "neonpath", x: 4, y: 33, w: 18, d: 1, color: "#a78bfa" },
      { kind: "neonpath", x: 38, y: 33, w: 18, d: 1, color: "#a78bfa" },
      { kind: "neonpath", x: 10, y: 16, w: 16, d: 1, color: "#a78bfa" },
      { kind: "neonpath", x: 34, y: 16, w: 16, d: 1, color: "#a78bfa" },
      { kind: "hologram", x: 23, y: 31, w: 2, d: 2 },
      { kind: "hologram", x: 35, y: 31, w: 2, d: 2 },
      { kind: "ledpillar", x: 22, y: 28 },
      { kind: "ledpillar", x: 37, y: 28 },
      { kind: "robot", x: 33, y: 34 },
      { kind: "totem", x: 26, y: 14 },
      { kind: "totem", x: 33, y: 14 },
      { kind: "ledpillar", x: 26, y: 22 },
      { kind: "ledpillar", x: 33, y: 22 },
      { kind: "hologram", x: 13, y: 13, w: 2, d: 2 },
      { kind: "hologram", x: 20, y: 18, w: 2, d: 2 },
      { kind: "hologram", x: 45, y: 13, w: 2, d: 2 },
      { kind: "hologram", x: 38, y: 18, w: 2, d: 2 },
      { kind: "robot", x: 11, y: 19 },
      { kind: "robot", x: 48, y: 19 },
      { kind: "arcade", x: 25, y: 12 },
      { kind: "arcade", x: 34, y: 12 },
      { kind: "rack", x: 10, y: 12 },
      { kind: "rack", x: 49, y: 12 },
      { kind: "ledpillar", x: 4, y: 35 },
      { kind: "ledpillar", x: 55, y: 35 },
    ],
    crowd: [
      [25, 36, "right"],
      [26, 36, "left"],
      [33, 29, "right"],
      [34, 29, "left"],
      [16, 14, "right"],
      [17, 14, "left"],
      [41, 19, "right"],
      [42, 19, "left"],
      [12, 34, "right"],
      [13, 34, "left"],
      [47, 34, "right"],
      [48, 34, "left"],
      [27, 25, "right"],
      [28, 25, "left"],
    ],
    directories: [
      { x: 24, y: 36 },
      { x: 35, y: 36 },
      { x: 17, y: 20 },
      { x: 42, y: 13 },
    ],
  };
}

/** Castillo: patio de armas con fuentes, el gran salón al norte y galerías y torres a los lados. */
function castle(): Layout {
  return {
    w: 56,
    h: 42,
    floors: [
      { x: 14, y: 18, w: 28, h: 18 }, // patio de armas
      { x: 24, y: 10, w: 8, h: 8 }, // paso al gran salón
      { x: 4, y: 12, w: 12, h: 4 }, // torre oeste
      { x: 14, y: 16, w: 2, h: 2 },
      { x: 2, y: 24, w: 12, h: 6 }, // galería oeste
      { x: 40, y: 12, w: 12, h: 4 }, // torre este
      { x: 40, y: 16, w: 2, h: 2 },
      { x: 42, y: 24, w: 12, h: 6 }, // galería este
    ],
    exit: { x: 27, y: 36 },
    spawn: { x: 27, y: 33 },
    main: { x: 26, y: 9 },
    slots: [
      { x: 8, y: 23, zone: "Galería oeste" },
      { x: 45, y: 23, zone: "Galería este" },
      { x: 11, y: 11, zone: "Torre oeste" },
      { x: 43, y: 11, zone: "Torre este" },
      { x: 3, y: 23, zone: "Galería oeste" },
      { x: 50, y: 23, zone: "Galería este" },
      { x: 6, y: 11, zone: "Torre oeste" },
      { x: 48, y: 11, zone: "Torre este" },
    ],
    decor: [
      { kind: "sponsors", x: 16, y: 17, w: 5 },
      { kind: "sponsors", x: 35, y: 17, w: 5 },
      { kind: "banner", x: 21, y: 17, color: "#9b2335" },
      { kind: "torch", x: 22, y: 17 },
      { kind: "torch", x: 33, y: 17 },
      { kind: "banner", x: 34, y: 17, color: "#9b2335" },
      { kind: "torch", x: 24, y: 9 },
      { kind: "banner", x: 25, y: 9, color: "#d4a73c" },
      { kind: "banner", x: 30, y: 9, color: "#d4a73c" },
      { kind: "torch", x: 31, y: 9 },
      { kind: "torch", x: 6, y: 23 },
      { kind: "torch", x: 11, y: 23 },
      { kind: "torch", x: 48, y: 23 },
      { kind: "torch", x: 53, y: 23 },
      { kind: "window", x: 4, y: 11, w: 2 },
      { kind: "window", x: 50, y: 11, w: 2 },
    ],
    furni: [
      { kind: "carpet", x: 27, y: 10, w: 2, d: 26, color: "#9b2335" },
      { kind: "carpet", x: 2, y: 27, w: 52, d: 1, color: "#9b2335" },
      { kind: "fountain", x: 19, y: 22, w: 2, d: 2 },
      { kind: "fountain", x: 35, y: 22, w: 2, d: 2 },
      { kind: "armor", x: 24, y: 11 },
      { kind: "armor", x: 31, y: 11 },
      { kind: "candelabra", x: 24, y: 15 },
      { kind: "candelabra", x: 31, y: 15 },
      { kind: "pillar", x: 17, y: 31 },
      { kind: "pillar", x: 38, y: 31 },
      { kind: "pillar", x: 17, y: 20 },
      { kind: "pillar", x: 38, y: 20 },
      { kind: "totem", x: 22, y: 30 },
      { kind: "totem", x: 33, y: 30 },
      { kind: "armor", x: 2, y: 24 },
      { kind: "armor", x: 53, y: 24 },
      { kind: "candelabra", x: 2, y: 29 },
      { kind: "candelabra", x: 53, y: 29 },
      { kind: "barrel", x: 4, y: 15 },
      { kind: "barrel", x: 51, y: 15 },
    ],
    crowd: [
      [23, 26, "right"],
      [24, 26, "left"],
      [31, 26, "right"],
      [32, 26, "left"],
      [20, 33, "right"],
      [21, 33, "left"],
      [35, 33, "right"],
      [36, 33, "left"],
      [6, 26, "right"],
      [7, 26, "left"],
      [47, 28, "right"],
      [48, 28, "left"],
      [9, 13, "right"],
      [10, 13, "left"],
    ],
    directories: [
      { x: 24, y: 33 },
      { x: 31, y: 33 },
    ],
  };
}

/** Parque: plaza de entrada, un gran jardín central y dos jardines laterales. */
function park(): Layout {
  return {
    w: 58,
    h: 40,
    floors: [
      { x: 24, y: 30, w: 10, h: 7 }, // plaza de entrada
      { x: 26, y: 28, w: 6, h: 2 },
      { x: 14, y: 16, w: 30, h: 12 }, // jardín central
      { x: 2, y: 20, w: 12, h: 14 }, // jardín oeste
      { x: 44, y: 20, w: 12, h: 14 }, // jardín este
    ],
    exit: { x: 28, y: 37 },
    spawn: { x: 28, y: 34 },
    main: { x: 27, y: 15 },
    slots: [
      { x: 21, y: 15, zone: "Jardín central" },
      { x: 35, y: 15, zone: "Jardín central" },
      { x: 9, y: 19, zone: "Jardín oeste" },
      { x: 46, y: 19, zone: "Jardín este" },
      { x: 16, y: 15, zone: "Jardín central" },
      { x: 40, y: 15, zone: "Jardín central" },
      { x: 4, y: 19, zone: "Jardín oeste" },
      { x: 51, y: 19, zone: "Jardín este" },
    ],
    decor: [
      { kind: "sponsors", x: 24, y: 29, w: 2 },
      { kind: "sponsors", x: 32, y: 29, w: 2 },
      { kind: "ivy", x: 2, y: 19, w: 2 },
      { kind: "ivy", x: 12, y: 19, w: 2 },
      { kind: "ivy", x: 44, y: 19, w: 2 },
      { kind: "ivy", x: 54, y: 19, w: 2 },
      { kind: "ivy", x: 25, y: 15, w: 2 },
      { kind: "ivy", x: 31, y: 15, w: 2 },
    ],
    furni: [
      { kind: "carpet", x: 28, y: 16, w: 2, d: 21, color: "#d9c49a" },
      { kind: "carpet", x: 2, y: 25, w: 54, d: 1, color: "#d9c49a" },
      { kind: "fountain", x: 23, y: 19, w: 2, d: 2 },
      { kind: "fountain", x: 33, y: 19, w: 2, d: 2 },
      { kind: "fountain", x: 6, y: 29, w: 2, d: 2 },
      { kind: "fountain", x: 49, y: 29, w: 2, d: 2 },
      { kind: "tree", x: 14, y: 18 },
      { kind: "tree", x: 43, y: 18 },
      { kind: "tree", x: 14, y: 27 },
      { kind: "tree", x: 43, y: 27 },
      { kind: "flowerbed", x: 18, y: 22, w: 3 },
      { kind: "flowerbed", x: 37, y: 22, w: 3 },
      { kind: "totem", x: 20, y: 26 },
      { kind: "totem", x: 37, y: 26 },
      { kind: "lantern", x: 26, y: 23 },
      { kind: "lantern", x: 31, y: 23 },
      { kind: "tree", x: 2, y: 33 },
      { kind: "tree", x: 13, y: 33 },
      { kind: "tree", x: 44, y: 33 },
      { kind: "tree", x: 55, y: 33 },
      { kind: "flowerbed", x: 2, y: 21, d: 2 },
      { kind: "flowerbed", x: 55, y: 21, d: 2 },
      { kind: "lantern", x: 24, y: 30 },
      { kind: "lantern", x: 33, y: 30 },
    ],
    crowd: [
      [21, 25, "right"],
      [22, 25, "left"],
      [35, 24, "right"],
      [36, 24, "left"],
      [17, 17, "right"],
      [18, 17, "left"],
      [9, 23, "right"],
      [10, 23, "left"],
      [47, 23, "right"],
      [48, 23, "left"],
      [30, 33, "right"],
      [31, 33, "left"],
    ],
    directories: [
      { x: 25, y: 33 },
      { x: 32, y: 33 },
    ],
  };
}

/** Galería tipo museo: hall de entrada, una galería larga con salas y el auditorio al fondo de un pasillo. */
function gallery(): Layout {
  return {
    w: 56,
    h: 40,
    floors: [
      { x: 22, y: 30, w: 12, h: 7 }, // hall de entrada
      { x: 25, y: 28, w: 6, h: 2 },
      { x: 4, y: 22, w: 48, h: 6 }, // galería
      { x: 24, y: 10, w: 8, h: 12 }, // pasillo al auditorio
    ],
    exit: { x: 27, y: 37 },
    spawn: { x: 27, y: 34 },
    main: { x: 26, y: 9 },
    slots: [
      { x: 20, y: 21, zone: "Galería oeste" },
      { x: 34, y: 21, zone: "Galería este" },
      { x: 15, y: 21, zone: "Galería oeste" },
      { x: 39, y: 21, zone: "Galería este" },
      { x: 10, y: 21, zone: "Galería oeste" },
      { x: 44, y: 21, zone: "Galería este" },
      { x: 5, y: 21, zone: "Galería oeste" },
      { x: 49, y: 21, zone: "Galería este" },
    ],
    decor: [
      { kind: "sponsors", x: 22, y: 29, w: 3 },
      { kind: "sponsors", x: 31, y: 29, w: 3 },
      { kind: "sponsors", x: 24, y: 9, w: 2 },
      { kind: "sponsors", x: 30, y: 9, w: 2 },
    ],
    furni: [
      { kind: "carpet", x: 27, y: 10, w: 2, d: 27, color: "#d6d3cd" },
      { kind: "carpet", x: 4, y: 25, w: 48, d: 1, color: "#d6d3cd" },
      { kind: "sculpture", x: 9, y: 27 },
      { kind: "sculpture", x: 18, y: 27 },
      { kind: "sculpture", x: 37, y: 27 },
      { kind: "sculpture", x: 46, y: 27 },
      { kind: "bigplant", x: 4, y: 27 },
      { kind: "bigplant", x: 51, y: 27 },
      { kind: "totem", x: 22, y: 26 },
      { kind: "totem", x: 33, y: 26 },
      { kind: "lamp", x: 24, y: 12 },
      { kind: "lamp", x: 31, y: 12 },
      { kind: "sculpture", x: 24, y: 17 },
      { kind: "sculpture", x: 31, y: 17 },
      { kind: "bigplant", x: 22, y: 36 },
      { kind: "bigplant", x: 33, y: 36 },
    ],
    crowd: [
      [12, 23, "right"],
      [13, 23, "left"],
      [41, 26, "right"],
      [42, 26, "left"],
      [29, 31, "right"],
      [30, 31, "left"],
      [26, 15, "right"],
      [27, 15, "left"],
      [6, 26, "right"],
      [7, 26, "left"],
    ],
    directories: [
      { x: 24, y: 33 },
      { x: 31, y: 33 },
    ],
  };
}

/** Pueblo: patio de llegada, una calle principal con salas y una calle alta con el auditorio. */
function village(): Layout {
  return {
    w: 56,
    h: 42,
    floors: [
      { x: 22, y: 31, w: 12, h: 8 }, // patio de llegada
      { x: 25, y: 30, w: 6, h: 1 },
      { x: 2, y: 24, w: 52, h: 6 }, // calle principal
      { x: 10, y: 18, w: 3, h: 6 }, // callejón oeste
      { x: 43, y: 18, w: 3, h: 6 }, // callejón este
      { x: 8, y: 12, w: 40, h: 6 }, // calle alta
    ],
    exit: { x: 27, y: 39 },
    spawn: { x: 27, y: 36 },
    main: { x: 26, y: 11 },
    slots: [
      { x: 20, y: 23, zone: "Calle principal" },
      { x: 33, y: 23, zone: "Calle principal" },
      { x: 14, y: 11, zone: "Calle alta" },
      { x: 38, y: 11, zone: "Calle alta" },
      { x: 15, y: 23, zone: "Calle principal" },
      { x: 38, y: 23, zone: "Calle principal" },
      { x: 4, y: 23, zone: "Calle principal" },
      { x: 48, y: 23, zone: "Calle principal" },
    ],
    decor: [
      { kind: "sponsors", x: 18, y: 11, w: 5 },
      { kind: "sponsors", x: 32, y: 11, w: 5 },
      { kind: "sponsors", x: 24, y: 23, w: 6 },
      { kind: "window", x: 7, y: 23, w: 2 },
      { kind: "window", x: 51, y: 23, w: 2 },
      { kind: "shelf", x: 9, y: 11, w: 2 },
      { kind: "window", x: 44, y: 11, w: 2 },
      { kind: "fireplace", x: 41, y: 11, w: 2 },
    ],
    furni: [
      { kind: "carpet", x: 27, y: 30, w: 2, d: 9, color: "#8e6a45" },
      { kind: "carpet", x: 2, y: 27, w: 52, d: 1, color: "#8e6a45" },
      { kind: "carpet", x: 8, y: 15, w: 40, d: 1, color: "#8e6a45" },
      { kind: "carpet", x: 11, y: 16, w: 1, d: 11, color: "#8e6a45" },
      { kind: "carpet", x: 44, y: 16, w: 1, d: 11, color: "#8e6a45" },
      { kind: "barrel", x: 2, y: 24 },
      { kind: "barrel", x: 53, y: 24 },
      { kind: "lantern", x: 9, y: 29 },
      { kind: "lantern", x: 46, y: 29 },
      { kind: "lantern", x: 24, y: 17 },
      { kind: "lantern", x: 31, y: 17 },
      { kind: "table", x: 17, y: 29, w: 2 },
      { kind: "table", x: 37, y: 29, w: 2 },
      { kind: "totem", x: 22, y: 31 },
      { kind: "totem", x: 33, y: 31 },
      { kind: "plant", x: 8, y: 17 },
      { kind: "plant", x: 47, y: 17 },
      { kind: "barrel", x: 22, y: 38 },
      { kind: "barrel", x: 33, y: 38 },
      { kind: "bookshelf", x: 20, y: 12 },
      { kind: "bookshelf", x: 35, y: 12 },
    ],
    crowd: [
      [13, 26, "right"],
      [14, 26, "left"],
      [40, 26, "right"],
      [41, 26, "left"],
      [18, 14, "right"],
      [19, 14, "left"],
      [36, 16, "right"],
      [37, 16, "left"],
      [25, 34, "right"],
      [26, 34, "left"],
      [5, 28, "right"],
      [6, 28, "left"],
    ],
    directories: [
      { x: 24, y: 35 },
      { x: 31, y: 35 },
    ],
  };
}

const LAYOUTS_BY_THEME: Record<ThemeId, () => Layout> = {
  tech: techCampus,
  medieval: castle,
  garden: park,
  minimal: gallery,
  rustic: village,
};

/** El recinto del evento: cada temática tiene su propio plano. */
export function venueMap(theme: ThemeId, rooms: Pick<Room, "id" | "name" | "color" | "main">[]): SceneMap {
  const L = LAYOUTS_BY_THEME[theme]();
  const main = rooms.find((r) => r.main) ?? rooms[0];
  const others = rooms.filter((r) => r !== main).slice(0, ROOMS_PER_EVENT);
  const doors: Door[] = [];
  if (main) doors.push({ side: "top", x: L.main.x, y: L.main.y, w: 4, id: main.id, label: main.name, color: main.color, theme, zone: "Auditorio principal", main: true });
  L.slots.forEach((slot, i) => {
    const room = others[i];
    if (room) doors.push({ side: "top", x: slot.x, y: slot.y, w: 2, id: room.id, label: room.name, color: room.color, theme, zone: slot.zone, main: false });
  });
  // Los puestos sin sala muestran un cuadro en el muro.
  const free = L.slots.slice(others.length).map((s): Decor => ({ kind: "art", x: s.x, y: s.y, w: 2, color: "#9aa5b1" }));
  return finish({
    ...empty,
    w: L.w,
    h: L.h,
    tiles: carve(L.w, L.h, L.floors),
    style: theme,
    spawn: L.spawn,
    furni: [...L.furni, ...L.directories.map((d): Furni => ({ kind: "directory", x: d.x, y: d.y }))],
    decor: [...L.decor, ...free, { kind: "entrance", x: L.exit.x, y: L.exit.y, w: 2 }],
    doors,
    crowd: L.crowd.map(([x, y, dir], i) => attendee(i, x, y, dir)),
    exit: { side: "bottom", x: L.exit.x, y: L.exit.y, w: 2 },
    directories: L.directories,
  });
}

/** Lista de comprobaciones del plano, para las pruebas: puertas alcanzables y libres. */
export function checkVenue(map: SceneMap) {
  const problems: string[] = [];
  const seen = new Set<string>([`${map.spawn.x},${map.spawn.y}`]);
  const queue: Tile[] = [map.spawn];
  while (queue.length) {
    const t = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: t.x + dx!, y: t.y + dy! };
      const k = `${n.x},${n.y}`;
      if (!seen.has(k) && isWalkable(map, n.x, n.y)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  for (const d of map.doors) {
    for (const t of spanTiles(d)) if (!seen.has(`${t.x},${t.y}`)) problems.push(`puerta ${d.label} no alcanzable en ${t.x},${t.y}`);
    if (map.tiles[d.y]?.[d.x] !== "=" || map.tiles[d.y - 1]?.[d.x] !== "=" || map.tiles[d.y + 1]?.[d.x] !== ".") problems.push(`puerta ${d.label} fuera de una cara de muro`);
    if (map.tiles[d.y - 2]?.[d.x] !== "#") problems.push(`puerta ${d.label} sin muro arriba para su cartel`);
  }
  if (map.exit && !seen.has(`${map.exit.x},${map.exit.y}`)) problems.push("salida no alcanzable");
  for (const d of map.directories) if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen.has(`${d.x + dx!},${d.y + dy!}`))) problems.push(`directorio ${d.x},${d.y} inaccesible`);
  for (const d of map.decor) {
    if (d.kind === "entrance") continue;
    for (let x = d.x; x < d.x + (d.w ?? 1); x++) if (map.tiles[d.y]?.[x] !== "=" && !map.doors.some((door) => door.y === d.y && x >= door.x && x < door.x + door.w)) problems.push(`adorno ${d.kind} en ${x},${d.y} fuera de una cara de muro`);
    if (map.doors.some((door) => door.y === d.y && d.x < door.x + door.w && d.x + (d.w ?? 1) > door.x)) problems.push(`adorno ${d.kind} encima de una puerta`);
  }
  return problems;
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
