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
  | "entrance"
  /** Vano entre dos zonas: marco con el nombre de la zona a la que lleva. */
  | "portal"
  /** Cartel con flecha que indica hacia dónde queda una zona. */
  | "sign";

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  w?: number;
  color?: string;
  text?: string;
}

/** Lado del piso donde está el muro: arriba, abajo, a la izquierda o a la derecha. */
export type Side = "top" | "bottom" | "left" | "right";

/**
 * Tramo de baldosas en un muro. En los muros de arriba y abajo corre en
 * horizontal; en los de los costados, `w` baldosas hacia abajo.
 */
export interface Span {
  side: Side;
  x: number;
  y: number;
  w: number;
}

/** Escalera: un tramo de peldaños sobre el piso; al pisarla se cambia de piso. */
export interface Stairs {
  x: number;
  y: number;
  w: number;
  h: number;
  /** "up" sube hacia el muro de arriba; "down" baja hacia un hueco en el piso. */
  dir: "up" | "down";
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
  /** Nombre del piso, para mostrarlo en pantalla. */
  floorName: string;
  blocked: boolean[];
  /** Baldosas con muebles: se pueden atravesar, pero los caminos automáticos los rodean. */
  soft: boolean[];
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

/** Lo que está a ras del piso: alfombras, sillas (para sentarse) y caminos de luz. */
const FLAT: FurniKind[] = ["rug", "carpet", "chair", "officechair", "neonpath"];

export const vertical = (s: Span) => s.side === "left" || s.side === "right";

export const spanTiles = (s: Span): Tile[] => Array.from({ length: s.w }, (_, i) => (vertical(s) ? { x: s.x, y: s.y + i } : { x: s.x + i, y: s.y }));

export const onSpan = (t: Tile, s: Span) => spanTiles(s).some((p) => p.x === t.x && p.y === t.y);

/** Baldosa del piso justo delante de una puerta. */
export const inFront = (s: Span): Tile => {
  switch (s.side) {
    case "top":
      return { x: s.x, y: s.y + 1 };
    case "bottom":
      return { x: s.x, y: s.y - 1 };
    case "left":
      return { x: s.x + 1, y: s.y };
    case "right":
      return { x: s.x - 1, y: s.y };
  }
};

export const onStairs = (t: Tile, s: Stairs) => t.x >= s.x && t.x < s.x + s.w && t.y >= s.y && t.y < s.y + s.h;

/** El primer peldaño, donde se pisa para subir o bajar. */
export const stairsEntry = (s: Stairs): Tile => ({ x: s.x + Math.floor(s.w / 2), y: s.dir === "up" ? s.y + s.h - 1 : s.y });

/** Dónde se para quien llega por una escalera: al pie de los peldaños. */
export const stairsFront = (s: Stairs): Tile => ({ x: s.x + Math.floor(s.w / 2), y: s.dir === "up" ? s.y + s.h : s.y - 1 });

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

/**
 * Solo los muros cortan el paso. Los muebles se pueden atravesar, igual que
 * las personas, para no quedar trabado nunca; los caminos automáticos igual
 * los rodean cuando pueden. En las salas (`solid`), mesas y escenario sí
 * ocupan lugar, porque ahí se camina directo al asiento.
 */
function finish(map: Omit<SceneMap, "blocked" | "soft">, solid = false): SceneMap {
  const blocked = new Array<boolean>(map.w * map.h).fill(false);
  const soft = new Array<boolean>(map.w * map.h).fill(false);
  map.tiles.forEach((row, y) => [...row].forEach((c, x) => (blocked[y * map.w + x] = c !== ".")));
  for (const f of map.furni) {
    if (FLAT.includes(f.kind)) continue;
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) {
      const k = (f.y + dy) * map.w + f.x + dx;
      if (solid) blocked[k] = true;
      else soft[k] = true;
    }
  }
  // Los caminos automáticos tampoco cruzan escaleras de paso: solo van a ellas.
  for (const st of map.stairs) for (let x = st.x; x < st.x + st.w; x++) for (let y = st.y; y < st.y + st.h; y++) soft[y * map.w + x] = true;
  // Puertas y salida se pueden pisar aunque estén en el muro.
  for (const s of [...map.doors, ...(map.exit ? [map.exit] : [])]) for (const t of spanTiles(s)) blocked[t.y * map.w + t.x] = false;
  return { ...map, blocked, soft };
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
  }, true);
}

// ---------- Recinto del evento ----------

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

/** Edificio de una sala: la puerta en el muro y el techo donde va su nombre. */
interface Slot {
  door: Tile & { side: Side };
  roof: Rect;
  zone: string;
}

/** Dos salas lado a lado, con la puerta en la cara de muro `faceY` (la fila justo encima del piso). */
const pairH = (x: number, faceY: number, zone: string): Slot[] =>
  [0, 5].map((o) => ({ door: { x: x + o + 1, y: faceY, side: "top" }, roof: { x: x + o, y: faceY - 6, w: 4, h: 5 }, zone }));

/** Dos salas una sobre otra, con la puerta en el muro lateral de la columna `wallX`. */
const pairV = (wallX: number, y: number, side: "left" | "right", zone: string): Slot[] =>
  [0, 5].map((o) => ({ door: { x: wallX, y: y + o + 1, side }, roof: { x: side === "left" ? wallX - 5 : wallX + 1, y: y + o, w: 5, h: 4 }, zone }));

/** Plano de un piso: zonas de piso, salas de a dos, escaleras y decoración. */
interface Level {
  name: string;
  w: number;
  h: number;
  floors: Rect[];
  areas?: Area[];
  /** Salida a recepción (solo en la planta baja), en el muro sur. */
  exit?: Tile;
  spawn: Tile;
  /** Entrada del auditorio principal (solo en la planta baja) y su edificio. */
  main?: Tile & { roof: Rect };
  /** Salas en el orden en que se llenan: siempre de a dos, en distintas zonas. */
  slots: Slot[];
  stairs: Stairs[];
  decor: Decor[];
  furni: Furni[];
  crowd: [x: number, y: number, dir: Dir][];
  directories: Tile[];
}

/** Rincón para charlar: sofá, sillón y mesita. */
const lounge = (x: number, y: number, color: string): Furni[] => [
  { kind: "sofa", x, y, w: 3, color, dir: "down" },
  { kind: "armchair", x: x + 4, y, color: "#ffb703" },
  { kind: "coffeetable", x: x + 1, y: y + 2, w: 2 },
];

/** Dos asistentes conversando, uno frente al otro. */
const chat = (x: number, y: number): [number, number, Dir][] => [
  [x, y, "right"],
  [x + 1, y, "left"],
];

// ----- Tecnológica: campus futurista -----

function techGround(): Level {
  return {
    name: "Planta baja",
    w: 60,
    h: 48,
    floors: [
      { x: 20, y: 10, w: 20, h: 6 }, // plaza del auditorio
      { x: 26, y: 16, w: 8, h: 12 }, // pasillo central
      { x: 34, y: 19, w: 7, h: 6 }, // zona chill
      { x: 19, y: 28, w: 22, h: 12 }, // lobby
      { x: 2, y: 10, w: 14, h: 11 }, // cafetería
      { x: 16, y: 12, w: 4, h: 3 },
      { x: 44, y: 10, w: 14, h: 11 }, // zona de juegos
      { x: 40, y: 12, w: 4, h: 3 },
      { x: 2, y: 32, w: 13, h: 5 }, // ala oeste
      { x: 15, y: 33, w: 4, h: 3 },
      { x: 45, y: 32, w: 13, h: 5 }, // ala este
      { x: 41, y: 33, w: 4, h: 3 },
      { x: 2, y: 37, w: 5, h: 9 }, // ala sur
      { x: 50, y: 37, w: 4, h: 3 },
      { x: 44, y: 40, w: 14, h: 6 }, // patio
    ],
    areas: [
      { x: 2, y: 10, w: 14, h: 11, floor: "wood" },
      { x: 44, y: 40, w: 14, h: 6, floor: "grass" },
    ],
    exit: { x: 29, y: 40 },
    spawn: { x: 29, y: 37 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairV(25, 17, "left", "Pasillo central"), ...pairH(3, 31, "Ala oeste"), ...pairH(47, 31, "Ala este"), ...pairV(7, 37, "right", "Ala sur")],
    stairs: [{ x: 37, y: 28, w: 3, h: 3, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "sponsors", x: 21, y: 9, w: 4 },
      { kind: "neon", x: 25, y: 9, w: 2, text: "AI", color: "#22d3ee" },
      { kind: "neon", x: 33, y: 9, w: 2, text: "</>", color: "#f472b6" },
      { kind: "sponsors", x: 35, y: 9, w: 4 },
      { kind: "neon", x: 7, y: 9, w: 4, text: "CAFÉ", color: "#ffb703" },
      { kind: "window", x: 12, y: 9, w: 3 },
      { kind: "neon", x: 45, y: 9, w: 5, text: "GAME ZONE", color: "#a78bfa" },
      { kind: "sponsors", x: 50, y: 9, w: 4 },
      { kind: "neon", x: 35, y: 18, w: 4, text: "CHILL", color: "#22d3ee" },
      { kind: "sponsors", x: 20, y: 27, w: 4 },
      { kind: "window", x: 12, y: 31, w: 2 },
      { kind: "window", x: 56, y: 31, w: 2 },
      { kind: "ivy", x: 45, y: 39, w: 3 },
      { kind: "ivy", x: 55, y: 39, w: 3 },
      { kind: "sign", x: 16, y: 11, w: 4, text: "← CAFETERÍA" },
      { kind: "sign", x: 40, y: 11, w: 4, text: "JUEGOS →" },
      { kind: "sign", x: 15, y: 32, w: 4, text: "← ALA OESTE" },
      { kind: "sign", x: 41, y: 32, w: 4, text: "ALA ESTE →" },
      { kind: "portal", x: 50, y: 39, w: 4, text: "PATIO" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 30, w: 6 },
      { kind: "bigplant", x: 19, y: 39 },
      { kind: "bigplant", x: 40, y: 39 },
      { kind: "robot", x: 35, y: 32 },
      { kind: "ledpillar", x: 20, y: 10 },
      { kind: "ledpillar", x: 39, y: 10 },
      { kind: "hologram", x: 22, y: 12, w: 2, d: 2 },
      { kind: "robot", x: 37, y: 12 },
      ...lounge(35, 19, "#2f6bff"),
      { kind: "beanbag", x: 35, y: 23, color: "#22d3ee" },
      { kind: "beanbag", x: 40, y: 23, color: "#f472b6" },
      { kind: "coffeebar", x: 2, y: 10, w: 4 },
      { kind: "cooler", x: 13, y: 10 },
      ...[3, 7, 11].flatMap((x) => [15, 18].map((y): Furni => ({ kind: "cafetable", x, y, w: 2 }))),
      { kind: "bigplant", x: 15, y: 20 },
      { kind: "pingpong", x: 46, y: 13, w: 3 },
      { kind: "pingpong", x: 46, y: 17, w: 3 },
      { kind: "foosball", x: 51, y: 14, w: 2 },
      { kind: "arcade", x: 55, y: 10 },
      { kind: "arcade", x: 56, y: 10 },
      { kind: "arcade", x: 57, y: 10 },
      { kind: "beanbag", x: 53, y: 19, color: "#22d3ee" },
      { kind: "beanbag", x: 55, y: 19, color: "#f472b6" },
      { kind: "parasol", x: 46, y: 42, w: 2 },
      { kind: "parasol", x: 50, y: 43, w: 2 },
      { kind: "parasol", x: 54, y: 42, w: 2 },
      { kind: "tree", x: 44, y: 41 },
      { kind: "tree", x: 57, y: 41 },
      { kind: "bench", x: 48, y: 45, w: 3 },
      { kind: "ledpillar", x: 14, y: 36 },
      { kind: "ledpillar", x: 45, y: 36 },
      { kind: "bigplant", x: 2, y: 45 },
    ],
    crowd: [...chat(23, 35), ...chat(8, 17), ...chat(49, 15), ...chat(47, 44), ...chat(37, 23), ...chat(30, 13), ...chat(11, 34), ...chat(50, 34), ...chat(3, 41)],
    directories: [
      { x: 22, y: 36 },
      { x: 37, y: 36 },
      { x: 24, y: 14 },
    ],
  };
}

// ----- Pisos altos: salas en cuatro alas, terraza, rincón tranquilo y barra -----

interface UpperTheme {
  name: string;
  terrace: string;
  chill: string;
  bar: string;
  zones: [west: string, north: string, east: string, northeast: string];
  stairs: string;
  terraceFloor: AreaFloor;
  extra: Furni[];
  decor: Decor[];
}

const UPPER: Record<ThemeId, UpperTheme> = {
  tech: {
    name: "Piso 1",
    terrace: "SKY LOUNGE",
    chill: "ZONA CHILL",
    bar: "BARRA",
    zones: ["Piso 1 · ala oeste", "Piso 1 · pasillo norte", "Piso 1 · ala este", "Piso 1 · ala noreste"],
    stairs: "Bajar a la planta baja",
    terraceFloor: "deck",
    extra: [
      { kind: "hologram", x: 27, y: 4, w: 2, d: 2 },
      { kind: "ledpillar", x: 16, y: 3 },
      { kind: "ledpillar", x: 39, y: 3 },
      { kind: "arcade", x: 16, y: 32 },
      { kind: "robot", x: 49, y: 35 },
    ],
    decor: [{ kind: "neon", x: 26, y: 2, w: 4, text: "SKY", color: "#22d3ee" }],
  },
  garden: {
    name: "Mirador",
    terrace: "MIRADOR",
    chill: "INVERNADERO",
    bar: "JUGUERÍA",
    zones: ["Mirador · sendero oeste", "Mirador · pérgola", "Mirador · sendero este", "Mirador · glorieta"],
    stairs: "Bajar al parque",
    terraceFloor: "grass",
    extra: [
      { kind: "tree", x: 16, y: 3 },
      { kind: "tree", x: 39, y: 3 },
      { kind: "fountain", x: 27, y: 4, w: 2, d: 2 },
      { kind: "flowerbed", x: 3, y: 35, w: 3 },
      { kind: "lantern", x: 49, y: 35 },
    ],
    decor: [{ kind: "ivy", x: 26, y: 2, w: 4 }],
  },
  minimal: {
    name: "Piso 1",
    terrace: "TERRAZA",
    chill: "BIBLIOTECA",
    bar: "CAFÉ",
    zones: ["Piso 1 · galería oeste", "Piso 1 · pasillo norte", "Piso 1 · galería este", "Piso 1 · ala noreste"],
    stairs: "Bajar a la planta baja",
    terraceFloor: "deck",
    extra: [
      { kind: "sculpture", x: 27, y: 4 },
      { kind: "bigplant", x: 16, y: 3 },
      { kind: "bigplant", x: 39, y: 3 },
      { kind: "bookshelf", x: 3, y: 32 },
      { kind: "bookshelf", x: 4, y: 32 },
      { kind: "lamp", x: 49, y: 35 },
    ],
    decor: [{ kind: "art", x: 26, y: 2, w: 3, color: "#e9b8a4" }],
  },
  rustic: {
    name: "Altillo",
    terrace: "TERRAZA",
    chill: "RINCÓN DE LECTURA",
    bar: "BODEGA",
    zones: ["Altillo · ala oeste", "Altillo · pasillo norte", "Altillo · ala este", "Altillo · granero"],
    stairs: "Bajar al pueblo",
    terraceFloor: "wood",
    extra: [
      { kind: "barrel", x: 16, y: 3 },
      { kind: "barrel", x: 39, y: 3 },
      { kind: "lantern", x: 27, y: 4 },
      { kind: "bookshelf", x: 3, y: 32 },
      { kind: "barrel", x: 49, y: 35 },
    ],
    decor: [{ kind: "fireplace", x: 4, y: 31, w: 3 }],
  },
  medieval: {
    name: "Azotea",
    terrace: "ALMENAS",
    chill: "JARDÍN DE LA TORRE",
    bar: "TABERNA ALTA",
    zones: ["Azotea · torre oeste", "Azotea · torre del homenaje", "Azotea · torre este", "Azotea · torre norte"],
    stairs: "Bajar al patio de armas",
    terraceFloor: "stone",
    extra: [
      ...[17, 20, 23, 32, 35, 38].map((x): Furni => ({ kind: "crenel", x, y: 3 })),
      { kind: "telescope", x: 16, y: 7 },
      { kind: "telescope", x: 39, y: 7 },
      { kind: "candelabra", x: 27, y: 4 },
      { kind: "flowerbed", x: 3, y: 35, w: 3 },
      { kind: "barrel", x: 49, y: 35 },
    ],
    decor: [
      { kind: "banner", x: 26, y: 2, color: "#9b2335" },
      { kind: "torch", x: 28, y: 2 },
      { kind: "banner", x: 29, y: 2, color: "#2f6bff" },
    ],
  },
};

function upperFloor(theme: ThemeId): Level {
  const u = UPPER[theme];
  return {
    name: u.name,
    w: 59,
    h: 38,
    floors: [
      { x: 16, y: 3, w: 24, h: 6 }, // terraza
      { x: 24, y: 9, w: 8, h: 13 }, // pasillo norte
      { x: 19, y: 22, w: 18, h: 9 }, // descanso de la escalera
      { x: 3, y: 24, w: 16, h: 5 }, // ala oeste
      { x: 37, y: 24, w: 15, h: 5 }, // ala este
      { x: 47, y: 10, w: 5, h: 14 }, // ala noreste
      { x: 8, y: 29, w: 4, h: 3 },
      { x: 3, y: 32, w: 14, h: 4 }, // rincón tranquilo
      { x: 42, y: 29, w: 4, h: 3 },
      { x: 38, y: 32, w: 12, h: 4 }, // barra
    ],
    areas: [{ x: 16, y: 3, w: 24, h: 6, floor: u.terraceFloor }],
    spawn: { x: 27, y: 24 },
    slots: [...pairH(5, 23, u.zones[0]), ...pairV(23, 10, "left", u.zones[1]), ...pairH(37, 23, u.zones[2]), ...pairV(52, 12, "right", u.zones[3])],
    stairs: [{ x: 26, y: 26, w: 3, h: 3, dir: "down", to: 0, label: u.stairs }],
    decor: [
      { kind: "sponsors", x: 18, y: 2, w: 4 },
      { kind: "sponsors", x: 34, y: 2, w: 4 },
      { kind: "sponsors", x: 19, y: 21, w: 4 },
      { kind: "window", x: 15, y: 23, w: 3 },
      { kind: "portal", x: 8, y: 31, w: 4, text: u.chill },
      { kind: "portal", x: 42, y: 31, w: 4, text: u.bar },
      ...u.decor,
    ],
    furni: [
      { kind: "parasol", x: 19, y: 5, w: 2 },
      { kind: "parasol", x: 35, y: 5, w: 2 },
      { kind: "bench", x: 21, y: 8, w: 3 },
      { kind: "bench", x: 33, y: 8, w: 3 },
      ...lounge(3, 33, SOFA[theme]),
      { kind: "beanbag", x: 13, y: 34, color: "#ffb703" },
      { kind: "beanbag", x: 15, y: 34, color: "#ef476f" },
      { kind: "coffeebar", x: 38, y: 32, w: 3 },
      { kind: "cafetable", x: 46, y: 33, w: 2 },
      { kind: "cafetable", x: 39, y: 35, w: 2 },
      { kind: "plant", x: 19, y: 22 },
      { kind: "plant", x: 36, y: 22 },
      { kind: "plant", x: 19, y: 30 },
      { kind: "plant", x: 36, y: 30 },
      ...u.extra,
    ],
    crowd: [...chat(28, 6), ...chat(6, 35), ...chat(43, 34), ...chat(21, 26), ...chat(14, 26), ...chat(48, 17)],
    directories: [{ x: 31, y: 28 }],
  };
}

// ----- Medieval: castillo con patio de armas, galerías, taberna y azotea -----

function castleGround(): Level {
  return {
    name: "Planta baja",
    w: 59,
    h: 48,
    floors: [
      { x: 16, y: 22, w: 28, h: 18 }, // patio de armas
      { x: 26, y: 10, w: 8, h: 12 }, // paso al gran salón
      { x: 8, y: 14, w: 5, h: 17 }, // galería oeste
      { x: 13, y: 26, w: 3, h: 3 },
      { x: 47, y: 14, w: 5, h: 17 }, // galería este
      { x: 44, y: 26, w: 3, h: 3 },
      { x: 2, y: 34, w: 12, h: 11 }, // taberna
      { x: 14, y: 36, w: 2, h: 3 },
      { x: 46, y: 34, w: 12, h: 11 }, // sala de juegos
      { x: 44, y: 36, w: 2, h: 3 },
    ],
    areas: [
      { x: 18, y: 24, w: 5, h: 5, floor: "grass" },
      { x: 37, y: 24, w: 5, h: 5, floor: "grass" },
      { x: 2, y: 34, w: 12, h: 11, floor: "wood" },
    ],
    exit: { x: 29, y: 40 },
    spawn: { x: 29, y: 37 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(16, 21, "Patio de armas (oeste)"), ...pairV(7, 15, "left", "Galería oeste"), ...pairH(35, 21, "Patio de armas (este)"), ...pairV(52, 15, "right", "Galería este")],
    stairs: [{ x: 48, y: 14, w: 3, h: 3, dir: "up", to: 1, label: "Subir a la azotea" }],
    decor: [
      { kind: "torch", x: 26, y: 9 },
      { kind: "torch", x: 33, y: 9 },
      { kind: "banner", x: 20, y: 21, color: "#9b2335" },
      { kind: "banner", x: 39, y: 21, color: "#2f6bff" },
      { kind: "banner", x: 9, y: 13, color: "#9b2335" },
      { kind: "torch", x: 11, y: 13 },
      { kind: "sponsors", x: 3, y: 33, w: 4 },
      { kind: "fireplace", x: 9, y: 33, w: 3 },
      { kind: "banner", x: 47, y: 33, color: "#2f6bff" },
      { kind: "sponsors", x: 52, y: 33, w: 4 },
      { kind: "sign", x: 13, y: 25, w: 3, text: "← GALERÍA" },
      { kind: "sign", x: 44, y: 25, w: 3, text: "GALERÍA →" },
      { kind: "sign", x: 14, y: 35, w: 2, text: "← TABERNA" },
      { kind: "sign", x: 44, y: 35, w: 2, text: "JUEGOS →" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 30, w: 6 },
      { kind: "fountain", x: 19, y: 25, w: 2, d: 2 },
      { kind: "fountain", x: 38, y: 25, w: 2, d: 2 },
      { kind: "flowerbed", x: 18, y: 28, w: 3 },
      { kind: "flowerbed", x: 39, y: 28, w: 3 },
      { kind: "candelabra", x: 16, y: 39 },
      { kind: "candelabra", x: 43, y: 39 },
      { kind: "armor", x: 26, y: 12 },
      { kind: "armor", x: 33, y: 12 },
      { kind: "armor", x: 26, y: 18 },
      { kind: "armor", x: 33, y: 18 },
      { kind: "coffeebar", x: 2, y: 34, w: 4 },
      ...[3, 8].flatMap((x) => [38, 41].map((y): Furni => ({ kind: "table", x, y, w: 2 }))),
      { kind: "barrel", x: 2, y: 44 },
      { kind: "barrel", x: 12, y: 44 },
      { kind: "barrel", x: 13, y: 44 },
      ...[48, 53].flatMap((x) => [37, 41].map((y): Furni => ({ kind: "chess", x, y, w: 2 }))),
      { kind: "bookshelf", x: 56, y: 34 },
      { kind: "bookshelf", x: 57, y: 34 },
      { kind: "armor", x: 46, y: 44 },
      { kind: "candelabra", x: 12, y: 30 },
      { kind: "candelabra", x: 47, y: 30 },
    ],
    crowd: [...chat(23, 33), ...chat(34, 28), ...chat(29, 14), ...chat(5, 40), ...chat(50, 39), ...chat(9, 27), ...chat(49, 25)],
    directories: [
      { x: 23, y: 37 },
      { x: 36, y: 37 },
    ],
  };
}

// ----- Jardín: un parque con senderos, pícnic y zona recreativa -----

function parkGround(): Level {
  return {
    name: "Planta baja",
    w: 59,
    h: 48,
    floors: [
      { x: 18, y: 20, w: 24, h: 18 }, // plaza
      { x: 26, y: 10, w: 8, h: 10 }, // sendero al auditorio
      { x: 8, y: 12, w: 5, h: 19 }, // sendero oeste
      { x: 13, y: 24, w: 5, h: 4 },
      { x: 47, y: 12, w: 5, h: 13 }, // sendero este
      { x: 42, y: 20, w: 5, h: 4 },
      { x: 36, y: 10, w: 10, h: 7 }, // café del jardín
      { x: 34, y: 12, w: 2, h: 4 },
      { x: 2, y: 34, w: 14, h: 12 }, // pícnic
      { x: 16, y: 34, w: 2, h: 4 },
      { x: 44, y: 34, w: 14, h: 12 }, // zona recreativa
      { x: 42, y: 34, w: 2, h: 4 },
    ],
    areas: [
      { x: 2, y: 34, w: 14, h: 12, floor: "grass" },
      { x: 44, y: 34, w: 14, h: 12, floor: "grass" },
      { x: 36, y: 10, w: 10, h: 7, floor: "deck" },
    ],
    exit: { x: 29, y: 38 },
    spawn: { x: 29, y: 35 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(17, 19, "Plaza (oeste)"), ...pairV(7, 13, "left", "Sendero oeste"), ...pairV(52, 13, "right", "Sendero este"), ...pairH(46, 33, "Zona recreativa")],
    stairs: [{ x: 37, y: 20, w: 3, h: 3, dir: "up", to: 1, label: "Subir al mirador" }],
    decor: [
      { kind: "ivy", x: 26, y: 9, w: 2 },
      { kind: "ivy", x: 32, y: 9, w: 2 },
      { kind: "ivy", x: 20, y: 19, w: 2 },
      { kind: "sponsors", x: 34, y: 19, w: 3 },
      { kind: "neon", x: 38, y: 9, w: 5, text: "CAFÉ", color: "#f59e0b" },
      { kind: "ivy", x: 3, y: 33, w: 3 },
      { kind: "sponsors", x: 9, y: 33, w: 4 },
      { kind: "ivy", x: 55, y: 33, w: 3 },
      { kind: "sign", x: 13, y: 23, w: 5, text: "← SENDERO OESTE" },
      { kind: "sign", x: 42, y: 19, w: 5, text: "SENDERO ESTE →" },
      { kind: "sign", x: 34, y: 11, w: 2, text: "CAFÉ →" },
      { kind: "sign", x: 16, y: 33, w: 2, text: "← PÍCNIC" },
      { kind: "sign", x: 42, y: 33, w: 2, text: "JUEGOS →" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 27, w: 6 },
      { kind: "fountain", x: 21, y: 31, w: 2, d: 2 },
      { kind: "fountain", x: 37, y: 31, w: 2, d: 2 },
      { kind: "tree", x: 18, y: 37 },
      { kind: "tree", x: 41, y: 37 },
      { kind: "flowerbed", x: 18, y: 23, w: 3 },
      { kind: "lantern", x: 25, y: 20 },
      { kind: "lantern", x: 34, y: 20 },
      ...[3, 9].flatMap((x) => [37, 41].map((y): Furni => ({ kind: "table", x, y, w: 2 }))),
      { kind: "tree", x: 2, y: 34 },
      { kind: "tree", x: 15, y: 45 },
      { kind: "parasol", x: 12, y: 39, w: 2 },
      { kind: "pingpong", x: 46, y: 37, w: 3 },
      { kind: "foosball", x: 52, y: 38, w: 2 },
      { kind: "chess", x: 46, y: 42, w: 2 },
      { kind: "beanbag", x: 54, y: 42, color: "#ffb703" },
      { kind: "beanbag", x: 56, y: 42, color: "#ef476f" },
      { kind: "tree", x: 57, y: 45 },
      { kind: "coffeebar", x: 36, y: 10, w: 3 },
      { kind: "cafetable", x: 38, y: 13, w: 2 },
      { kind: "cafetable", x: 42, y: 13, w: 2 },
      { kind: "parasol", x: 44, y: 15, w: 2 },
      { kind: "lantern", x: 12, y: 12 },
      { kind: "lantern", x: 47, y: 12 },
      { kind: "tree", x: 8, y: 30 },
      { kind: "tree", x: 51, y: 24 },
    ],
    crowd: [...chat(24, 33), ...chat(33, 24), ...chat(6, 39), ...chat(50, 40), ...chat(40, 15), ...chat(29, 13), ...chat(10, 22)],
    directories: [
      { x: 23, y: 35 },
      { x: 36, y: 35 },
    ],
  };
}

// ----- Minimalista: galería de arte con un gran pasillo, alas y foyer -----

function galleryGround(): Level {
  return {
    name: "Planta baja",
    w: 59,
    h: 46,
    floors: [
      { x: 3, y: 20, w: 53, h: 6 }, // gran galería
      { x: 26, y: 26, w: 8, h: 4 }, // foyer
      { x: 20, y: 30, w: 20, h: 11 }, // lobby
      { x: 8, y: 26, w: 5, h: 15 }, // ala oeste
      { x: 46, y: 26, w: 5, h: 15 }, // ala este
      { x: 14, y: 8, w: 7, h: 9 }, // café
      { x: 15, y: 17, w: 4, h: 3 },
      { x: 38, y: 8, w: 7, h: 9 }, // estudio de juegos
      { x: 40, y: 17, w: 4, h: 3 },
    ],
    areas: [
      { x: 20, y: 36, w: 4, h: 5, floor: "grass" },
      { x: 36, y: 36, w: 4, h: 5, floor: "grass" },
      { x: 14, y: 8, w: 7, h: 9, floor: "wood" },
    ],
    exit: { x: 29, y: 41 },
    spawn: { x: 29, y: 38 },
    main: { x: 28, y: 19, roof: { x: 22, y: 11, w: 16, h: 7 } },
    slots: [...pairH(4, 19, "Galería oeste"), ...pairV(7, 30, "left", "Ala oeste"), ...pairH(46, 19, "Galería este"), ...pairV(51, 30, "right", "Ala este")],
    stairs: [{ x: 21, y: 30, w: 3, h: 3, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "portal", x: 15, y: 19, w: 4, text: "CAFÉ" },
      { kind: "portal", x: 40, y: 19, w: 4, text: "ESTUDIO DE JUEGOS" },
      { kind: "art", x: 24, y: 19, w: 2, color: "#e9b8a4" },
      { kind: "art", x: 34, y: 19, w: 2, color: "#a4c3e9" },
      { kind: "window", x: 16, y: 7, w: 3 },
      { kind: "art", x: 40, y: 7, w: 3, color: "#c9e4a4" },
      { kind: "sponsors", x: 35, y: 29, w: 4 },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 32, w: 6 },
      { kind: "sculpture", x: 21, y: 38 },
      { kind: "bigplant", x: 38, y: 38 },
      ...lounge(33, 36, "#9aa5b1"),
      { kind: "bench", x: 10, y: 22, w: 3 },
      { kind: "bench", x: 47, y: 22, w: 3 },
      { kind: "sculpture", x: 3, y: 20 },
      { kind: "sculpture", x: 55, y: 20 },
      { kind: "lamp", x: 26, y: 26 },
      { kind: "lamp", x: 33, y: 26 },
      { kind: "coffeebar", x: 14, y: 8, w: 3 },
      { kind: "cafetable", x: 15, y: 12, w: 2 },
      { kind: "cafetable", x: 18, y: 14, w: 2 },
      { kind: "bigplant", x: 20, y: 8 },
      { kind: "chess", x: 39, y: 11, w: 2 },
      { kind: "foosball", x: 42, y: 13, w: 2 },
      { kind: "beanbag", x: 39, y: 15, color: "#e9b8a4" },
      { kind: "bookshelf", x: 44, y: 8 },
      { kind: "bigplant", x: 8, y: 40 },
      { kind: "bigplant", x: 50, y: 40 },
    ],
    crowd: [...chat(24, 35), ...chat(30, 23), ...chat(16, 11), ...chat(41, 15), ...chat(10, 36), ...chat(47, 36), ...chat(18, 23)],
    directories: [
      { x: 25, y: 39 },
      { x: 34, y: 39 },
    ],
  };
}

// ----- Rústica: un pueblo con calles, fonda y plaza de juegos -----

function villageGround(): Level {
  return {
    name: "Planta baja",
    w: 59,
    h: 48,
    floors: [
      { x: 19, y: 24, w: 22, h: 12 }, // plaza del pueblo
      { x: 26, y: 10, w: 8, h: 14 }, // calle mayor
      { x: 3, y: 28, w: 16, h: 5 }, // calle oeste
      { x: 41, y: 28, w: 15, h: 5 }, // calle este
      { x: 3, y: 33, w: 5, h: 13 }, // callejón suroeste
      { x: 51, y: 33, w: 5, h: 13 }, // callejón sureste
      { x: 4, y: 10, w: 17, h: 9 }, // fonda
      { x: 21, y: 13, w: 5, h: 3 },
      { x: 38, y: 10, w: 17, h: 9 }, // plaza de juegos
      { x: 34, y: 13, w: 4, h: 3 },
    ],
    areas: [
      { x: 4, y: 10, w: 17, h: 9, floor: "wood" },
      { x: 19, y: 32, w: 4, h: 4, floor: "grass" },
      { x: 37, y: 32, w: 4, h: 4, floor: "grass" },
      { x: 3, y: 42, w: 5, h: 4, floor: "grass" },
      { x: 51, y: 42, w: 5, h: 4, floor: "grass" },
    ],
    exit: { x: 29, y: 36 },
    spawn: { x: 29, y: 33 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(5, 27, "Calle oeste"), ...pairV(8, 34, "right", "Callejón suroeste"), ...pairH(44, 27, "Calle este"), ...pairV(50, 34, "left", "Callejón sureste")],
    stairs: [{ x: 36, y: 24, w: 3, h: 3, dir: "up", to: 1, label: "Subir al altillo" }],
    decor: [
      { kind: "window", x: 26, y: 9, w: 2 },
      { kind: "window", x: 32, y: 9, w: 2 },
      { kind: "fireplace", x: 6, y: 9, w: 3 },
      { kind: "shelf", x: 11, y: 9, w: 3 },
      { kind: "sponsors", x: 15, y: 9, w: 4 },
      { kind: "sponsors", x: 40, y: 9, w: 4 },
      { kind: "window", x: 47, y: 9, w: 3 },
      { kind: "sponsors", x: 20, y: 23, w: 4 },
      { kind: "window", x: 15, y: 27, w: 2 },
      { kind: "window", x: 53, y: 27, w: 2 },
      { kind: "sign", x: 21, y: 12, w: 5, text: "← FONDA" },
      { kind: "sign", x: 34, y: 12, w: 4, text: "JUEGOS →" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 27, w: 6 },
      { kind: "lantern", x: 19, y: 24 },
      { kind: "lantern", x: 40, y: 24 },
      { kind: "flowerbed", x: 19, y: 35, w: 3 },
      { kind: "flowerbed", x: 38, y: 35, w: 3 },
      { kind: "barrel", x: 26, y: 10 },
      { kind: "barrel", x: 33, y: 10 },
      { kind: "lantern", x: 26, y: 17 },
      { kind: "lantern", x: 33, y: 17 },
      { kind: "counter", x: 4, y: 10 },
      { kind: "counter", x: 5, y: 10 },
      { kind: "counter", x: 6, y: 10 },
      ...[6, 10, 14].flatMap((x) => [13, 16].map((y): Furni => ({ kind: "table", x, y, w: 2 }))),
      { kind: "barrel", x: 20, y: 10 },
      { kind: "chess", x: 40, y: 13, w: 2 },
      { kind: "chess", x: 44, y: 13, w: 2 },
      { kind: "foosball", x: 48, y: 12, w: 2 },
      { kind: "pingpong", x: 47, y: 15, w: 3 },
      { kind: "barrel", x: 54, y: 10 },
      { kind: "bench", x: 52, y: 17, w: 3 },
      { kind: "lantern", x: 3, y: 32 },
      { kind: "lantern", x: 55, y: 32 },
      { kind: "flowerbed", x: 3, y: 44, w: 3 },
      { kind: "flowerbed", x: 52, y: 44, w: 3 },
      { kind: "tree", x: 7, y: 45 },
      { kind: "tree", x: 51, y: 45 },
    ],
    crowd: [...chat(23, 30), ...chat(34, 31), ...chat(8, 14), ...chat(42, 16), ...chat(12, 30), ...chat(47, 30), ...chat(29, 15), ...chat(4, 38)],
    directories: [
      { x: 24, y: 33 },
      { x: 35, y: 33 },
    ],
  };
}

const LEVELS: Record<ThemeId, () => Level[]> = {
  tech: () => [techGround(), upperFloor("tech")],
  medieval: () => [castleGround(), upperFloor("medieval")],
  garden: () => [parkGround(), upperFloor("garden")],
  minimal: () => [galleryGround(), upperFloor("minimal")],
  rustic: () => [villageGround(), upperFloor("rustic")],
};

function buildLevel(theme: ThemeId, L: Level, main: Pick<Room, "id" | "name" | "color"> | null, rooms: Pick<Room, "id" | "name" | "color">[]): SceneMap {
  const doors: Door[] = [];
  const roofs: Roof[] = [];
  if (main && L.main) {
    doors.push({ side: "top", x: L.main.x, y: L.main.y, w: 4, id: main.id, label: main.name, color: main.color, theme, zone: "Auditorio principal", main: true });
    roofs.push({ ...L.main.roof, label: main.name, color: main.color, open: true });
  }
  const decor = [...L.decor];
  L.slots.forEach((slot, i) => {
    const room = rooms[i];
    roofs.push({ ...slot.roof, label: room?.name ?? "", color: room?.color ?? "", open: Boolean(room) });
    if (room) doors.push({ ...slot.door, w: 2, id: room.id, label: room.name, color: room.color, theme, zone: slot.zone, main: false });
    // Los puestos sin sala de los muros de frente muestran un cuadro.
    else if (slot.door.side === "top") decor.push({ kind: "art", x: slot.door.x, y: slot.door.y, w: 2, color: "#9aa5b1" });
  });
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
    roofs,
    stairs: L.stairs,
    areas: L.areas ?? [],
    crowd: L.crowd.map(([x, y, dir], i) => attendee(i, x, y, dir)),
    exit: L.exit ? { side: "bottom", x: L.exit.x, y: L.exit.y, w: 2 } : null,
    directories: L.directories,
  });
}

/** Los pisos del recinto: planta baja con el auditorio y ocho salas, y un piso alto con ocho salas más. */
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
  return st ? stairsFront(st) : map.spawn;
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
  const tile = (x: number, y: number) => map.tiles[y]?.[x] ?? "#";
  const soft = (t: Tile) => map.soft[t.y * map.w + t.x];
  const onFace = (x: number, y: number) => tile(x, y) === "=" && tile(x, y - 1) === "=" && tile(x, y + 1) === ".";
  for (const d of map.doors) {
    for (const t of spanTiles(d)) if (!seen.has(`${t.x},${t.y}`)) problems.push(`puerta ${d.label} no alcanzable en ${t.x},${t.y}`);
    if (d.side === "top") {
      for (const t of spanTiles(d)) if (!onFace(t.x, t.y)) problems.push(`puerta ${d.label} fuera de una cara de muro en ${t.x}`);
      if (tile(d.x, d.y - 2) !== "#") problems.push(`puerta ${d.label} sin muro arriba para su cartel`);
    }
    if (vertical(d)) {
      const dx = d.side === "left" ? 1 : -1;
      for (const t of spanTiles(d)) if (tile(t.x, t.y) !== "#" || tile(t.x + dx, t.y) !== ".") problems.push(`puerta ${d.label} fuera de un muro lateral en ${t.x},${t.y}`);
    }
    if (soft(inFront(d))) problems.push(`mueble delante de la puerta ${d.label}`);
  }
  for (const s of map.stairs) {
    for (let x = s.x; x < s.x + s.w; x++) for (let y = s.y; y < s.y + s.h; y++) {
      if (tile(x, y) !== ".") problems.push(`escalera sobre un muro en ${x},${y}`);
      if (map.furni.some((f) => x >= f.x && x < f.x + (f.w ?? 1) && y >= f.y && y < f.y + (f.d ?? 1))) problems.push(`mueble sobre la escalera en ${x},${y}`);
    }
    if (s.dir === "up") for (let x = s.x; x < s.x + s.w; x++) if (!onFace(x, s.y - 1)) problems.push(`escalera que sube sin muro detrás en ${x}`);
    const front = stairsFront(s);
    if (!seen.has(`${front.x},${front.y}`) || soft(front)) problems.push(`pie de la escalera inaccesible en ${front.x},${front.y}`);
  }
  if (map.exit && !seen.has(`${map.exit.x},${map.exit.y}`)) problems.push("salida no alcanzable");
  for (const d of map.directories) if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen.has(`${d.x + dx!},${d.y + dy!}`))) problems.push(`directorio ${d.x},${d.y} inaccesible`);
  const spans = map.doors.filter((d) => d.side === "top");
  const ups = map.stairs.filter((s) => s.dir === "up");
  for (const d of map.decor) {
    if (d.kind === "entrance") continue;
    const x1 = d.x + (d.w ?? 1);
    if (d.kind === "portal") {
      for (let x = d.x; x < x1; x++) if (tile(x, d.y) !== "." || tile(x, d.y + 1) !== ".") problems.push(`portal ${d.text} sin paso en ${x},${d.y}`);
      if (!onFace(d.x - 1, d.y) || !onFace(x1, d.y)) problems.push(`portal ${d.text} sin muro a los lados`);
      continue;
    }
    for (let x = d.x; x < x1; x++) if (!onFace(x, d.y)) problems.push(`adorno ${d.kind} en ${x},${d.y} fuera de una cara de muro`);
    if (spans.some((s) => s.y === d.y && d.x < s.x + s.w && x1 > s.x)) problems.push(`adorno ${d.kind} encima de una puerta en ${d.x},${d.y}`);
    if (ups.some((s) => s.y - 1 === d.y && d.x < s.x + s.w && x1 > s.x)) problems.push(`adorno ${d.kind} encima de una escalera en ${d.x},${d.y}`);
  }
  for (const f of map.furni) {
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) if (tile(f.x + dx, f.y + dy) !== ".") problems.push(`mueble ${f.kind} sobre un muro en ${f.x + dx},${f.y + dy}`);
  }
  map.roofs.forEach((r, i) => {
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) if (tile(x, y) !== "#") problems.push(`techo ${r.label || i} sobre ${tile(x, y)} en ${x},${y}`);
    for (const o of map.roofs.slice(i + 1)) if (r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h) problems.push(`techos encimados ${r.label} y ${o.label}`);
  });
  for (const c of map.crowd) if (tile(c.x, c.y) !== ".") problems.push(`asistente fuera del piso en ${c.x},${c.y}`);
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
  }, true);
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
