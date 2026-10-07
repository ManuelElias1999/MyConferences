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
  | "pingpong"
  | "foosball"
  | "cafetable"
  | "parasol"
  | "eventscreen"
  | "crenel"
  | "telescope"
  | "chess"
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

/** Escalera: se pisa para cambiar de piso. */
export interface Stairs extends Span {
  to: number;
  label: string;
}

/** Piso distinto para una zona del mapa: pasto en los patios, madera en las terrazas, etc. */
export type AreaFloor = "grass" | "wood" | "stone" | "tiles" | "deck";

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
  floor: AreaFloor;
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
  stairs: Stairs[];
  /** Zonas con otro piso (patios, terrazas). */
  areas: Area[];
  /** Letreros pintados en el piso de cada zona: «Cafetería», «Patio»… */
  labels: { x: number; y: number; text: string }[];
  /** Nombre del piso, para mostrarlo en pantalla. */
  floorName: string;
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
  // Puertas, escaleras y salida se pueden pisar aunque estén en el muro.
  for (const s of [...map.doors, ...map.stairs, ...(map.exit ? [map.exit] : [])]) for (const t of spanTiles(s)) blocked[t.y * map.w + t.x] = false;
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
  stairs: [],
  areas: [],
  labels: [],
  floorName: "",
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
const SOFA: Record<ThemeId, string> = { tech: "#2f6bff", minimal: "#9aa5b1", rustic: "#a0522d", medieval: "#7a2a3a", garden: "#5a8f3e" };

/** Objetos de ambiente de cada estilo (también se usan en las salas). */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["ledpillar", "robot", "rack", "ledpillar"],
  minimal: ["bigplant", "lamp", "sculpture", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
};

/** Salas por piso. Todo evento tiene al menos ocho más el auditorio; las siguientes van al piso de arriba. */
export const ROOMS_PER_FLOOR = 8;
export const MIN_ROOMS = ROOMS_PER_FLOOR + 1;
export const MAX_ROOMS = ROOMS_PER_FLOOR * 2 + 1;

/** Plano de un piso: zonas de piso, puertas, escaleras y decoración. */
interface Level {
  name: string;
  w: number;
  h: number;
  floors: Rect[];
  areas?: Area[];
  labels?: { x: number; y: number; text: string }[];
  /** Salida a recepción (solo en la planta baja), en el muro sur. */
  exit?: Tile;
  spawn: Tile;
  /** Puerta del auditorio principal (solo en la planta baja). */
  main?: Tile;
  /** Puestos de sala en el orden en que se llenan. */
  slots: (Tile & { zone: string })[];
  stairs: { x: number; y: number; side: Side; to: number; label: string }[];
  decor: Decor[];
  furni: Furni[];
  crowd: [x: number, y: number, dir: Dir][];
  directories: Tile[];
}

const lounge = (x: number, y: number, color: string): Furni[] => [
  { kind: "rug", x, y, w: 5, d: 4, color: "#e9e4dc" },
  { kind: "sofa", x, y, w: 3, color, dir: "down" },
  { kind: "armchair", x: x + 4, y, color: "#ffb703" },
  { kind: "coffeetable", x, y: y + 2, w: 2 },
];

// ----- Tecnológica: campus futurista -----

function techGround(): Level {
  return {
    name: "Planta baja",
    w: 60,
    h: 46,
    floors: [
      { x: 22, y: 28, w: 16, h: 10 }, // atrio
      { x: 26, y: 10, w: 8, h: 18 }, // pasillo central
      { x: 10, y: 12, w: 16, h: 9 }, // cafetería
      { x: 34, y: 12, w: 16, h: 9 }, // zona de juegos
      { x: 4, y: 31, w: 18, h: 5 }, // ala oeste
      { x: 38, y: 31, w: 18, h: 5 }, // ala este
      { x: 48, y: 36, w: 4, h: 2 },
      { x: 40, y: 38, w: 16, h: 6 }, // patio
    ],
    areas: [
      { x: 48, y: 36, w: 4, h: 2, floor: "grass" },
      { x: 40, y: 38, w: 16, h: 6, floor: "grass" },
      { x: 10, y: 12, w: 16, h: 9, floor: "wood" },
    ],
    labels: [
      { x: 18, y: 19, text: "CAFETERÍA" },
      { x: 42, y: 19, text: "ZONA DE JUEGOS" },
      { x: 48, y: 42, text: "PATIO" },
      { x: 30, y: 36, text: "LOBBY" },
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
    stairs: [{ x: 22, y: 27, side: "top", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "sponsors", x: 34, y: 27, w: 4 },
      { kind: "neon", x: 26, y: 9, w: 2, text: "AI", color: "#22d3ee" },
      { kind: "neon", x: 32, y: 9, w: 2, text: "</>", color: "#f472b6" },
      { kind: "neon", x: 15, y: 11, w: 4, text: "CAFÉ", color: "#ffb703" },
      { kind: "window", x: 20, y: 11, w: 3 },
      { kind: "neon", x: 36, y: 11, w: 5, text: "GAME ZONE", color: "#a78bfa" },
      { kind: "sponsors", x: 43, y: 11, w: 5 },
    ],
    furni: [
      { kind: "neonpath", x: 29, y: 10, w: 2, d: 18, color: "#22d3ee" },
      { kind: "neonpath", x: 4, y: 33, w: 18, d: 1, color: "#a78bfa" },
      { kind: "neonpath", x: 38, y: 33, w: 18, d: 1, color: "#a78bfa" },
      // Lobby: pantalla gigante del evento al centro y dos salas de estar.
      { kind: "eventscreen", x: 27, y: 30, w: 6 },
      ...lounge(22, 32, "#2f6bff"),
      ...lounge(33, 32, "#a78bfa"),
      { kind: "ledpillar", x: 37, y: 28 },
      { kind: "robot", x: 33, y: 29 },
      // Pasillo central.
      { kind: "totem", x: 26, y: 14 },
      { kind: "totem", x: 33, y: 14 },
      { kind: "ledpillar", x: 26, y: 22 },
      { kind: "ledpillar", x: 33, y: 22 },
      { kind: "hologram", x: 26, y: 17, w: 2, d: 2 },
      // Cafetería.
      { kind: "coffeebar", x: 10, y: 12, w: 4 },
      { kind: "cafetable", x: 12, y: 15, w: 2 },
      { kind: "cafetable", x: 16, y: 15, w: 2 },
      { kind: "cafetable", x: 20, y: 15, w: 2 },
      { kind: "cafetable", x: 12, y: 18, w: 2 },
      { kind: "cafetable", x: 20, y: 18, w: 2 },
      { kind: "bigplant", x: 10, y: 20 },
      // Zona de juegos.
      { kind: "pingpong", x: 35, y: 14, w: 3 },
      { kind: "pingpong", x: 35, y: 18, w: 3 },
      { kind: "foosball", x: 41, y: 15, w: 2 },
      { kind: "arcade", x: 47, y: 12 },
      { kind: "arcade", x: 48, y: 12 },
      { kind: "arcade", x: 49, y: 12 },
      { kind: "beanbag", x: 45, y: 18, color: "#22d3ee" },
      { kind: "beanbag", x: 47, y: 18, color: "#f472b6" },
      { kind: "robot", x: 49, y: 20 },
      // Patio.
      { kind: "parasol", x: 41, y: 40, w: 2 },
      { kind: "parasol", x: 45, y: 41, w: 2 },
      { kind: "parasol", x: 52, y: 40, w: 2 },
      { kind: "tree", x: 40, y: 38 },
      { kind: "tree", x: 55, y: 38 },
      { kind: "bench", x: 48, y: 43, w: 3 },
      { kind: "flowerbed", x: 40, y: 43, w: 3 },
      { kind: "ledpillar", x: 4, y: 35 },
      { kind: "ledpillar", x: 55, y: 35 },
    ],
    crowd: [
      [25, 36, "right"],
      [26, 36, "left"],
      [13, 14, "down"],
      [17, 17, "right"],
      [18, 17, "left"],
      [39, 15, "right"],
      [44, 15, "left"],
      [43, 40, "right"],
      [44, 40, "left"],
      [50, 42, "right"],
      [51, 42, "left"],
      [12, 34, "right"],
      [13, 34, "left"],
      [27, 25, "right"],
      [28, 25, "left"],
    ],
    directories: [
      { x: 24, y: 37 },
      { x: 35, y: 37 },
    ],
  };
}

// ----- Pisos altos: pasillo de salas, terraza y zona tranquila -----

interface UpperTheme {
  name: string;
  terrace: string;
  chill: string;
  terraceFloor: AreaFloor;
  extra: Furni[];
  decor: Decor[];
}

const UPPER: Record<Exclude<ThemeId, "medieval">, UpperTheme> = {
  tech: {
    name: "Piso 1",
    terrace: "SKY LOUNGE",
    chill: "ZONA CHILL",
    terraceFloor: "deck",
    extra: [
      { kind: "hologram", x: 40, y: 22, w: 2, d: 2 },
      { kind: "ledpillar", x: 4, y: 21 },
      { kind: "arcade", x: 16, y: 21 },
      { kind: "robot", x: 27, y: 21 },
    ],
    decor: [{ kind: "neon", x: 4, y: 20, w: 3, text: "CHILL", color: "#22d3ee" }],
  },
  garden: {
    name: "Mirador",
    terrace: "MIRADOR",
    chill: "INVERNADERO",
    terraceFloor: "deck",
    extra: [
      { kind: "tree", x: 4, y: 21 },
      { kind: "flowerbed", x: 14, y: 21, w: 3 },
      { kind: "fountain", x: 40, y: 22, w: 2, d: 2 },
      { kind: "lantern", x: 27, y: 21 },
    ],
    decor: [{ kind: "ivy", x: 4, y: 20, w: 3 }],
  },
  minimal: {
    name: "Piso 1",
    terrace: "TERRAZA",
    chill: "BIBLIOTECA",
    terraceFloor: "deck",
    extra: [
      { kind: "bookshelf", x: 4, y: 21 },
      { kind: "bookshelf", x: 5, y: 21 },
      { kind: "sculpture", x: 40, y: 22 },
      { kind: "lamp", x: 27, y: 21 },
    ],
    decor: [{ kind: "art", x: 4, y: 20, w: 3, color: "#e9b8a4" }],
  },
  rustic: {
    name: "Altillo",
    terrace: "TERRAZA",
    chill: "RINCÓN DE LECTURA",
    terraceFloor: "wood",
    extra: [
      { kind: "bookshelf", x: 4, y: 21 },
      { kind: "barrel", x: 16, y: 21 },
      { kind: "lantern", x: 40, y: 22 },
      { kind: "barrel", x: 27, y: 21 },
    ],
    decor: [{ kind: "fireplace", x: 4, y: 20, w: 3 }],
  },
};

function upperCorridor(theme: Exclude<ThemeId, "medieval">): Level {
  const u = UPPER[theme];
  return {
    name: u.name,
    w: 48,
    h: 30,
    floors: [
      { x: 4, y: 14, w: 40, h: 5 }, // pasillo de salas
      { x: 22, y: 19, w: 4, h: 1 },
      { x: 20, y: 20, w: 8, h: 6 }, // descanso de la escalera
      { x: 36, y: 19, w: 3, h: 2 },
      { x: 30, y: 21, w: 14, h: 7 }, // terraza
      { x: 8, y: 19, w: 3, h: 2 },
      { x: 4, y: 21, w: 14, h: 7 }, // zona tranquila
    ],
    areas: [
      { x: 30, y: 21, w: 14, h: 7, floor: u.terraceFloor },
      { x: 36, y: 19, w: 3, h: 2, floor: u.terraceFloor },
    ],
    labels: [
      { x: 37, y: 26, text: u.terrace },
      { x: 11, y: 26, text: u.chill },
    ],
    spawn: { x: 23, y: 25 },
    slots: [6, 11, 16, 21, 26, 31, 36, 41].map((x) => ({ x, y: 13, zone: u.name })),
    stairs: [{ x: 23, y: 26, side: "bottom", to: 0, label: "Bajar a la planta baja" }],
    decor: [{ kind: "sponsors", x: 31, y: 20, w: 4 }, { kind: "sponsors", x: 39, y: 20, w: 4 }, { kind: "sponsors", x: 12, y: 20, w: 5 }, ...u.decor],
    furni: [
      { kind: "carpet", x: 4, y: 16, w: 40, d: 1, color: CARPET[theme] },
      { kind: "coffeebar", x: 31, y: 21, w: 3 },
      { kind: "parasol", x: 32, y: 24, w: 2 },
      { kind: "parasol", x: 36, y: 24, w: 2 },
      { kind: "telescope", x: 43, y: 27 },
      { kind: "plant", x: 30, y: 27 },
      ...lounge(5, 23, SOFA[theme]),
      { kind: "beanbag", x: 12, y: 24, color: "#ffb703" },
      { kind: "beanbag", x: 14, y: 24, color: "#ef476f" },
      ...u.extra,
    ],
    crowd: [
      [33, 26, "right"],
      [34, 26, "left"],
      [10, 23, "right"],
      [11, 23, "left"],
      [18, 15, "right"],
      [19, 15, "left"],
    ],
    directories: [{ x: 27, y: 24 }],
  };
}

// ----- Medieval: castillo con patio de armas, taberna y azotea -----

function castleGround(): Level {
  return {
    name: "Planta baja",
    w: 56,
    h: 42,
    floors: [
      { x: 14, y: 18, w: 28, h: 18 }, // patio de armas
      { x: 24, y: 10, w: 8, h: 8 }, // paso al gran salón
      { x: 4, y: 12, w: 12, h: 4 }, // torre oeste
      { x: 14, y: 16, w: 2, h: 2 },
      { x: 2, y: 24, w: 12, h: 6 }, // galería oeste
      { x: 2, y: 32, w: 12, h: 7 }, // taberna
      { x: 40, y: 12, w: 12, h: 4 }, // torre este
      { x: 40, y: 16, w: 2, h: 2 },
      { x: 42, y: 24, w: 12, h: 6 }, // galería este
      { x: 42, y: 32, w: 12, h: 7 }, // sala de juegos
    ],
    areas: [
      { x: 15, y: 29, w: 9, h: 6, floor: "grass" },
      { x: 32, y: 29, w: 9, h: 6, floor: "grass" },
      { x: 2, y: 32, w: 12, h: 7, floor: "wood" },
      { x: 42, y: 32, w: 12, h: 7, floor: "wood" },
    ],
    labels: [
      { x: 8, y: 38, text: "TABERNA" },
      { x: 48, y: 38, text: "SALA DE JUEGOS" },
      { x: 19, y: 34, text: "JARDÍN" },
      { x: 36, y: 34, text: "JARDÍN" },
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
    stairs: [{ x: 22, y: 17, side: "top", to: 1, label: "Subir a la azotea" }],
    decor: [
      { kind: "sponsors", x: 16, y: 17, w: 5 },
      { kind: "sponsors", x: 35, y: 17, w: 5 },
      { kind: "torch", x: 21, y: 17 },
      { kind: "banner", x: 33, y: 17, color: "#9b2335" },
      { kind: "torch", x: 34, y: 17 },
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
      { kind: "carpet", x: 27, y: 10, w: 2, d: 10, color: "#9b2335" },
      { kind: "carpet", x: 2, y: 27, w: 52, d: 1, color: "#9b2335" },
      { kind: "eventscreen", x: 25, y: 23, w: 6 },
      { kind: "fountain", x: 18, y: 21, w: 2, d: 2 },
      { kind: "fountain", x: 36, y: 21, w: 2, d: 2 },
      { kind: "armor", x: 24, y: 11 },
      { kind: "armor", x: 31, y: 11 },
      { kind: "candelabra", x: 24, y: 15 },
      { kind: "candelabra", x: 31, y: 15 },
      { kind: "pillar", x: 14, y: 18 },
      { kind: "pillar", x: 41, y: 18 },
      { kind: "tree", x: 15, y: 30 },
      { kind: "tree", x: 40, y: 30 },
      { kind: "bench", x: 17, y: 32, w: 3 },
      { kind: "bench", x: 36, y: 32, w: 3 },
      { kind: "flowerbed", x: 21, y: 29, w: 2 },
      { kind: "flowerbed", x: 33, y: 29, w: 2 },
      // Taberna.
      { kind: "coffeebar", x: 2, y: 32, w: 4 },
      { kind: "barrel", x: 7, y: 32 },
      { kind: "barrel", x: 8, y: 32 },
      { kind: "cafetable", x: 3, y: 35, w: 2 },
      { kind: "cafetable", x: 8, y: 35, w: 2 },
      { kind: "candelabra", x: 13, y: 38 },
      // Sala de juegos.
      { kind: "chess", x: 43, y: 33, w: 2 },
      { kind: "chess", x: 47, y: 33, w: 2 },
      { kind: "chess", x: 43, y: 36, w: 2 },
      { kind: "table", x: 49, y: 36, w: 3 },
      { kind: "armor", x: 53, y: 32 },
      { kind: "armor", x: 2, y: 24 },
      { kind: "armor", x: 53, y: 24 },
      { kind: "barrel", x: 4, y: 15 },
      { kind: "barrel", x: 51, y: 15 },
    ],
    crowd: [
      [22, 26, "right"],
      [23, 26, "left"],
      [32, 26, "right"],
      [33, 26, "left"],
      [19, 31, "right"],
      [20, 31, "left"],
      [35, 31, "right"],
      [36, 31, "left"],
      [5, 37, "right"],
      [6, 37, "left"],
      [46, 35, "right"],
      [47, 35, "left"],
      [6, 26, "right"],
      [7, 26, "left"],
    ],
    directories: [
      { x: 24, y: 33 },
      { x: 31, y: 33 },
    ],
  };
}

/** Azotea del castillo: almenas, catalejos, braseros y las torres altas con más salas. */
function castleRoof(): Level {
  const crenels: Furni[] = [];
  for (let x = 3; x <= 44; x += 2) if (x !== 23 && x !== 24 && x !== 25) crenels.push({ kind: "crenel", x, y: 27 });
  for (let y = 12; y <= 25; y += 2) crenels.push({ kind: "crenel", x: 3, y }, { kind: "crenel", x: 44, y });
  return {
    name: "Azotea",
    w: 48,
    h: 32,
    floors: [{ x: 3, y: 10, w: 42, h: 18 }],
    areas: [{ x: 7, y: 17, w: 8, h: 6, floor: "grass" }],
    labels: [
      { x: 24, y: 20, text: "AZOTEA" },
      { x: 11, y: 22, text: "JARDÍN" },
      { x: 37, y: 22, text: "MIRADOR" },
    ],
    spawn: { x: 23, y: 26 },
    slots: [6, 11, 16, 21, 26, 31, 36, 41].map((x) => ({ x, y: 9, zone: "Torres de la azotea" })),
    stairs: [{ x: 23, y: 28, side: "bottom", to: 0, label: "Bajar al patio de armas" }],
    decor: [],
    furni: [
      ...crenels,
      { kind: "carpet", x: 5, y: 12, w: 38, d: 1, color: "#9b2335" },
      { kind: "telescope", x: 35, y: 24 },
      { kind: "telescope", x: 41, y: 24 },
      { kind: "candelabra", x: 18, y: 16 },
      { kind: "candelabra", x: 29, y: 16 },
      { kind: "tree", x: 7, y: 17 },
      { kind: "bench", x: 9, y: 21, w: 3 },
      { kind: "flowerbed", x: 12, y: 17, w: 2 },
      { kind: "cafetable", x: 34, y: 18, w: 2 },
      { kind: "cafetable", x: 39, y: 18, w: 2 },
      { kind: "armor", x: 4, y: 11 },
      { kind: "armor", x: 43, y: 11 },
      { kind: "barrel", x: 20, y: 24 },
      { kind: "barrel", x: 28, y: 24 },
    ],
    crowd: [
      [36, 21, "right"],
      [37, 21, "left"],
      [10, 19, "right"],
      [11, 19, "left"],
      [25, 15, "right"],
      [26, 15, "left"],
    ],
    directories: [{ x: 26, y: 25 }],
  };
}

// ----- Jardín: parque -----

function parkGround(): Level {
  return {
    name: "Planta baja",
    w: 58,
    h: 40,
    floors: [
      { x: 24, y: 30, w: 10, h: 7 }, // plaza de entrada
      { x: 26, y: 28, w: 6, h: 2 },
      { x: 14, y: 16, w: 30, h: 12 }, // jardín central
      { x: 2, y: 20, w: 12, h: 14 }, // jardín oeste (café)
      { x: 44, y: 20, w: 12, h: 14 }, // jardín este (juegos)
    ],
    areas: [
      { x: 2, y: 27, w: 12, h: 7, floor: "deck" },
      { x: 24, y: 30, w: 10, h: 7, floor: "stone" },
    ],
    labels: [
      { x: 8, y: 33, text: "CAFÉ DEL JARDÍN" },
      { x: 50, y: 33, text: "ZONA RECREATIVA" },
      { x: 20, y: 26, text: "PÍCNIC" },
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
    stairs: [{ x: 24, y: 29, side: "top", to: 1, label: "Subir al mirador" }],
    decor: [
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
      { kind: "eventscreen", x: 25, y: 19, w: 8 },
      { kind: "fountain", x: 35, y: 19, w: 2, d: 2 },
      { kind: "tree", x: 14, y: 17 },
      { kind: "tree", x: 43, y: 17 },
      { kind: "tree", x: 14, y: 27 },
      { kind: "tree", x: 43, y: 27 },
      { kind: "flowerbed", x: 38, y: 22, w: 3 },
      // Pícnic.
      { kind: "rug", x: 17, y: 21, w: 5, d: 4, color: "#e5484d" },
      { kind: "parasol", x: 18, y: 22, w: 2 },
      { kind: "totem", x: 23, y: 24 },
      { kind: "totem", x: 34, y: 24 },
      // Café del jardín.
      { kind: "coffeebar", x: 2, y: 27, w: 3 },
      { kind: "parasol", x: 6, y: 28, w: 2 },
      { kind: "parasol", x: 10, y: 28, w: 2 },
      { kind: "parasol", x: 6, y: 31, w: 2 },
      { kind: "parasol", x: 10, y: 31, w: 2 },
      { kind: "tree", x: 2, y: 21 },
      { kind: "flowerbed", x: 11, y: 21, w: 2 },
      // Zona recreativa.
      { kind: "pingpong", x: 45, y: 27, w: 3 },
      { kind: "chess", x: 50, y: 27, w: 2 },
      { kind: "beanbag", x: 46, y: 31, color: "#ffb703" },
      { kind: "beanbag", x: 49, y: 31, color: "#ef476f" },
      { kind: "tree", x: 55, y: 21 },
      { kind: "fountain", x: 50, y: 22, w: 2, d: 2 },
      { kind: "lantern", x: 33, y: 30 },
      { kind: "lantern", x: 24, y: 35 },
    ],
    crowd: [
      [19, 24, "right"],
      [20, 24, "left"],
      [36, 24, "right"],
      [37, 24, "left"],
      [8, 30, "right"],
      [9, 30, "left"],
      [47, 29, "right"],
      [48, 29, "left"],
      [30, 33, "right"],
      [31, 33, "left"],
    ],
    directories: [
      { x: 25, y: 33 },
      { x: 32, y: 33 },
    ],
  };
}

// ----- Minimalista: galería tipo museo -----

function galleryGround(): Level {
  return {
    name: "Planta baja",
    w: 56,
    h: 40,
    floors: [
      { x: 22, y: 30, w: 12, h: 7 }, // hall de entrada
      { x: 25, y: 28, w: 6, h: 2 },
      { x: 4, y: 22, w: 48, h: 6 }, // galería
      { x: 24, y: 10, w: 8, h: 12 }, // pasillo al auditorio
      { x: 10, y: 12, w: 14, h: 6 }, // lounge
      { x: 32, y: 12, w: 14, h: 6 }, // jardín interior
      { x: 10, y: 28, w: 3, h: 2 },
      { x: 4, y: 30, w: 16, h: 8 }, // café
      { x: 43, y: 28, w: 3, h: 2 },
      { x: 36, y: 30, w: 16, h: 8 }, // estudio de juegos
    ],
    areas: [
      { x: 32, y: 12, w: 14, h: 6, floor: "grass" },
      { x: 4, y: 30, w: 16, h: 8, floor: "wood" },
    ],
    labels: [
      { x: 17, y: 16, text: "LOUNGE" },
      { x: 39, y: 16, text: "JARDÍN INTERIOR" },
      { x: 12, y: 36, text: "CAFÉ" },
      { x: 44, y: 36, text: "ESTUDIO DE JUEGOS" },
    ],
    exit: { x: 27, y: 37 },
    spawn: { x: 27, y: 35 },
    main: { x: 26, y: 9 },
    slots: [
      { x: 20, y: 21, zone: "Galería oeste" },
      { x: 34, y: 21, zone: "Galería este" },
      { x: 15, y: 21, zone: "Galería oeste" },
      { x: 39, y: 21, zone: "Galería este" },
      { x: 5, y: 21, zone: "Galería oeste" },
      { x: 44, y: 21, zone: "Galería este" },
      { x: 10, y: 21, zone: "Galería oeste" },
      { x: 49, y: 21, zone: "Galería este" },
    ],
    stairs: [{ x: 22, y: 29, side: "top", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "sponsors", x: 31, y: 29, w: 3 },
      { kind: "sponsors", x: 24, y: 9, w: 2 },
      { kind: "sponsors", x: 30, y: 9, w: 2 },
      { kind: "art", x: 12, y: 11, w: 3, color: "#e9b8a4" },
      { kind: "art", x: 18, y: 11, w: 3, color: "#a4c3e9" },
      { kind: "window", x: 34, y: 11, w: 4 },
      { kind: "window", x: 40, y: 11, w: 4 },
    ],
    furni: [
      { kind: "carpet", x: 27, y: 10, w: 2, d: 18, color: "#d6d3cd" },
      { kind: "carpet", x: 4, y: 25, w: 48, d: 1, color: "#d6d3cd" },
      { kind: "eventscreen", x: 25, y: 32, w: 6 },
      { kind: "sculpture", x: 9, y: 27 },
      { kind: "sculpture", x: 18, y: 27 },
      { kind: "sculpture", x: 37, y: 27 },
      { kind: "bigplant", x: 51, y: 27 },
      { kind: "bigplant", x: 4, y: 27 },
      ...lounge(12, 13, "#9aa5b1"),
      ...lounge(18, 13, "#c9b7a7"),
      { kind: "tree", x: 33, y: 13 },
      { kind: "tree", x: 44, y: 13 },
      { kind: "fountain", x: 38, y: 13, w: 2, d: 2 },
      { kind: "bench", x: 35, y: 17, w: 3 },
      { kind: "bench", x: 41, y: 17, w: 3 },
      { kind: "coffeebar", x: 4, y: 30, w: 4 },
      { kind: "cafetable", x: 9, y: 31, w: 2 },
      { kind: "cafetable", x: 13, y: 31, w: 2 },
      { kind: "cafetable", x: 17, y: 31, w: 2 },
      { kind: "cafetable", x: 9, y: 34, w: 2 },
      { kind: "cafetable", x: 15, y: 34, w: 2 },
      { kind: "pingpong", x: 37, y: 31, w: 3 },
      { kind: "foosball", x: 42, y: 31, w: 2 },
      { kind: "chess", x: 46, y: 31, w: 2 },
      { kind: "beanbag", x: 38, y: 35, color: "#e9b8a4" },
      { kind: "beanbag", x: 49, y: 35, color: "#a4c3e9" },
      { kind: "lamp", x: 24, y: 12 },
      { kind: "lamp", x: 31, y: 12 },
    ],
    crowd: [
      [12, 23, "right"],
      [13, 23, "left"],
      [41, 26, "right"],
      [42, 26, "left"],
      [16, 16, "right"],
      [17, 16, "left"],
      [36, 15, "right"],
      [37, 15, "left"],
      [11, 33, "right"],
      [12, 33, "left"],
      [44, 34, "right"],
      [45, 34, "left"],
    ],
    directories: [
      { x: 24, y: 35 },
      { x: 31, y: 35 },
    ],
  };
}

// ----- Rústica: pueblo -----

function villageGround(): Level {
  return {
    name: "Planta baja",
    w: 56,
    h: 42,
    floors: [
      { x: 22, y: 31, w: 12, h: 8 }, // patio de llegada
      { x: 25, y: 30, w: 6, h: 1 },
      { x: 2, y: 24, w: 52, h: 6 }, // calle principal
      { x: 10, y: 18, w: 3, h: 6 },
      { x: 43, y: 18, w: 3, h: 6 },
      { x: 8, y: 12, w: 40, h: 6 }, // calle alta
      { x: 8, y: 30, w: 3, h: 2 },
      { x: 2, y: 32, w: 18, h: 7 }, // fonda
      { x: 45, y: 30, w: 3, h: 2 },
      { x: 36, y: 32, w: 18, h: 7 }, // plaza de juegos
    ],
    areas: [
      { x: 8, y: 12, w: 6, h: 6, floor: "grass" },
      { x: 42, y: 12, w: 6, h: 6, floor: "grass" },
      { x: 36, y: 32, w: 18, h: 7, floor: "grass" },
    ],
    labels: [
      { x: 11, y: 38, text: "FONDA" },
      { x: 45, y: 38, text: "PLAZA DE JUEGOS" },
      { x: 11, y: 17, text: "HUERTO" },
      { x: 45, y: 17, text: "HUERTO" },
    ],
    exit: { x: 27, y: 39 },
    spawn: { x: 27, y: 37 },
    main: { x: 26, y: 11 },
    slots: [
      { x: 20, y: 23, zone: "Calle principal" },
      { x: 33, y: 23, zone: "Calle principal" },
      { x: 16, y: 11, zone: "Calle alta" },
      { x: 37, y: 11, zone: "Calle alta" },
      { x: 15, y: 23, zone: "Calle principal" },
      { x: 38, y: 23, zone: "Calle principal" },
      { x: 4, y: 23, zone: "Calle principal" },
      { x: 48, y: 23, zone: "Calle principal" },
    ],
    stairs: [{ x: 30, y: 23, side: "top", to: 1, label: "Subir al altillo" }],
    decor: [
      { kind: "sponsors", x: 19, y: 11, w: 5 },
      { kind: "sponsors", x: 31, y: 11, w: 5 },
      { kind: "sponsors", x: 24, y: 23, w: 5 },
      { kind: "window", x: 7, y: 23, w: 2 },
      { kind: "window", x: 51, y: 23, w: 2 },
      { kind: "shelf", x: 9, y: 11, w: 2 },
      { kind: "window", x: 44, y: 11, w: 2 },
    ],
    furni: [
      { kind: "carpet", x: 27, y: 30, w: 2, d: 9, color: "#8e6a45" },
      { kind: "carpet", x: 2, y: 27, w: 52, d: 1, color: "#8e6a45" },
      { kind: "carpet", x: 14, y: 15, w: 28, d: 1, color: "#8e6a45" },
      { kind: "eventscreen", x: 25, y: 33, w: 6 },
      { kind: "barrel", x: 2, y: 24 },
      { kind: "barrel", x: 53, y: 24 },
      { kind: "lantern", x: 24, y: 17 },
      { kind: "lantern", x: 31, y: 17 },
      { kind: "tree", x: 8, y: 12 },
      { kind: "flowerbed", x: 10, y: 13, w: 3 },
      { kind: "tree", x: 47, y: 12 },
      { kind: "flowerbed", x: 43, y: 13, w: 3 },
      { kind: "bench", x: 9, y: 16, w: 2 },
      { kind: "bench", x: 45, y: 16, w: 2 },
      // Fonda.
      { kind: "coffeebar", x: 2, y: 32, w: 4 },
      { kind: "barrel", x: 7, y: 32 },
      { kind: "cafetable", x: 4, y: 35, w: 2 },
      { kind: "cafetable", x: 9, y: 35, w: 2 },
      { kind: "cafetable", x: 14, y: 33, w: 2 },
      { kind: "cafetable", x: 14, y: 36, w: 2 },
      { kind: "lantern", x: 19, y: 32 },
      // Plaza de juegos.
      { kind: "pingpong", x: 38, y: 33, w: 3 },
      { kind: "chess", x: 43, y: 33, w: 2 },
      { kind: "parasol", x: 47, y: 33, w: 2 },
      { kind: "tree", x: 53, y: 32 },
      { kind: "bench", x: 39, y: 37, w: 3 },
      { kind: "barrel", x: 22, y: 38 },
      { kind: "barrel", x: 33, y: 38 },
    ],
    crowd: [
      [13, 26, "right"],
      [14, 26, "left"],
      [40, 26, "right"],
      [41, 26, "left"],
      [21, 14, "right"],
      [22, 14, "left"],
      [8, 37, "right"],
      [9, 37, "left"],
      [44, 36, "right"],
      [45, 36, "left"],
      [24, 36, "right"],
    ],
    directories: [
      { x: 24, y: 37 },
      { x: 31, y: 36 },
    ],
  };
}

const LEVELS: Record<ThemeId, () => Level[]> = {
  tech: () => [techGround(), upperCorridor("tech")],
  medieval: () => [castleGround(), castleRoof()],
  garden: () => [parkGround(), upperCorridor("garden")],
  minimal: () => [galleryGround(), upperCorridor("minimal")],
  rustic: () => [villageGround(), upperCorridor("rustic")],
};

function buildLevel(theme: ThemeId, L: Level, main: Pick<Room, "id" | "name" | "color"> | null, rooms: Pick<Room, "id" | "name" | "color">[]): SceneMap {
  const doors: Door[] = [];
  if (main && L.main) doors.push({ side: "top", x: L.main.x, y: L.main.y, w: 4, id: main.id, label: main.name, color: main.color, theme, zone: "Auditorio principal", main: true });
  L.slots.forEach((slot, i) => {
    const room = rooms[i];
    if (room) doors.push({ side: "top", x: slot.x, y: slot.y, w: 2, id: room.id, label: room.name, color: room.color, theme, zone: slot.zone, main: false });
  });
  // Los puestos sin sala muestran un cuadro en el muro.
  const free = L.slots.slice(rooms.length).map((s): Decor => ({ kind: "art", x: s.x, y: s.y, w: 2, color: "#9aa5b1" }));
  const decor = [...L.decor, ...free];
  if (L.exit) decor.push({ kind: "entrance", x: L.exit.x, y: L.exit.y, w: 2 });
  return finish({
    ...empty,
    w: L.w,
    h: L.h,
    tiles: carve(L.w, L.h, L.floors),
    style: theme,
    floorName: L.name,
    spawn: L.spawn,
    furni: [...L.furni, ...L.directories.map((d): Furni => ({ kind: "directory", x: d.x, y: d.y }))],
    decor,
    doors,
    stairs: L.stairs.map((s) => ({ ...s, w: 2 })),
    areas: L.areas ?? [],
    labels: L.labels ?? [],
    crowd: L.crowd.map(([x, y, dir], i) => attendee(i, x, y, dir)),
    exit: L.exit ? { side: "bottom", x: L.exit.x, y: L.exit.y, w: 2 } : null,
    directories: L.directories,
  });
}

/** Los pisos del recinto: planta baja con el auditorio y ocho salas, y un piso alto con ocho salas más y su terraza. */
export function venueFloors(theme: ThemeId, rooms: Pick<Room, "id" | "name" | "color" | "main">[]): SceneMap[] {
  const main = rooms.find((r) => r.main) ?? rooms[0] ?? null;
  const others = rooms.filter((r) => r !== main);
  return LEVELS[theme]().map((L, i) => buildLevel(theme, L, i === 0 ? main : null, others.slice(i * ROOMS_PER_FLOOR, (i + 1) * ROOMS_PER_FLOOR)));
}

export const floorOfRoom = (floors: SceneMap[], roomId: string) => Math.max(0, floors.findIndex((m) => m.doors.some((d) => d.id === roomId)));

/** Dónde aparece alguien que llega a `floor` por la escalera desde `from`. */
export function stairsArrival(floors: SceneMap[], floor: number, from: number): Tile {
  const map = floors[floor]!;
  const st = map.stairs.find((s) => s.to === from);
  return st ? inFront(st) : map.spawn;
}

/** Lista de comprobaciones del plano, para las pruebas: puertas y escaleras alcanzables y libres. */
export function checkVenue(map: SceneMap) {
  const problems: string[] = [];
  const seen = new Set<string>([`${map.spawn.x},${map.spawn.y}`]);
  const queue: Tile[] = [map.spawn];
  if (!isWalkable(map, map.spawn.x, map.spawn.y)) problems.push("punto de aparición bloqueado");
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
  const onFace = (x: number, y: number) => map.tiles[y]?.[x] === "=" && map.tiles[y - 1]?.[x] === "=" && map.tiles[y + 1]?.[x] === ".";
  for (const d of map.doors) {
    for (const t of spanTiles(d)) if (!seen.has(`${t.x},${t.y}`)) problems.push(`puerta ${d.label} no alcanzable en ${t.x},${t.y}`);
    for (const t of spanTiles(d)) if (!onFace(t.x, t.y)) problems.push(`puerta ${d.label} fuera de una cara de muro en ${t.x}`);
    if (map.tiles[d.y - 2]?.[d.x] !== "#") problems.push(`puerta ${d.label} sin muro arriba para su cartel`);
  }
  for (const s of map.stairs) {
    for (const t of spanTiles(s)) if (!seen.has(`${t.x},${t.y}`)) problems.push(`escalera no alcanzable en ${t.x},${t.y}`);
    if (s.side === "top") for (const t of spanTiles(s)) if (!onFace(t.x, t.y)) problems.push(`escalera fuera de una cara de muro en ${t.x}`);
    if (s.side === "bottom") for (const t of spanTiles(s)) if (map.tiles[t.y]?.[t.x] !== "#" || map.tiles[t.y - 1]?.[t.x] !== ".") problems.push(`escalera baja mal ubicada en ${t.x}`);
  }
  if (map.exit && !seen.has(`${map.exit.x},${map.exit.y}`)) problems.push("salida no alcanzable");
  for (const d of map.directories) if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen.has(`${d.x + dx!},${d.y + dy!}`))) problems.push(`directorio ${d.x},${d.y} inaccesible`);
  const spans = [...map.doors, ...map.stairs];
  for (const d of map.decor) {
    if (d.kind === "entrance") continue;
    for (let x = d.x; x < d.x + (d.w ?? 1); x++) if (!onFace(x, d.y)) problems.push(`adorno ${d.kind} en ${x},${d.y} fuera de una cara de muro`);
    if (spans.some((s) => s.y === d.y && d.x < s.x + s.w && d.x + (d.w ?? 1) > s.x)) problems.push(`adorno ${d.kind} encima de una puerta o escalera`);
  }
  for (const f of map.furni) {
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) if (map.tiles[f.y + dy]?.[f.x + dx] !== ".") problems.push(`mueble ${f.kind} sobre un muro en ${f.x + dx},${f.y + dy}`);
  }
  for (const s of spans) for (const t of spanTiles(s)) {
    const front = s.side === "top" ? { x: t.x, y: t.y + 1 } : { x: t.x, y: t.y - 1 };
    if (map.blocked[front.y * map.w + front.x]) problems.push(`frente bloqueado en ${front.x},${front.y}`);
  }
  for (const c of map.crowd) if (map.tiles[c.y]?.[c.x] !== ".") problems.push(`asistente fuera del piso en ${c.x},${c.y}`);
  for (const t of seen) void t;
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
