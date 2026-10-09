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
  /** Stand de un patrocinador: mostrador con su logo, roll-ups y un panel en la pared. */
  | "booth"
  /** Poste con carteles y flechas hacia cada zona. */
  | "signpost"
  /** Cohete a escala sobre un pedestal (temática Stellar). */
  | "rocket"
  /** Columna con nodos de luz unidos como una constelación (temática Stellar). */
  | "constellation"
  /** Mampara de vidrio, como la de una sala de reuniones. */
  | "partition"
  /** Dron flotando con luces (decorativo). */
  | "drone"
  /** Estación de realidad virtual: una plataforma con anillo de luz. */
  | "vrpod"
  /** Impresora 3D imprimiendo una pieza. */
  | "printer3d"
  /** Marco para sacarse fotos con el nombre del evento. */
  | "photobooth"
  /** Estación para cargar el celular o la laptop. */
  | "charger"
  /** Postes con cordón para ordenar la fila frente a la recepción (se puede pasar por encima). */
  | "stanchion"
  /** Gran mostrador de recepción, con su nombre al frente y una línea de luz. */
  | "frontdesk"
  /** Pantalla gigante con la cuenta regresiva del hackathon. */
  | "countdown"
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
  /** En los stands: qué patrocinador muestra (su posición en la lista). */
  n?: number;
  /** Stand en medio del salón, con su propio panel de fondo (sin pared detrás). */
  free?: boolean;
  /** Texto de un cartel indicador; cada «|» es una línea. */
  label?: string;
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
  | "sign"
  /** Puerta de un cuarto (mentores, staff): marco con puertas de vidrio abiertas y el nombre arriba. */
  | "roomdoor"
  /** Pantalla con código que corre. */
  | "codewall";

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

/**
 * Escalera o ascensor: un vano de dos baldosas en una pared de frente, como una
 * puerta, así no ocupa lugar en el piso. Al entrar se cambia de piso.
 */
export interface Stairs {
  x: number;
  /** Fila de abajo de la cara de muro, igual que una puerta. */
  y: number;
  w: number;
  /** Hacia dónde lleva: arriba o abajo (cambia la flecha y el dibujo). */
  dir: "up" | "down";
  to: number;
  label: string;
}

/**
 * Mesa de equipo (hackathon): un rectángulo en el piso. Quienes están adentro
 * se escuchan y se ven entre sí, y nadie más.
 */
export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Cuántas personas caben en la conversación. */
  seats: number;
  /** Solo para el equipo organizador. */
  staff?: boolean;
  /** Es toda una sala (mentores, organizadores): sus paredes ya la marcan, no se dibuja el rectángulo. */
  room?: boolean;
}

/** Lugar al que solo entra cierta gente. */
export interface Reserved extends Rect {
  /** El equipo organizador puede entrar. */
  staff?: boolean;
  /** Quienes atienden el stand de este patrocinador (su posición en la lista) pueden entrar. */
  sponsor?: number;
}

/** Quién camina: su papel en el evento y, si atiende un stand, de qué patrocinador. */
export interface Walker {
  role: "staff" | "mentor" | "sponsor" | null;
  sponsor?: number | null;
}

export const mayEnter = (r: Reserved, who: Walker) =>
  (r.staff === true && who.role === "staff") || (r.sponsor !== undefined && who.role === "sponsor" && who.sponsor === r.sponsor);

export const inZone = (t: Tile, z: Zone) => t.x >= z.x && t.x < z.x + z.w && t.y >= z.y && t.y < z.y + z.h;

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
  /** Baldosas desde donde se le puede hablar (además de las de al lado). */
  talkFrom?: Tile[];
  /** Si atiende un stand: la posición del patrocinador en la lista. */
  sponsor?: number;
  /** Está sentado (trabajando en un escritorio, en una reunión o en un sofá). */
  sit?: boolean;
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
  /** Mesas de equipo con conversación propia. */
  zones: Zone[];
  /** Salas que todavía no se habilitan (por ejemplo, salas de equipos de un hackathon con menos cupo). */
  closed: (Rect & { label: string })[];
  /** Lugares reservados: la sala de organizadores (solo su equipo) y el puesto detrás de cada stand (solo quienes lo atienden). */
  restricted: Reserved[];
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
const FLAT: FurniKind[] = ["rug", "carpet", "chair", "officechair", "neonpath", "stanchion"];

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

export const onStairs = (t: Tile, s: Stairs) => t.y === s.y && t.x >= s.x && t.x < s.x + s.w;

/** El primer peldaño, donde se pisa para subir o bajar. */
export const stairsEntry = (s: Stairs): Tile => ({ x: s.x, y: s.y });

/** Dónde se para quien llega por una escalera: al pie de los peldaños. */
export const stairsFront = (s: Stairs): Tile => ({ x: s.x, y: s.y + 1 });

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
    if (f.kind === "booth") {
      // El stand es sólido: se lo rodea, no se lo cruza. Detrás del mostrador queda el lugar de quienes atienden.
      for (let dx = 0; dx < 3; dx++) {
        blocked[(f.y + 1) * map.w + f.x + dx] = true;
        if (f.free) blocked[(f.y - 1) * map.w + f.x + dx] = true;
      }
      continue;
    }
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) {
      const k = (f.y + dy) * map.w + f.x + dx;
      if (solid) blocked[k] = true;
      else soft[k] = true;
    }
  }
  // Puertas, escaleras y salida se pueden pisar aunque estén en el muro.
  for (const s of [...map.doors, ...map.stairs.map((st): Span => ({ ...st, side: "top" })), ...(map.exit ? [map.exit] : [])]) for (const t of spanTiles(s)) blocked[t.y * map.w + t.x] = false;
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
  zones: [],
  closed: [],
  restricted: [],
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

/**
 * Recepción: el lobby de un cowork moderno. Al fondo, el gran mostrador con
 * dos recepcionistas, el logo iluminado detrás y pantallas a los lados; al
 * frente, dos filas ordenadas con postes. Alrededor, con aire: escritorios,
 * sala de reuniones vidriada, sala de estar y café.
 */
export function receptionMap(): SceneMap {
  const w = 34;
  const h = 21;
  const sit = (i: number, x: number, y: number, dir: Dir): Npc => ({ ...attendee(i, x, y, dir), id: `cowork-${i}`, name: "Coworker", sit: true });
  const stand = (i: number, x: number, y: number, dir: Dir): Npc => ({ ...attendee(i, x, y, dir), id: `cowork-${i}`, name: "Coworker" });
  const front = Array.from({ length: 14 }, (_, i) => ({ x: 10 + i, y: 6 }));
  return finish(
    {
      ...empty,
      w,
      h,
      tiles: enclosure(w, h),
      style: "cowork",
      spawn: { x: 16, y: 17 },
      furni: [
        // Recepción pegada a la pared del fondo: los recepcionistas, el gran mostrador y dos filas.
        { kind: "frontdesk", x: 9, y: 5, w: 16 },
        { kind: "ledpillar", x: 9, y: 3 },
        { kind: "ledpillar", x: 24, y: 3 },
        { kind: "bigplant", x: 16, y: 3 },
        { kind: "kiosk", x: 7, y: 6 },
        { kind: "kiosk", x: 26, y: 6 },
        { kind: "stanchion", x: 11, y: 8, d: 4 },
        { kind: "stanchion", x: 15, y: 8, d: 4 },
        { kind: "stanchion", x: 18, y: 8, d: 4 },
        { kind: "stanchion", x: 22, y: 8, d: 4 },
        { kind: "bigplant", x: 9, y: 13 },
        { kind: "bigplant", x: 24, y: 13 },
        // Escritorios a la izquierda.
        { kind: "workdesk", x: 1, y: 4, w: 3 },
        { kind: "workdesk", x: 1, y: 8, w: 3 },
        ...[1, 2, 3].flatMap((x) => [5, 9].map((y) => ({ kind: "officechair" as const, x, y }))),
        // Sala de reuniones vidriada a la derecha.
        { kind: "partition", x: 28, y: 3, d: 6 },
        { kind: "partition", x: 28, y: 9, w: 2 },
        { kind: "partition", x: 31, y: 9, w: 2 },
        { kind: "table", x: 29, y: 5, w: 3 },
        ...[29, 30, 31].flatMap((x) => [
          { kind: "officechair" as const, x, y: 4 },
          { kind: "officechair" as const, x, y: 6 },
        ]),
        // Sala de estar abajo a la izquierda y café abajo a la derecha.
        { kind: "sofa", x: 1, y: 14, w: 3, color: "#2f6bff", dir: "down" },
        { kind: "armchair", x: 5, y: 14, color: "#ffb703" },
        { kind: "coffeetable", x: 2, y: 16, w: 2 },
        { kind: "coffeebar", x: 27, y: 13, w: 4 },
        { kind: "vending", x: 32, y: 13 },
        { kind: "cafetable", x: 28, y: 17, w: 2 },
        { kind: "bigplant", x: 1, y: 18 },
        { kind: "bigplant", x: 32, y: 18 },
      ],
      decor: [
        { kind: "window", x: 1, y: 2, w: 3 },
        { kind: "sponsors", x: 9, y: 2, w: 4 },
        { kind: "neon", x: 13, y: 2, w: 8, text: "RECEPCIÓN", color: "#22d3ee" },
        { kind: "sponsors", x: 21, y: 2, w: 4 },
        { kind: "whiteboard", x: 29, y: 2, w: 3 },
        { kind: "entrance", x: 16, y: h - 1, w: 2 },
      ],
      crowd: [
        sit(1, 1, 5, "up"),
        sit(2, 3, 5, "up"),
        sit(3, 2, 9, "up"),
        sit(4, 29, 4, "down"),
        sit(5, 31, 4, "down"),
        sit(6, 30, 6, "up"),
        sit(7, 1, 14, "down"),
        sit(8, 3, 14, "down"),
        stand(9, 27, 15, "right"),
        stand(10, 28, 15, "left"),
      ],
      npcs: [
        { id: RECEPTIONIST_ID, name: "Recepcionista", look: RECEPTIONIST_LOOK, x: 13, y: 4, dir: "down", talkFrom: front },
        {
          id: `${RECEPTIONIST_ID}-2`,
          name: "Recepcionista",
          look: { ...RECEPTIONIST_LOOK, hair: "short", hairColor: HAIR_COLORS[3]!, skin: SKINS[4]!, shirt: "#2f6bff" },
          x: 20,
          y: 4,
          dir: "down",
          talkFrom: front,
        },
      ],
      desk: front,
    },
    true,
  );
}

// ---------- Recinto del evento ----------

const SOFA: Record<ThemeId, string> = { tech: "#2f6bff", minimal: "#9aa5b1", rustic: "#a0522d", medieval: "#7a2a3a", garden: "#5a8f3e", stellar: "#2a2a33", hackathon: "#ff7a1a" };

/** Objetos de ambiente de cada estilo (también se usan en las salas). */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["ledpillar", "robot", "rack", "ledpillar"],
  minimal: ["bigplant", "lamp", "sculpture", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
  stellar: ["constellation", "rocket", "bigplant", "constellation"],
  hackathon: ["rack", "ledpillar", "bigplant", "robot"],
};

/** Salas por piso. Todo evento tiene al menos ocho más el auditorio; las siguientes van al piso de arriba. */
export const ROOMS_PER_FLOOR = 8;
export const MIN_ROOMS = ROOMS_PER_FLOOR + 1;
export const MAX_ROOMS = ROOMS_PER_FLOOR * 2 + 1;
/** Un hackathon tiene el auditorio y 8 salas de charla: cuatro por piso, separadas entre sí. */
export const HACKATHON_ROOMS = 9;
/** Máximo de salas (con el auditorio) según la temática. */
export const maxRoomsFor = (theme: ThemeId) => (theme === "hackathon" ? HACKATHON_ROOMS : MAX_ROOMS);

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
  /** Stands de patrocinadores (esquina superior izquierda, 3×2, pegados a una pared o sueltos con su panel). */
  stands?: (Tile & { free?: boolean })[];
  zones?: Zone[];
  closed?: (Rect & { label: string })[];
  restricted?: Reserved[];
  /** Feria de stands: se muestran todos los puestos; los que no tienen patrocinador quedan «disponibles». */
  expo?: boolean;
  stairs: Stairs[];
  decor: Decor[];
  furni: Furni[];
  crowd: [x: number, y: number, dir: Dir, sit?: boolean][];
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
    h: 52,
    floors: [
      { x: 7, y: 30, w: 46, h: 10 }, // bulevar: el lobby, a lo largo del recinto
      { x: 26, y: 12, w: 8, h: 18 }, // pasillo del auditorio
      { x: 34, y: 15, w: 2, h: 5 },
      { x: 36, y: 13, w: 17, h: 9 }, // patio
      { x: 14, y: 40, w: 4, h: 3 },
      { x: 8, y: 43, w: 16, h: 7 }, // cafetería
      { x: 42, y: 40, w: 4, h: 3 },
      { x: 36, y: 43, w: 16, h: 7 }, // zona de juegos
    ],
    areas: [
      { x: 36, y: 13, w: 17, h: 9, floor: "grass" },
      { x: 8, y: 43, w: 16, h: 7, floor: "wood" },
    ],
    exit: { x: 29, y: 40 },
    spawn: { x: 29, y: 37 },
    main: { x: 28, y: 11, roof: { x: 22, y: 3, w: 16, h: 7 } },
    slots: [...pairH(9, 29, "Bulevar oeste"), ...pairV(25, 13, "left", "Pasillo del auditorio"), ...pairH(36, 29, "Bulevar este"), ...pairV(53, 30, "right", "Fondo del bulevar")],
    stands: [
      { x: 46, y: 30 },
      { x: 40, y: 13 },
      { x: 20, y: 43 },
      { x: 46, y: 13 },
    ],
    stairs: [{ x: 21, y: 29, w: 2, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "window", x: 7, y: 29, w: 2 },
      { kind: "neon", x: 34, y: 29, w: 2, text: "</>", color: "#f472b6" },
      { kind: "sponsors", x: 49, y: 29, w: 4 },
      { kind: "sponsors", x: 36, y: 12, w: 4 },
      { kind: "neon", x: 43, y: 12, w: 3, text: "PATIO", color: "#22d3ee" },
      { kind: "ivy", x: 49, y: 12, w: 4 },
      { kind: "sign", x: 34, y: 14, w: 2, text: "PATIO →" },
      { kind: "window", x: 9, y: 42, w: 3 },
      { kind: "portal", x: 14, y: 42, w: 4, text: "CAFETERÍA" },
      { kind: "neon", x: 36, y: 42, w: 5, text: "GAME ZONE", color: "#a78bfa" },
      { kind: "sponsors", x: 47, y: 42, w: 4 },
      { kind: "portal", x: 42, y: 42, w: 4, text: "ZONA DE JUEGOS" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 33, w: 6 },
      { kind: "bigplant", x: 7, y: 39 },
      { kind: "bigplant", x: 52, y: 39 },
      { kind: "robot", x: 37, y: 36 },
      { kind: "ledpillar", x: 26, y: 12 },
      { kind: "ledpillar", x: 33, y: 12 },
      { kind: "hologram", x: 9, y: 35, w: 2, d: 2 },
      { kind: "parasol", x: 37, y: 17, w: 2 },
      { kind: "parasol", x: 43, y: 18, w: 2 },
      { kind: "parasol", x: 49, y: 17, w: 2 },
      { kind: "tree", x: 36, y: 21 },
      { kind: "tree", x: 52, y: 21 },
      { kind: "bench", x: 46, y: 21, w: 3 },
      { kind: "coffeebar", x: 8, y: 43, w: 4 },
      { kind: "cooler", x: 13, y: 43 },
      { kind: "cafetable", x: 9, y: 46, w: 2 },
      { kind: "cafetable", x: 20, y: 48, w: 2 },
      ...lounge(12, 47, "#2f6bff"),
      { kind: "pingpong", x: 37, y: 45, w: 3 },
      { kind: "pingpong", x: 37, y: 48, w: 3 },
      { kind: "foosball", x: 43, y: 46, w: 2 },
      { kind: "arcade", x: 49, y: 43 },
      { kind: "arcade", x: 50, y: 43 },
      { kind: "arcade", x: 51, y: 43 },
      { kind: "beanbag", x: 47, y: 48, color: "#22d3ee" },
      { kind: "beanbag", x: 49, y: 48, color: "#f472b6" },
    ],
    crowd: [...chat(23, 36), ...chat(13, 34), ...chat(42, 35), ...chat(29, 17), ...chat(40, 19), ...chat(17, 46), ...chat(40, 47), ...chat(30, 26)],
    directories: [
      { x: 24, y: 37 },
      { x: 35, y: 37 },
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
    zones: ["Piso 1 · pasillo oeste", "Piso 1 · fondo oeste", "Piso 1 · pasillo este", "Piso 1 · fondo este"],
    stairs: "Bajar a la planta baja",
    terraceFloor: "deck",
    extra: [
      { kind: "hologram", x: 28, y: 5, w: 2, d: 2 },
      { kind: "ledpillar", x: 16, y: 3 },
      { kind: "ledpillar", x: 41, y: 3 },
      { kind: "arcade", x: 8, y: 34 },
      { kind: "robot", x: 52, y: 36 },
    ],
    decor: [{ kind: "neon", x: 26, y: 2, w: 4, text: "SKY", color: "#22d3ee" }],
  },
  garden: {
    name: "Mirador",
    terrace: "MIRADOR",
    chill: "INVERNADERO",
    bar: "JUGUERÍA",
    zones: ["Mirador · pérgola oeste", "Mirador · glorieta oeste", "Mirador · pérgola este", "Mirador · glorieta este"],
    stairs: "Bajar al parque",
    terraceFloor: "grass",
    extra: [
      { kind: "tree", x: 16, y: 3 },
      { kind: "tree", x: 41, y: 3 },
      { kind: "fountain", x: 28, y: 5, w: 2, d: 2 },
      { kind: "flowerbed", x: 8, y: 37, w: 3 },
      { kind: "lantern", x: 52, y: 36 },
    ],
    decor: [{ kind: "ivy", x: 26, y: 2, w: 4 }],
  },
  minimal: {
    name: "Piso 1",
    terrace: "TERRAZA",
    chill: "BIBLIOTECA",
    bar: "CAFÉ",
    zones: ["Piso 1 · galería oeste", "Piso 1 · fondo oeste", "Piso 1 · galería este", "Piso 1 · fondo este"],
    stairs: "Bajar a la planta baja",
    terraceFloor: "deck",
    extra: [
      { kind: "sculpture", x: 28, y: 5 },
      { kind: "bigplant", x: 16, y: 3 },
      { kind: "bigplant", x: 41, y: 3 },
      { kind: "bookshelf", x: 8, y: 34 },
      { kind: "bookshelf", x: 9, y: 34 },
      { kind: "lamp", x: 52, y: 36 },
    ],
    decor: [{ kind: "art", x: 26, y: 2, w: 3, color: "#e9b8a4" }],
  },
  rustic: {
    name: "Altillo",
    terrace: "TERRAZA",
    chill: "RINCÓN DE LECTURA",
    bar: "BODEGA",
    zones: ["Altillo · pasillo oeste", "Altillo · granero oeste", "Altillo · pasillo este", "Altillo · granero este"],
    stairs: "Bajar al pueblo",
    terraceFloor: "wood",
    extra: [
      { kind: "barrel", x: 16, y: 3 },
      { kind: "barrel", x: 41, y: 3 },
      { kind: "lantern", x: 28, y: 5 },
      { kind: "bookshelf", x: 8, y: 34 },
      { kind: "barrel", x: 52, y: 36 },
    ],
    decor: [{ kind: "fireplace", x: 17, y: 33, w: 3 }],
  },
  medieval: {
    name: "Azotea",
    terrace: "ALMENAS",
    chill: "JARDÍN DE LA TORRE",
    bar: "TABERNA ALTA",
    zones: ["Azotea · torre oeste", "Azotea · torreón oeste", "Azotea · torre este", "Azotea · torreón este"],
    stairs: "Bajar al patio de armas",
    terraceFloor: "stone",
    extra: [
      ...[17, 20, 23, 34, 37, 40].map((x): Furni => ({ kind: "crenel", x, y: 3 })),
      { kind: "telescope", x: 16, y: 10 },
      { kind: "telescope", x: 41, y: 10 },
      { kind: "candelabra", x: 28, y: 5 },
      { kind: "flowerbed", x: 8, y: 37, w: 3 },
      { kind: "barrel", x: 52, y: 36 },
    ],
    decor: [
      { kind: "banner", x: 26, y: 2, color: "#9b2335" },
      { kind: "torch", x: 28, y: 2 },
      { kind: "banner", x: 29, y: 2, color: "#2f6bff" },
    ],
  },
  hackathon: {
    name: "Piso 1",
    terrace: "TERRAZA",
    chill: "SALA DE DESCANSO",
    bar: "SNACKS",
    zones: ["Piso 1 · pasillo oeste", "Piso 1 · fondo oeste", "Piso 1 · pasillo este", "Piso 1 · fondo este"],
    stairs: "Bajar a la zona de equipos",
    terraceFloor: "deck",
    extra: [
      { kind: "ledpillar", x: 16, y: 3 },
      { kind: "ledpillar", x: 41, y: 3 },
      { kind: "robot", x: 28, y: 5 },
      { kind: "arcade", x: 8, y: 34 },
      { kind: "vending", x: 52, y: 34 },
    ],
    decor: [{ kind: "neon", x: 26, y: 2, w: 4, text: "HACK", color: "#ff7a1a" }],
  },
  stellar: {
    name: "Estación orbital",
    terrace: "MIRADOR ESTELAR",
    chill: "ZONA DE DESCANSO",
    bar: "BARRA LUMEN",
    zones: ["Estación · módulo oeste", "Estación · fondo oeste", "Estación · módulo este", "Estación · fondo este"],
    stairs: "Bajar al hub",
    terraceFloor: "deck",
    extra: [
      { kind: "rocket", x: 28, y: 5 },
      { kind: "constellation", x: 16, y: 3 },
      { kind: "constellation", x: 41, y: 3 },
      { kind: "telescope", x: 16, y: 10 },
      { kind: "arcade", x: 8, y: 34 },
      { kind: "constellation", x: 52, y: 36 },
    ],
    decor: [{ kind: "neon", x: 26, y: 2, w: 4, text: "✦ STELLAR", color: "#fdda24" }],
  },
};

/**
 * Piso alto: un gran pasillo con la escalera al medio. Las salas dan todas a
 * ese pasillo (dos de frente a cada lado y dos al fondo de cada punta), y los
 * stands van contra la pared. La terraza, el rincón tranquilo y la barra quedan
 * detrás de portales.
 */
function upperFloor(theme: ThemeId): Level {
  const u = UPPER[theme];
  return {
    name: u.name,
    w: 62,
    h: 40,
    floors: [
      { x: 16, y: 3, w: 26, h: 9 }, // terraza
      { x: 25, y: 12, w: 8, h: 10 }, // paso a la terraza
      { x: 6, y: 22, w: 49, h: 9 }, // gran pasillo
      { x: 12, y: 31, w: 4, h: 3 },
      { x: 8, y: 34, w: 14, h: 4 }, // rincón tranquilo
      { x: 44, y: 31, w: 4, h: 3 },
      { x: 40, y: 34, w: 14, h: 4 }, // barra
    ],
    areas: [{ x: 16, y: 3, w: 26, h: 9, floor: u.terraceFloor }],
    spawn: { x: 29, y: 24 },
    slots: [...pairH(16, 21, u.zones[0]), ...pairV(5, 22, "left", u.zones[1]), ...pairH(33, 21, u.zones[2]), ...pairV(55, 22, "right", u.zones[3])],
    stands: [
      { x: 7, y: 22 },
      { x: 43, y: 22 },
      { x: 48, y: 22 },
    ],
    stairs: [{ x: 12, y: 21, w: 2, dir: "down", to: 0, label: u.stairs }],
    decor: [
      { kind: "sponsors", x: 18, y: 2, w: 4 },
      { kind: "sponsors", x: 36, y: 2, w: 4 },
      { kind: "window", x: 19, y: 21, w: 2 },
      { kind: "window", x: 36, y: 21, w: 2 },
      { kind: "portal", x: 12, y: 33, w: 4, text: u.chill },
      { kind: "portal", x: 44, y: 33, w: 4, text: u.bar },
      ...u.decor,
    ],
    furni: [
      { kind: "parasol", x: 19, y: 6, w: 2 },
      { kind: "parasol", x: 37, y: 6, w: 2 },
      { kind: "bench", x: 21, y: 10, w: 3 },
      { kind: "bench", x: 34, y: 10, w: 3 },
      ...lounge(16, 34, SOFA[theme]),
      { kind: "beanbag", x: 10, y: 36, color: "#ffb703" },
      { kind: "beanbag", x: 12, y: 37, color: "#ef476f" },
      { kind: "coffeebar", x: 40, y: 34, w: 3 },
      { kind: "cafetable", x: 49, y: 35, w: 2 },
      { kind: "cafetable", x: 41, y: 37, w: 2 },
      { kind: "plant", x: 6, y: 30 },
      { kind: "plant", x: 54, y: 30 },
      ...u.extra,
    ],
    crowd: [...chat(23, 8), ...chat(14, 35), ...chat(45, 36), ...chat(20, 26), ...chat(37, 27), ...chat(28, 16)],
    directories: [{ x: 32, y: 27 }],
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
      { x: 11, y: 14, w: 5, h: 17 }, // galería oeste, abierta al patio
      { x: 44, y: 14, w: 5, h: 17 }, // galería este, abierta al patio
      { x: 2, y: 34, w: 12, h: 11 }, // taberna
      { x: 14, y: 36, w: 2, h: 3 },
      { x: 46, y: 34, w: 12, h: 11 }, // sala de juegos
      { x: 44, y: 36, w: 2, h: 3 },
    ],
    areas: [
      { x: 18, y: 25, w: 5, h: 5, floor: "grass" },
      { x: 37, y: 25, w: 5, h: 5, floor: "grass" },
      { x: 2, y: 34, w: 12, h: 11, floor: "wood" },
    ],
    exit: { x: 29, y: 40 },
    spawn: { x: 29, y: 37 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(16, 21, "Patio de armas (oeste)"), ...pairV(10, 15, "left", "Galería oeste"), ...pairH(35, 21, "Patio de armas (este)"), ...pairV(49, 15, "right", "Galería este")],
    stands: [
      { x: 19, y: 22 },
      { x: 38, y: 22 },
      { x: 8, y: 34 },
      { x: 52, y: 34 },
    ],
    stairs: [{ x: 45, y: 13, w: 2, dir: "up", to: 1, label: "Subir a la azotea" }],
    decor: [
      { kind: "torch", x: 26, y: 9 },
      { kind: "torch", x: 33, y: 9 },
      { kind: "banner", x: 12, y: 13, color: "#9b2335" },
      { kind: "torch", x: 14, y: 13 },
      { kind: "fireplace", x: 3, y: 33, w: 3 },
      { kind: "banner", x: 47, y: 33, color: "#2f6bff" },
      { kind: "sponsors", x: 24, y: 21, w: 2 },
      { kind: "sign", x: 14, y: 35, w: 2, text: "← TABERNA" },
      { kind: "sign", x: 44, y: 35, w: 2, text: "JUEGOS →" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 30, w: 6 },
      { kind: "fountain", x: 19, y: 27, w: 2, d: 2 },
      { kind: "fountain", x: 38, y: 27, w: 2, d: 2 },
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
      ...[48, 53].flatMap((x) => [38, 41].map((y): Furni => ({ kind: "chess", x, y, w: 2 }))),
      { kind: "armor", x: 46, y: 44 },
      { kind: "candelabra", x: 11, y: 30 },
      { kind: "candelabra", x: 48, y: 30 },
    ],
    crowd: [...chat(23, 33), ...chat(34, 29), ...chat(29, 14), ...chat(5, 40), ...chat(50, 40), ...chat(12, 26), ...chat(45, 26)],
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
      { x: 27, y: 10, w: 6, h: 10 }, // sendero al auditorio
      { x: 13, y: 12, w: 5, h: 19 }, // sendero oeste, abierto a la plaza
      { x: 42, y: 12, w: 5, h: 19 }, // sendero este, abierto a la plaza
      { x: 16, y: 34, w: 2, h: 4 },
      { x: 2, y: 34, w: 14, h: 12 }, // pícnic
      { x: 42, y: 34, w: 2, h: 4 },
      { x: 44, y: 34, w: 14, h: 12 }, // zona recreativa
    ],
    areas: [
      { x: 2, y: 34, w: 14, h: 12, floor: "grass" },
      { x: 44, y: 34, w: 14, h: 12, floor: "grass" },
      { x: 18, y: 31, w: 7, h: 7, floor: "deck" },
    ],
    exit: { x: 29, y: 38 },
    spawn: { x: 29, y: 35 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(18, 19, "Plaza (oeste)"), ...pairV(12, 13, "left", "Sendero oeste"), ...pairH(33, 19, "Plaza (este)"), ...pairV(47, 13, "right", "Sendero este")],
    stands: [
      { x: 43, y: 12 },
      { x: 4, y: 34 },
      { x: 47, y: 34 },
      { x: 10, y: 34 },
    ],
    stairs: [{ x: 14, y: 11, w: 2, dir: "up", to: 1, label: "Subir al mirador" }],
    decor: [
      { kind: "ivy", x: 27, y: 9 },
      { kind: "ivy", x: 32, y: 9 },
      { kind: "sponsors", x: 53, y: 33, w: 4 },
      { kind: "ivy", x: 2, y: 33, w: 2 },
      { kind: "sign", x: 16, y: 33, w: 2, text: "← PÍCNIC" },
      { kind: "sign", x: 42, y: 33, w: 2, text: "JUEGOS →" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 26, w: 6 },
      { kind: "fountain", x: 36, y: 30, w: 2, d: 2 },
      { kind: "tree", x: 41, y: 37 },
      { kind: "flowerbed", x: 38, y: 36, w: 3 },
      { kind: "lantern", x: 27, y: 20 },
      { kind: "lantern", x: 32, y: 20 },
      // Café del jardín, en un deck de la plaza.
      { kind: "coffeebar", x: 18, y: 31, w: 3 },
      { kind: "cafetable", x: 19, y: 34, w: 2 },
      { kind: "cafetable", x: 22, y: 33, w: 2 },
      { kind: "parasol", x: 22, y: 36, w: 2 },
      ...[3, 9].flatMap((x) => [38, 42].map((y): Furni => ({ kind: "table", x, y, w: 2 }))),
      { kind: "tree", x: 2, y: 45 },
      { kind: "tree", x: 15, y: 45 },
      { kind: "parasol", x: 13, y: 40, w: 2 },
      { kind: "pingpong", x: 46, y: 38, w: 3 },
      { kind: "foosball", x: 52, y: 39, w: 2 },
      { kind: "chess", x: 46, y: 42, w: 2 },
      { kind: "beanbag", x: 54, y: 43, color: "#ffb703" },
      { kind: "beanbag", x: 56, y: 43, color: "#ef476f" },
      { kind: "tree", x: 57, y: 45 },
      { kind: "lantern", x: 17, y: 30 },
      { kind: "lantern", x: 42, y: 30 },
      { kind: "tree", x: 13, y: 30 },
      { kind: "tree", x: 46, y: 30 },
    ],
    crowd: [...chat(24, 28), ...chat(33, 33), ...chat(6, 40), ...chat(50, 41), ...chat(29, 13), ...chat(14, 24), ...chat(44, 22)],
    directories: [
      { x: 25, y: 35 },
      { x: 34, y: 35 },
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
      { x: 13, y: 30, w: 33, h: 11 }, // lobby, abierto a las dos alas
      { x: 8, y: 26, w: 5, h: 15 }, // ala oeste
      { x: 46, y: 26, w: 5, h: 15 }, // ala este
      { x: 14, y: 8, w: 7, h: 9 }, // café
      { x: 15, y: 17, w: 4, h: 3 },
      { x: 38, y: 8, w: 7, h: 9 }, // estudio de juegos
      { x: 40, y: 17, w: 4, h: 3 },
    ],
    areas: [
      { x: 13, y: 36, w: 4, h: 5, floor: "grass" },
      { x: 42, y: 36, w: 4, h: 5, floor: "grass" },
      { x: 14, y: 8, w: 7, h: 9, floor: "wood" },
    ],
    exit: { x: 29, y: 41 },
    spawn: { x: 29, y: 38 },
    main: { x: 28, y: 19, roof: { x: 22, y: 11, w: 16, h: 7 } },
    slots: [...pairH(4, 19, "Galería oeste"), ...pairV(7, 30, "left", "Ala oeste"), ...pairH(46, 19, "Galería este"), ...pairV(51, 30, "right", "Ala este")],
    stands: [
      { x: 14, y: 30 },
      { x: 36, y: 30 },
      { x: 41, y: 30 },
    ],
    stairs: [{ x: 21, y: 29, w: 2, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "portal", x: 15, y: 19, w: 4, text: "CAFÉ" },
      { kind: "portal", x: 40, y: 19, w: 4, text: "ESTUDIO DE JUEGOS" },
      { kind: "art", x: 24, y: 19, w: 2, color: "#e9b8a4" },
      { kind: "art", x: 34, y: 19, w: 2, color: "#a4c3e9" },
      { kind: "window", x: 16, y: 7, w: 3 },
      { kind: "art", x: 40, y: 7, w: 3, color: "#c9e4a4" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 32, w: 6 },
      { kind: "sculpture", x: 14, y: 38 },
      { kind: "bigplant", x: 44, y: 38 },
      ...lounge(36, 37, "#9aa5b1"),
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
    crowd: [...chat(24, 35), ...chat(30, 23), ...chat(16, 11), ...chat(41, 15), ...chat(10, 36), ...chat(47, 36), ...chat(18, 23), ...chat(19, 35)],
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
    h: 46,
    floors: [
      { x: 19, y: 24, w: 22, h: 12 }, // plaza del pueblo
      { x: 26, y: 10, w: 8, h: 14 }, // calle mayor
      { x: 3, y: 28, w: 16, h: 5 }, // calle oeste
      { x: 41, y: 28, w: 15, h: 5 }, // calle este
      { x: 3, y: 33, w: 5, h: 10 }, // callejón suroeste
      { x: 51, y: 33, w: 5, h: 10 }, // callejón sureste
      { x: 4, y: 10, w: 17, h: 9 }, // fonda
      { x: 21, y: 13, w: 5, h: 3 },
      { x: 38, y: 10, w: 17, h: 9 }, // plaza de juegos
      { x: 34, y: 13, w: 4, h: 3 },
    ],
    areas: [
      { x: 4, y: 10, w: 17, h: 9, floor: "wood" },
      { x: 19, y: 32, w: 4, h: 4, floor: "grass" },
      { x: 37, y: 32, w: 4, h: 4, floor: "grass" },
      { x: 3, y: 39, w: 5, h: 4, floor: "grass" },
      { x: 51, y: 39, w: 5, h: 4, floor: "grass" },
    ],
    exit: { x: 29, y: 36 },
    spawn: { x: 29, y: 33 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(5, 27, "Calle oeste"), ...pairV(8, 33, "right", "Esquina suroeste"), ...pairH(44, 27, "Calle este"), ...pairV(50, 33, "left", "Esquina sureste")],
    stands: [
      { x: 20, y: 24 },
      { x: 41, y: 28 },
      { x: 15, y: 28 },
      { x: 53, y: 28 },
    ],
    stairs: [{ x: 36, y: 23, w: 2, dir: "up", to: 1, label: "Subir al altillo" }],
    decor: [
      { kind: "window", x: 26, y: 9, w: 2 },
      { kind: "window", x: 32, y: 9, w: 2 },
      { kind: "fireplace", x: 6, y: 9, w: 3 },
      { kind: "shelf", x: 11, y: 9, w: 3 },
      { kind: "sponsors", x: 15, y: 9, w: 4 },
      { kind: "sponsors", x: 40, y: 9, w: 4 },
      { kind: "window", x: 47, y: 9, w: 3 },
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
      { kind: "flowerbed", x: 3, y: 42, w: 3 },
      { kind: "flowerbed", x: 53, y: 42, w: 3 },
    ],
    crowd: [...chat(23, 30), ...chat(34, 31), ...chat(8, 14), ...chat(42, 16), ...chat(12, 30), ...chat(47, 30), ...chat(29, 15), ...chat(4, 38)],
    directories: [
      { x: 24, y: 33 },
      { x: 35, y: 33 },
    ],
  };
}

// ----- Stellar: un hub con módulos alrededor, observatorio y lounge -----

function stellarGround(): Level {
  return {
    name: "Hub",
    w: 60,
    h: 50,
    floors: [
      { x: 18, y: 24, w: 24, h: 14 }, // hub central
      { x: 27, y: 10, w: 6, h: 14 }, // pasarela al auditorio
      { x: 3, y: 8, w: 19, h: 7 }, // observatorio
      { x: 22, y: 10, w: 5, h: 3 },
      { x: 38, y: 8, w: 19, h: 7 }, // nodo de juegos
      { x: 33, y: 10, w: 5, h: 3 },
      { x: 20, y: 38, w: 4, h: 2 },
      { x: 8, y: 40, w: 18, h: 8 }, // café
      { x: 36, y: 38, w: 4, h: 2 },
      { x: 34, y: 40, w: 18, h: 8 }, // lounge
    ],
    areas: [
      { x: 8, y: 40, w: 18, h: 8, floor: "deck" },
      { x: 3, y: 8, w: 19, h: 7, floor: "tiles" },
    ],
    exit: { x: 29, y: 38 },
    spawn: { x: 29, y: 35 },
    main: { x: 28, y: 9, roof: { x: 22, y: 1, w: 16, h: 7 } },
    slots: [...pairH(18, 23, "Hub (oeste)"), ...pairV(17, 26, "left", "Módulo Soroban"), ...pairH(33, 23, "Hub (este)"), ...pairV(42, 26, "right", "Módulo Horizon")],
    stands: [
      { x: 21, y: 24 },
      { x: 36, y: 24 },
      { x: 13, y: 40 },
      { x: 45, y: 40 },
      { x: 14, y: 8 },
      { x: 45, y: 8 },
    ],
    stairs: [{ x: 8, y: 7, w: 2, dir: "up", to: 1, label: "Subir a la estación" }],
    decor: [
      { kind: "neon", x: 3, y: 7, w: 3, text: "OBSERVATORIO", color: "#fdda24" },
      { kind: "window", x: 18, y: 7, w: 3 },
      { kind: "neon", x: 38, y: 7, w: 3, text: "NODO", color: "#b7ace8" },
      { kind: "sponsors", x: 50, y: 7, w: 4 },
      { kind: "sign", x: 23, y: 9, w: 4, text: "← OBSERVATORIO" },
      { kind: "sign", x: 33, y: 9, w: 4, text: "JUEGOS →" },
      { kind: "portal", x: 20, y: 39, w: 4, text: "CAFÉ ANCLA" },
      { kind: "portal", x: 36, y: 39, w: 4, text: "GALAXY LOUNGE" },
      { kind: "neon", x: 48, y: 39, w: 4, text: "✦ LOUNGE", color: "#fdda24" },
    ],
    furni: [
      { kind: "eventscreen", x: 27, y: 29, w: 6 },
      { kind: "rocket", x: 40, y: 31 },
      { kind: "constellation", x: 19, y: 31 },
      { kind: "constellation", x: 41, y: 36 },
      { kind: "bigplant", x: 18, y: 37 },
      { kind: "telescope", x: 5, y: 12 },
      { kind: "telescope", x: 20, y: 12 },
      { kind: "bench", x: 12, y: 13, w: 3 },
      { kind: "constellation", x: 17, y: 9 },
      { kind: "arcade", x: 54, y: 8 },
      { kind: "arcade", x: 55, y: 8 },
      { kind: "arcade", x: 56, y: 8 },
      { kind: "pingpong", x: 39, y: 11, w: 3 },
      { kind: "foosball", x: 49, y: 12, w: 2 },
      { kind: "beanbag", x: 53, y: 13, color: "#fdda24" },
      { kind: "beanbag", x: 55, y: 13, color: "#b7ace8" },
      { kind: "coffeebar", x: 8, y: 40, w: 3 },
      { kind: "cafetable", x: 9, y: 44, w: 2 },
      { kind: "cafetable", x: 13, y: 45, w: 2 },
      { kind: "cafetable", x: 21, y: 44, w: 2 },
      { kind: "bigplant", x: 25, y: 47 },
      ...lounge(41, 43, "#fdda24"),
      { kind: "beanbag", x: 49, y: 45, color: "#b7ace8" },
      { kind: "beanbag", x: 50, y: 46, color: "#fdda24" },
      { kind: "rocket", x: 34, y: 46 },
    ],
    crowd: [...chat(24, 32), ...chat(33, 33), ...chat(4, 11), ...chat(44, 12), ...chat(17, 44), ...chat(38, 45), ...chat(29, 15)],
    directories: [
      { x: 23, y: 35 },
      { x: 36, y: 35 },
    ],
  };
}

// ----- Hackathon: un pasillo principal con stands, cuatro salas de equipos por piso y salas de charla separadas -----

const TEAM_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#fb7185", "#4ade80"];

/** Lugares de cada sala de equipos. */
export const TEAM_HALL_SEATS = 64;

/** Cuántas salas de equipos abre un cupo (64 lugares cada una, hasta 8). */
export const teamHallsFor = (capacity: number) => Math.min(8, Math.ceil(capacity / TEAM_HALL_SEATS));

/** Mesa de equipo: una mesa con sus sillas a los dos lados, adentro de su rectángulo (5 de alto). */
function teamTable(n: number, seats: 6 | 4 | 2, x: number, y: number, color: string): { zone: Zone; furni: Furni[] } {
  const cols = seats / 2;
  return {
    zone: { id: `mesa-${n}`, label: `Mesa ${n}`, x, y, w: cols + 2, h: 5, color, seats },
    furni: [
      { kind: "table", x: x + 1, y: y + 2, w: cols },
      ...Array.from({ length: cols }, (_, i) => [
        { kind: "officechair" as const, x: x + 1 + i, y: y + 1 },
        { kind: "officechair" as const, x: x + 1 + i, y: y + 3 },
      ]).flat(),
    ],
  };
}

/**
 * Sala de equipos de 64 personas (33×24): 4 mesas de 6, 6 de 4 y 8 de 2, y
 * su propia cafetería y zona de juegos.
 */
function teamHall(hall: number, x0: number, y0: number) {
  const color = TEAM_COLORS[(hall - 1) % TEAM_COLORS.length]!;
  let n = (hall - 1) * 18;
  const rows: [seats: 6 | 4 | 2, count: number, step: number][] = [
    [6, 4, 6],
    [4, 6, 5],
    [2, 8, 4],
  ];
  const tables = rows.flatMap(([seats, count, step], r) => Array.from({ length: count }, (_, i) => teamTable(++n, seats, x0 + 1 + i * step, y0 + 1 + r * 7, color)));
  return {
    zones: tables.map((t) => t.zone),
    furni: [
      ...tables.flatMap((t) => t.furni),
      // Cafetería del equipo.
      { kind: "coffeebar", x: x0 + 26, y: y0, w: 4 },
      { kind: "vending", x: x0 + 31, y: y0 },
      { kind: "cafetable", x: x0 + 26, y: y0 + 3, w: 2 },
      { kind: "cafetable", x: x0 + 30, y: y0 + 3, w: 2 },
      // Zona de juegos al fondo.
      { kind: "pingpong", x: x0 + 2, y: y0 + 21, w: 3 },
      { kind: "foosball", x: x0 + 8, y: y0 + 21, w: 2 },
      { kind: "beanbag", x: x0 + 13, y: y0 + 22, color },
      { kind: "beanbag", x: x0 + 15, y: y0 + 22, color: "#f472b6" },
      { kind: "arcade", x: x0 + 29, y: y0 + 22 },
      { kind: "arcade", x: x0 + 30, y: y0 + 22 },
      { kind: "arcade", x: x0 + 31, y: y0 + 22 },
    ] as Furni[],
  };
}

/** Una sala de equipos: dónde está, por dónde se entra y su portal (sobre la cara de muro de la zona de abajo). */
interface HallSpot {
  hall: number;
  x: number;
  y: number;
  /** Puertas de entrada: cada una con su paso y, si es de frente, su portal con el nombre. */
  entrances: { rect: Rect; portal?: Tile }[];
}

/**
 * Arma las salas de equipos de un piso. Las que superan el cupo quedan
 * cerradas: sin entrada, sin mesas activas y con un cartel que dice cuándo se
 * habilitan.
 */
function teamHalls(spots: HallSpot[], capacity: number) {
  const floors: Rect[] = [];
  const zones: Zone[] = [];
  const furni: Furni[] = [];
  const decor: Decor[] = [];
  const closed: (Rect & { label: string })[] = [];
  const open = (hall: number) => hall <= teamHallsFor(capacity);
  const need = (hall: number) => [100, 200, 300, 400, 500].find((c) => teamHallsFor(c) >= hall) ?? 500;
  for (const s of spots) {
    const rect = { x: s.x, y: s.y, w: 33, h: 24 };
    const t = teamHall(s.hall, s.x, s.y);
    floors.push(rect);
    furni.push(...t.furni);
    // En la pared de arriba: una pantalla con código y una pizarra.
    decor.push({ kind: "codewall", x: s.x + 10, y: s.y - 1, w: 7 }, { kind: "whiteboard", x: s.x + 17, y: s.y - 1, w: 3 });
    if (open(s.hall)) {
      zones.push(...t.zones);
      for (const e of s.entrances) {
        floors.push(e.rect);
        if (e.portal) decor.push({ kind: "portal", x: e.portal.x, y: e.portal.y, w: e.rect.w, text: `EQUIPOS ${s.hall}` });
      }
    } else {
      closed.push({ ...rect, label: `Sala de equipos ${s.hall} · se habilita con ${need(s.hall)} participantes` });
    }
  }
  const name = (hall: number) => `Equipos ${hall}${open(hall) ? "" : " (cerrada)"}`;
  return { floors, zones, furni, decor, closed, name };
}

/** Una sola sala con la puerta en un muro lateral (techo de 5×4). */
const singleV = (wallX: number, y: number, side: "left" | "right", zone: string): Slot => ({
  door: { x: wallX, y: y + 1, side },
  roof: { x: side === "left" ? wallX - 5 : wallX + 1, y, w: 5, h: 4 },
  zone,
});

/** Cuarto con puerta a la calle de abajo: su piso, el paso hasta la calle y la puerta con su nombre en la cara de muro `faceY`. */
function doorRoom(room: Rect, faceY: number, label: string, color: string) {
  const dx = room.x + Math.floor(room.w / 2) - 1;
  const passage: Rect = { x: dx, y: room.y + room.h, w: 2, h: faceY - (room.y + room.h) + 1 };
  const door: Decor = { kind: "roomdoor", x: dx, y: faceY, w: 2, text: label, color };
  return { room, passage, door };
}

/** Sala de reunión: una mesa con sillas, cafetera, agua y un sillón. Quien entra se suma a la charla. */
function meetingRoom(r: Rect, color: string, extra: Furni[]): Furni[] {
  const tx = r.x + 3;
  const ty = r.y + 3;
  return [
    { kind: "table", x: tx, y: ty, w: 7 },
    ...Array.from({ length: 7 }, (_, i) => [
      { kind: "officechair" as const, x: tx + i, y: ty - 1 },
      { kind: "officechair" as const, x: tx + i, y: ty + 1 },
    ]).flat(),
    { kind: "coffeebar", x: r.x + r.w - 4, y: r.y + r.h - 1, w: 3 },
    { kind: "cooler", x: r.x + r.w - 1, y: r.y },
    { kind: "sofa", x: r.x + 1, y: r.y + r.h - 2, w: 3, color, dir: "down" },
    { kind: "bigplant", x: r.x, y: r.y },
    ...extra,
  ];
}

/*
 * Plano del hackathon: una calle principal (norte–sur) cruzada por dos calles
 * (este–oeste), todas anchas y con vida: robots, hologramas, pantallas del
 * evento y tótems con los logos de los patrocinadores. En cada cruce, una sala
 * de equipos con tres puertas (dos desde su calle y una desde la calle
 * principal); al lado de cada una, a pocos pasos, una sala de charla. Arriba,
 * el auditorio con mentores y staff a los lados; abajo, la entrada.
 */
const HACK_MAIN: Rect = { x: 50, y: 16, w: 14, h: 67 };
const HACK_CROSS_A: Rect = { x: 10, y: 16, w: 94, h: 12 };
const HACK_CROSS_B: Rect = { x: 10, y: 58, w: 94, h: 12 };
const hackHalls = (first: number): HallSpot[] => {
  const top = (x0: number, y: number) => [
    { rect: { x: x0 + 4, y, w: 4, h: 3 }, portal: { x: x0 + 4, y: y + 2 } },
    { rect: { x: x0 + 22, y, w: 4, h: 3 }, portal: { x: x0 + 22, y: y + 2 } },
  ];
  return [
    { hall: first, x: 14, y: 31, entrances: [...top(14, 28), { rect: { x: 47, y: 40, w: 3, h: 5 } }] },
    { hall: first + 1, x: 67, y: 31, entrances: [...top(67, 28), { rect: { x: 64, y: 40, w: 3, h: 5 } }] },
    { hall: first + 2, x: 14, y: 73, entrances: [...top(14, 70), { rect: { x: 47, y: 76, w: 3, h: 5 } }] },
    { hall: first + 3, x: 67, y: 73, entrances: [...top(67, 70), { rect: { x: 64, y: 76, w: 3, h: 5 } }] },
  ];
};

/** Una sala de charla en cada punta de las calles cruzadas, a pocos pasos de su sala de equipos. */
const hackRoomSlots = (prefix: string): Slot[] => [
  singleV(9, 19, "left", `${prefix}junto a equipos (noroeste)`),
  singleV(104, 19, "right", `${prefix}junto a equipos (noreste)`),
  singleV(9, 61, "left", `${prefix}junto a equipos (suroeste)`),
  singleV(104, 61, "right", `${prefix}junto a equipos (sureste)`),
];

/** Stands: contra la pared de arriba de las dos calles cruzadas, separados entre sí y de cada puerta. */
const HACK_STANDS = [
  ...[11, 16, 35, 41, 63, 69, 88, 94, 99].map((x) => ({ x, y: 16 })),
  ...[20, 30, 40, 73, 83, 93].map((x) => ({ x, y: 58 })),
];

/** Paredes de las calles: pantallas con código que corre intercaladas con pantallas de patrocinadores. */
const hackWallDecor = (): Decor[] => [
  { kind: "codewall", x: 20, y: 15, w: 5 },
  { kind: "sponsors", x: 45, y: 15, w: 3 },
  { kind: "codewall", x: 73, y: 15, w: 6 },
  { kind: "codewall", x: 11, y: 57, w: 6 },
  { kind: "sponsors", x: 24, y: 57, w: 5 },
  { kind: "codewall", x: 34, y: 57, w: 5 },
  { kind: "sponsors", x: 44, y: 57, w: 4 },
  { kind: "codewall", x: 67, y: 57, w: 5 },
  { kind: "sponsors", x: 77, y: 57, w: 5 },
  { kind: "codewall", x: 87, y: 57, w: 5 },
  { kind: "sponsors", x: 97, y: 57, w: 6 },
];

/** Gente conversando por las calles. */
const HACK_STREET_CROWD: [number, number, Dir][] = [
  ...chat(16, 24),
  ...chat(46, 23),
  ...chat(90, 26),
  ...chat(20, 66),
  ...chat(60, 61),
  ...chat(80, 65),
  ...chat(56, 77),
  ...chat(53, 55),
];

/** Vida en las calles: robots, hologramas, pantallas del evento, tótems con los patrocinadores y luces. Nada corta el paso. */
const hackStreetFurni = (north: string, south: string): Furni[] => [
  // Calle principal.
  { kind: "eventscreen", x: 53, y: 43, w: 8 },
  { kind: "hologram", x: 56, y: 33, w: 2, d: 2 },
  { kind: "hologram", x: 56, y: 52, w: 2, d: 2 },
  { kind: "robot", x: 52, y: 37 },
  { kind: "robot", x: 61, y: 49 },
  ...[30, 38, 47, 55].flatMap((y) => [
    { kind: "totem" as const, x: 51, y },
    { kind: "totem" as const, x: 62, y },
  ]),
  ...[34, 51].flatMap((y) => [
    { kind: "ledpillar" as const, x: 50, y },
    { kind: "ledpillar" as const, x: 63, y },
  ]),
  { kind: "signpost", x: 59, y: 29, label: north },
  { kind: "signpost", x: 59, y: 71, label: south },
  // Calles cruzadas.
  ...[23, 76].flatMap((x) => [
    { kind: "hologram" as const, x, y: 23, w: 2, d: 2 },
    { kind: "hologram" as const, x, y: 65, w: 2, d: 2 },
  ]),
  ...[32, 44, 70, 82].flatMap((x) => [
    { kind: "totem" as const, x, y: 26 },
    { kind: "totem" as const, x, y: 68 },
  ]),
  { kind: "robot", x: 40, y: 22 },
  { kind: "robot", x: 88, y: 24 },
  { kind: "robot", x: 30, y: 64 },
  { kind: "robot", x: 92, y: 66 },
  { kind: "directory", x: 47, y: 26 },
  { kind: "directory", x: 66, y: 66 },
  // Lo divertido: realidad virtual, drones, impresoras 3D, cargadores y un photobooth.
  { kind: "vrpod", x: 14, y: 22, w: 2 },
  { kind: "vrpod", x: 98, y: 22, w: 2 },
  { kind: "vrpod", x: 14, y: 64, w: 2 },
  { kind: "vrpod", x: 98, y: 64, w: 2 },
  { kind: "vrpod", x: 51, y: 64, w: 2 },
  { kind: "vrpod", x: 61, y: 64, w: 2 },
  ...[
    [30, 21],
    [68, 21],
    [92, 21],
    [59, 35],
    [54, 49],
    [38, 62],
    [86, 62],
    [57, 66],
  ].map(([x, y]): Furni => ({ kind: "drone", x: x!, y: y! })),
  { kind: "printer3d", x: 36, y: 24 },
  { kind: "printer3d", x: 80, y: 24 },
  { kind: "printer3d", x: 27, y: 67 },
  { kind: "printer3d", x: 88, y: 68 },
  { kind: "charger", x: 19, y: 26 },
  { kind: "charger", x: 95, y: 26 },
  { kind: "charger", x: 45, y: 63 },
  { kind: "charger", x: 50, y: 79 },
  { kind: "photobooth", x: 51, y: 76, w: 2 },
  { kind: "photobooth", x: 71, y: 62, w: 2 },
  ...[10, 103].flatMap((x) => [
    { kind: "ledpillar" as const, x, y: 27 },
    { kind: "ledpillar" as const, x, y: 69 },
  ]),
];

function hackathonGround(capacity: number): Level {
  const halls = teamHalls(hackHalls(1), capacity);
  const mentors = doorRoom({ x: 24, y: 3, w: 13, h: 10 }, 15, "🧭 MENTORES", "#f59e0b");
  const staff = doorRoom({ x: 77, y: 3, w: 13, h: 10 }, 15, "🔒 STAFF", "#ef4444");
  return {
    name: "Planta baja",
    w: 112,
    h: 99,
    floors: [HACK_MAIN, HACK_CROSS_A, HACK_CROSS_B, ...halls.floors, mentors.room, mentors.passage, staff.room, staff.passage],
    areas: [{ ...mentors.room, floor: "wood" }],
    exit: { x: 56, y: 83 },
    spawn: { x: 56, y: 80 },
    main: { x: 55, y: 15, roof: { x: 48, y: 7, w: 18, h: 7 } },
    slots: hackRoomSlots(""),
    zones: [
      ...halls.zones,
      { id: "mentores", label: "Sala de mentores", ...mentors.room, color: "#f59e0b", seats: 30, room: true },
      { id: "organizadores", label: "Sala de organizadores", ...staff.room, color: "#ef4444", seats: 30, staff: true, room: true },
    ],
    closed: halls.closed,
    restricted: [
      { ...staff.room, staff: true },
      { ...staff.passage, staff: true },
    ],
    stands: HACK_STANDS,
    expo: true,
    stairs: [{ x: 50, y: 15, w: 2, dir: "up", to: 1, label: "ASCENSOR · equipos 5 a 8" }],
    decor: [...halls.decor, ...hackWallDecor(), mentors.door, staff.door],
    furni: [
      ...halls.furni,
      ...hackStreetFurni("↑ Auditorio · ← Mentores · Staff →|← Equipos 1 · Equipos 2 →|← Charlas en las puntas →", "← Equipos 3 · Equipos 4 →|← Charlas en las puntas →|↑ Auditorio y ascensor"),
      ...meetingRoom(mentors.room, "#b45309", [{ kind: "bookshelf", x: 24, y: 7 }]),
      ...meetingRoom(staff.room, "#ef4444", [{ kind: "rack", x: 77, y: 7 }]),
      { kind: "countdown", x: 52, y: 74, w: 10 },
      { kind: "signpost", x: 60, y: 79, label: "↑ Salas de equipos y charlas|↑↑ Auditorio, mentores y staff" },
    ],
    crowd: [
      [16, 33, "down", true],
      [18, 33, "down", true],
      [17, 35, "up", true],
      [73, 40, "down", true],
      [74, 42, "up", true],
      [28, 5, "down", true],
      [30, 5, "down", true],
      [29, 7, "up", true],
      ...chat(26, 21),
      ...chat(84, 20),
      ...chat(54, 40),
      ...chat(58, 64),
      ...chat(35, 63),
      ...HACK_STREET_CROWD,
    ],
    directories: [],
  };
}

/** Piso alto: las mismas calles con vida, las salas de equipos 5 a 8, una terraza, una sala de descanso y una zona de juegos. */
function hackathonUpper(capacity: number): Level {
  const halls = teamHalls(hackHalls(5), capacity);
  const terrace = doorRoom({ x: 24, y: 3, w: 13, h: 10 }, 15, "🌿 TERRAZA", "#10b981");
  const lounge = doorRoom({ x: 77, y: 3, w: 13, h: 10 }, 15, "☕ SALA DE DESCANSO", "#a78bfa");
  const games = doorRoom({ x: 48, y: 3, w: 18, h: 10 }, 15, "🎮 ZONA DE JUEGOS", "#22d3ee");
  return {
    name: "Piso 1",
    w: 112,
    h: 99,
    floors: [HACK_MAIN, HACK_CROSS_A, HACK_CROSS_B, ...halls.floors, terrace.room, terrace.passage, lounge.room, lounge.passage, games.room, games.passage],
    areas: [
      { ...terrace.room, floor: "deck" },
      { ...lounge.room, floor: "wood" },
    ],
    spawn: { x: 50, y: 16 },
    slots: hackRoomSlots("Piso 1 · "),
    zones: halls.zones,
    closed: halls.closed,
    stands: HACK_STANDS,
    expo: true,
    stairs: [{ x: 50, y: 15, w: 2, dir: "down", to: 0, label: "ASCENSOR · auditorio, mentores y staff" }],
    decor: [...halls.decor, ...hackWallDecor(), terrace.door, lounge.door, games.door],
    furni: [
      ...halls.furni,
      ...hackStreetFurni("↑ Juegos · ← Terraza · Descanso →|← Equipos 5 · Equipos 6 →|← Charlas en las puntas →", "← Equipos 7 · Equipos 8 →|← Charlas en las puntas →|↑ Ascensor"),
      { kind: "countdown", x: 52, y: 74, w: 10 },
      { kind: "parasol", x: 26, y: 5, w: 2 },
      { kind: "parasol", x: 32, y: 5, w: 2 },
      { kind: "beanbag", x: 26, y: 10, color: "#fbbf24" },
      { kind: "beanbag", x: 33, y: 10, color: "#22d3ee" },
      { kind: "tree", x: 24, y: 3 },
      { kind: "tree", x: 36, y: 3 },
      { kind: "sofa", x: 78, y: 5, w: 3, color: "#a78bfa", dir: "down" },
      { kind: "sofa", x: 84, y: 5, w: 3, color: "#a78bfa", dir: "down" },
      { kind: "beanbag", x: 79, y: 9, color: "#f472b6" },
      { kind: "beanbag", x: 86, y: 9, color: "#22d3ee" },
      { kind: "coffeebar", x: 77, y: 3, w: 3 },
      { kind: "pingpong", x: 49, y: 5, w: 3 },
      { kind: "pingpong", x: 61, y: 5, w: 3 },
      { kind: "foosball", x: 55, y: 7, w: 2 },
      { kind: "arcade", x: 48, y: 3 },
      { kind: "arcade", x: 49, y: 3 },
      { kind: "arcade", x: 64, y: 3 },
      { kind: "arcade", x: 65, y: 3 },
      { kind: "beanbag", x: 50, y: 10, color: "#fbbf24" },
      { kind: "beanbag", x: 63, y: 10, color: "#22d3ee" },
    ],
    crowd: [...chat(26, 21), ...chat(84, 20), ...chat(54, 40), ...chat(28, 7), ...chat(56, 9), ...HACK_STREET_CROWD],
    directories: [],
  };
}

const LEVELS: Record<ThemeId, (capacity: number) => Level[]> = {
  tech: () => [techGround(), upperFloor("tech")],
  medieval: () => [castleGround(), upperFloor("medieval")],
  garden: () => [parkGround(), upperFloor("garden")],
  minimal: () => [galleryGround(), upperFloor("minimal")],
  rustic: () => [villageGround(), upperFloor("rustic")],
  stellar: () => [stellarGround(), upperFloor("stellar")],
  hackathon: (capacity) => [hackathonGround(capacity), hackathonUpper(capacity)],
};

/** Lo que el plano necesita saber de un patrocinador: su nombre, para el representante del stand. */
type StandSponsor = { name: string; organizer?: boolean };

/** Quién tiene stand en un evento, en orden: cada patrocinador y, al final, el organizador. */
export const standList = (venue: { sponsors: { name: string }[]; organizer: string }): StandSponsor[] => [
  ...venue.sponsors.map((s) => ({ name: s.name })),
  { name: venue.organizer, organizer: true },
];

function buildLevel(
  theme: ThemeId,
  L: Level,
  main: Pick<Room, "id" | "name" | "color" | "theme"> | null,
  rooms: Pick<Room, "id" | "name" | "color" | "theme">[],
  sponsors: StandSponsor[],
): SceneMap {
  const doors: Door[] = [];
  const roofs: Roof[] = [];
  if (main && L.main) {
    doors.push({ side: "top", x: L.main.x, y: L.main.y, w: 4, id: main.id, label: main.name, color: main.color, theme: main.theme ?? theme, zone: "Auditorio principal", main: true });
    roofs.push({ ...L.main.roof, label: main.name, color: main.color, open: true });
  }
  const decor = [...L.decor];
  L.slots.forEach((slot, i) => {
    const room = rooms[i];
    roofs.push({ ...slot.roof, label: room?.name ?? "", color: room?.color ?? "", open: Boolean(room) });
    // La puerta lleva la temática de la sala si tiene una propia (por ejemplo, una sala Stellar en un evento tecnológico).
    if (room) doors.push({ ...slot.door, w: 2, id: room.id, label: room.name, color: room.color, theme: room.theme ?? theme, zone: slot.zone, main: false });
    // Los puestos sin sala de los muros de frente muestran un cuadro.
    else if (slot.door.side === "top") decor.push({ kind: "art", x: slot.door.x, y: slot.door.y, w: 2, color: "#9aa5b1" });
  });
  if (L.exit) decor.push({ kind: "entrance", x: L.exit.x, y: L.exit.y, w: 2 });
  // Un stand por patrocinador, mientras haya lugar; cada uno con alguien que cuenta del producto.
  const all = L.stands ?? [];
  const stands = all.slice(0, sponsors.length);
  // En una feria se ven todos los puestos; los libres quedan como «espacio disponible», sin nadie que atienda.
  const booths = (L.expo ? all : stands).map((t, n): Furni => ({ kind: "booth", x: t.x, y: t.y, w: 3, d: 2, n: n < sponsors.length ? n : undefined, free: t.free }));
  // Dos personas por stand: muñecos que atienden hasta que llega alguien real del patrocinador.
  const reps = stands.flatMap((t, n) =>
    [0, 2].map(
      (dx, k): Npc => ({
        ...attendee(40 + n * 3 + k, t.x + dx, t.y, "down"),
        id: `stand-${n}-${k}`,
        name: sponsors[n]!.name,
        sponsor: n,
        talkFrom: [0, 1, 2].map((ddx) => ({ x: t.x + ddx, y: t.y + 2 })),
      }),
    ),
  );
  // Alrededor de cada stand, un cuadrado con su propia conversación: ahí se escucha a quienes atienden.
  const standZones = stands.map(
    (t, n): Zone => ({ id: `stand-${n}`, label: `Stand de ${sponsors[n]!.name}`, x: t.x, y: t.y, w: 3, h: 4, color: "#64748b", seats: 8 }),
  );
  // Detrás del mostrador solo entran quienes lo atienden (y el equipo organizador en su propio stand).
  const standBacks = stands.map((t, n): Reserved => ({ x: t.x, y: t.y, w: 3, h: 1, sponsor: n, staff: sponsors[n]!.organizer }));
  return finish({
    ...empty,
    w: L.w,
    h: L.h,
    tiles: carve(L.w, L.h, L.floors),
    style: theme,
    floorName: L.name,
    spawn: L.spawn,
    furni: [...L.furni, ...booths, ...L.directories.map((d): Furni => ({ kind: "directory", x: d.x, y: d.y }))],
    decor,
    doors,
    roofs,
    npcs: reps,
    stairs: L.stairs,
    zones: [...(L.zones ?? []), ...standZones],
    closed: L.closed ?? [],
    restricted: [...(L.restricted ?? []), ...standBacks],
    areas: L.areas ?? [],
    crowd: L.crowd.map(([x, y, dir, sit], i) => ({ ...attendee(i, x, y, dir), sit })),
    exit: L.exit ? { side: "bottom", x: L.exit.x, y: L.exit.y, w: 2 } : null,
    directories: L.directories,
  });
}

/**
 * Los pisos del recinto: planta baja con el auditorio y ocho salas, y un piso
 * alto con ocho salas más. Los patrocinadores reciben un stand en cada piso.
 */
export function venueFloors(
  theme: ThemeId,
  rooms: Pick<Room, "id" | "name" | "color" | "main" | "theme">[],
  sponsors: StandSponsor[] = [],
  capacity = 100,
): SceneMap[] {
  const main = rooms.find((r) => r.main) ?? rooms[0] ?? null;
  const others = rooms.filter((r) => r !== main);
  // Cada piso recibe tantas salas como lugares tenga (8 en la mayoría; 4 por piso en un hackathon).
  let offset = 0;
  return LEVELS[theme](capacity).map((L, i) => {
    const taken = others.slice(offset, offset + L.slots.length);
    offset += L.slots.length;
    return buildLevel(theme, L, i === 0 ? main : null, taken, sponsors);
  });
}

/** El plano tal como lo camina alguien: si no es del equipo organizador, sus lugares quedan cerrados. */
export function forVisitor(map: SceneMap, who: Walker): SceneMap {
  const closed = map.restricted.filter((r) => !mayEnter(r, who));
  if (!closed.length) return map;
  const blocked = [...map.blocked];
  for (const r of closed) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) blocked[y * map.w + x] = true;
  return { ...map, blocked };
}

/** true si esa baldosa está reservada para otra gente. */
export const offLimits = (map: SceneMap, t: Tile, who: Walker) =>
  map.restricted.some((r) => !mayEnter(r, who) && t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h);

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
    for (let x = s.x; x < s.x + s.w; x++) {
      if (!onFace(x, s.y)) problems.push(`escalera fuera de una cara de muro en ${x},${s.y}`);
      if (!seen.has(`${x},${s.y}`)) problems.push(`escalera no alcanzable en ${x},${s.y}`);
    }
    if (tile(s.x, s.y - 2) !== "#") problems.push(`escalera sin muro arriba para su cartel`);
    const front = stairsFront(s);
    if (soft(front)) problems.push(`mueble delante de la escalera en ${front.x},${front.y}`);
    // Que no quede pegada a una sala, un stand o un adorno: al menos dos baldosas libres a cada lado.
    const near = (x0: number, x1: number) => x0 < s.x + s.w + 2 && x1 > s.x - 2;
    for (const d of map.doors) if (d.side === "top" && d.y === s.y && near(d.x, d.x + d.w)) problems.push(`escalera pegada a la puerta ${d.label}`);
    for (const d of map.decor) if (d.kind !== "entrance" && d.y === s.y && near(d.x - (d.kind === "portal" ? 1 : 0), d.x + (d.w ?? 1) + (d.kind === "portal" ? 1 : 0))) problems.push(`escalera pegada a ${d.kind} ${d.text ?? ""}`);
    for (const b of map.furni) if (b.kind === "booth" && b.y === s.y + 1 && near(b.x, b.x + 3)) problems.push(`escalera pegada a un stand en ${b.x}`);
  }
  if (map.exit && !seen.has(`${map.exit.x},${map.exit.y}`)) problems.push("salida no alcanzable");
  for (const d of map.directories) if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen.has(`${d.x + dx!},${d.y + dy!}`))) problems.push(`directorio ${d.x},${d.y} inaccesible`);
  const spans = [...map.doors.filter((d) => d.side === "top"), ...map.stairs];
  for (const d of map.decor) {
    if (d.kind === "entrance") continue;
    const x1 = d.x + (d.w ?? 1);
    if (d.kind === "portal" || d.kind === "roomdoor") {
      for (let x = d.x; x < x1; x++) if (tile(x, d.y) !== "." || tile(x, d.y + 1) !== ".") problems.push(`portal ${d.text} sin paso en ${x},${d.y}`);
      if (!onFace(d.x - 1, d.y) || !onFace(x1, d.y)) problems.push(`portal ${d.text} sin muro a los lados`);
      continue;
    }
    for (let x = d.x; x < x1; x++) if (!onFace(x, d.y)) problems.push(`adorno ${d.kind} en ${x},${d.y} fuera de una cara de muro`);
    if (spans.some((s) => s.y === d.y && d.x < s.x + s.w && x1 > s.x)) problems.push(`adorno ${d.kind} encima de una puerta en ${d.x},${d.y}`);
  }
  for (const f of map.furni) {
    for (let dx = 0; dx < (f.w ?? 1); dx++) for (let dy = 0; dy < (f.d ?? 1); dy++) if (tile(f.x + dx, f.y + dy) !== ".") problems.push(`mueble ${f.kind} sobre un muro en ${f.x + dx},${f.y + dy}`);
  }
  map.roofs.forEach((r, i) => {
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) if (tile(x, y) !== "#") problems.push(`techo ${r.label || i} sobre ${tile(x, y)} en ${x},${y}`);
    for (const o of map.roofs.slice(i + 1)) if (r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h) problems.push(`techos encimados ${r.label} y ${o.label}`);
  });
  for (const c of map.crowd) if (tile(c.x, c.y) !== ".") problems.push(`asistente fuera del piso en ${c.x},${c.y}`);
  // Cada mesa o rincón de charla tiene que poder alcanzarse (sin contar las zonas solo para organizadores, que el validador camina como visitante).
  for (const z of map.zones) {
    let reach = false;
    for (let y = z.y; y < z.y + z.h && !reach; y++) for (let x = z.x; x < z.x + z.w && !reach; x++) if (seen.has(`${x},${y}`)) reach = true;
    if (!reach) problems.push(`${z.label} no se puede alcanzar`);
  }
  const fronts = [...map.doors.map(inFront), ...map.stairs.map(stairsFront)];
  for (const b of map.furni.filter((f) => f.kind === "booth")) {
    for (let x = b.x; x < b.x + 3; x++) {
      if (!b.free && !onFace(x, b.y - 1)) problems.push(`stand sin pared detrás en ${x},${b.y}`);
      if (b.free && tile(x, b.y - 1) !== ".") problems.push(`stand suelto sin lugar para su panel en ${x},${b.y - 1}`);
      if (!seen.has(`${x},${b.y + 2}`)) problems.push(`no se llega al frente del stand en ${x},${b.y + 2}`);
      for (let y = b.y; y < b.y + 3; y++) if (fronts.some((f) => f.x === x && f.y === y)) problems.push(`stand delante de una puerta en ${x},${y}`);
    }
    for (const o of map.furni) if (o !== b && o.kind !== "booth" && o.x < b.x + 3 && b.x < o.x + (o.w ?? 1) && o.y < b.y + 3 && b.y < o.y + (o.d ?? 1)) problems.push(`${o.kind} encima del stand en ${b.x},${b.y}`);
  }
  for (const c of map.crowd) for (const b of map.furni.filter((f) => f.kind === "booth")) if (c.x >= b.x && c.x < b.x + 3 && c.y >= b.y && c.y < b.y + 3) problems.push(`asistente dentro del stand en ${c.x},${c.y}`);
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
  if (theme === "hackathon") decor.push({ kind: "neon", x: 1, y: 2, w: 2, text: "</>", color: "#ff7a1a" }, { kind: "neon", x: w - 3, y: 2, w: 2, text: "HACK", color: "#22d3ee" });
  if (theme === "stellar") decor.push({ kind: "neon", x: 1, y: 2, w: 2, text: "✦", color: "#fdda24" }, { kind: "neon", x: w - 3, y: 2, w: 2, text: "XLM", color: "#b7ace8" });
  return { furni, decor };
}

const STAGE_RUG: Record<ThemeId, string> = { tech: "#cfe3f7", minimal: "#e9e3d8", rustic: "#b5523b", medieval: "#7a2a3a", garden: "#e9dfc4", stellar: "#2a2a33", hackathon: "#2b3a3a" };

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

/** Teatro en abanico: cada fila es un poco más ancha que la anterior, como en una sala de conferencias. */
const theater = (theme: ThemeId, color: string) =>
  interior(theme, color, {
    w: 22,
    h: 17,
    aisle: 10,
    screen: { x: 7, w: 8 },
    sponsors: [
      { x: 2, w: 3 },
      { x: 17, w: 3 },
    ],
    stage: { x: 6, w: 10, d: 3 },
    podium: { x: 11, y: 4 },
    seats: [8, 10, 12, 14].flatMap((y, i) => rows([y], [...range(6 - i, 9), ...range(12, 15 + i)], "up")),
  });

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

const LAYOUTS = [classroom, theater, arena, wideHall];

/** Mapa interior de una sala: el auditorio, o una de cuatro distribuciones según su lugar en el evento. */
export function interiorFor(venueTheme: ThemeId, rooms: Pick<Room, "id" | "color" | "main" | "theme">[], roomId: string): SceneMap {
  const room = rooms.find((r) => r.id === roomId);
  const theme = room?.theme ?? venueTheme;
  if (!room || room.main) return auditoriumMap(theme, room?.color ?? "#5b5bf0");
  const index = rooms.filter((r) => !r.main).findIndex((r) => r.id === roomId);
  return LAYOUTS[Math.max(0, index) % LAYOUTS.length]!(theme, room.color);
}
