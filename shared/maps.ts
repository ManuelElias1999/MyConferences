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
export type StyleId = Exclude<ThemeId, "starmaker"> | "cowork";

/** Estilo visual de una temática: las oficinas Starmaker se ven como Stellar. */
export const styleFor = (theme: ThemeId): StyleId => (theme === "starmaker" ? "stellar" : theme);

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
  /** Cartel publicitario gigante: el logo de `label` o, sin él, los patrocinadores rotando. */
  | "adboard"
  /** Postes con cordón para ordenar la fila frente a la recepción (se puede pasar por encima). */
  | "stanchion"
  /** Gran mostrador de recepción, con su nombre al frente y una línea de luz. */
  | "frontdesk"
  /** Pantalla gigante con la cuenta regresiva del hackathon. */
  | "countdown"
  /** Pantalla grande detrás de una tarima: muestra lo que comparte quien presenta. */
  | "stagescreen"
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
  /** Pantalla holográfica que flota en el aire, sin patas. */
  floating?: boolean;
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
  /** En una sala (`room`), igual se puede compartir pantalla: por ejemplo, la sala de reunión. */
  share?: boolean;
  /** La sala donde se reúne todo el mundo; desde ahí el equipo organizador reparte en salas al azar. */
  gather?: boolean;
  /** Una de las salas chicas a las que se reparte la gente al azar. */
  breakout?: boolean;
  /** Tarima de la sala: solo quien está parado en ella puede compartir pantalla (y se ve en la pantalla grande). */
  stage?: Rect;
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

export const inZone = (t: Tile, z: Rect) => t.x >= z.x && t.x < z.x + z.w && t.y >= z.y && t.y < z.y + z.h;

/** Piso distinto para una zona del mapa: pasto en los patios, madera en las terrazas, etc. */
export type AreaFloor = "grass" | "wood" | "stone" | "tiles" | "deck" | "water" | "stage";

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
  /** La sala principal del evento cuando no tiene puerta propia: es la sala de reunión (zona `gather`) de este plano. */
  meetingRoom?: string;
  /** Techos de los edificios de sala, que llevan su nombre pintado. */
  roofs: Roof[];
  stairs: Stairs[];
  /** Zonas con otro piso (patios, terrazas). */
  areas: Area[];
  /** Caminos pintados en el suelo, del color de la sala a la que llevan. */
  trails: Trail[];
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

/** Camino de color en el suelo: baldosas unidas en línea recta entre cada punto. */
export interface Trail {
  points: Tile[];
  color: string;
  /** Ancho en baldosas (1 si no se indica). */
  w?: number;
  /** Alfombra frente a la puerta (si no, la última baldosa del camino). */
  mat?: Rect;
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

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Arma el terreno a partir de las zonas de piso: todo lo demás es muro, y las
 * dos filas de muro sobre cada piso se convierten en cara de muro.
 */
function carve(w: number, h: number, floors: Rect[], base?: string[], holes: Rect[] = []) {
  const grid = base ? base.map((row) => [...row]) : Array.from({ length: h }, () => Array.from({ length: w }, () => "#"));
  for (const r of floors) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y]![x] = ".";
  // Edificios sueltos dentro de un espacio abierto (por ejemplo, pabellones en un parque).
  for (const r of holes) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y]![x] = "#";
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
  // El agua (lagos, estanques) no se cruza.
  for (const a of map.areas) if (a.floor === "water") for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) blocked[y * map.w + x] = true;
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
  trails: [],
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
  const w = 36;
  const h = 22;
  const sit = (i: number, x: number, y: number, dir: Dir): Npc => ({ ...attendee(i, x, y, dir), id: `cowork-${i}`, name: "Coworker", sit: true });
  const stand = (i: number, x: number, y: number, dir: Dir): Npc => ({ ...attendee(i, x, y, dir), id: `cowork-${i}`, name: "Coworker" });
  // Desde cualquier baldosa de la tarima de madera (el rectángulo de la recepción) se puede hablar con la recepcionista.
  const platform = { x: 7, y: 3, w: 22, h: 11 };
  const front: Tile[] = [];
  for (let y = platform.y; y < platform.y + platform.h; y++) for (let x = platform.x; x < platform.x + platform.w; x++) front.push({ x, y });
  return finish(
    {
      ...empty,
      w,
      h,
      tiles: enclosure(w, h),
      style: "cowork",
      spawn: { x: 17, y: 17 },
      // La recepción va sobre una tarima de madera que ocupa todo el fondo, de columna a columna.
      areas: [{ ...platform, floor: "wood" }],
      furni: [
        // El gran mostrador, con dos recepcionistas detrás, columnas de luz y plantas a los lados.
        { kind: "frontdesk", x: 10, y: 6, w: 16 },
        { kind: "ledpillar", x: 7, y: 3 },
        { kind: "ledpillar", x: 28, y: 3 },
        { kind: "bigplant", x: 10, y: 3 },
        { kind: "bigplant", x: 25, y: 3 },
        { kind: "bigplant", x: 17, y: 3 },
        { kind: "kiosk", x: 8, y: 7 },
        { kind: "kiosk", x: 27, y: 7 },
        // Fila ordenada frente al mostrador.
        { kind: "stanchion", x: 12, y: 10, d: 3 },
        { kind: "stanchion", x: 16, y: 10, d: 3 },
        { kind: "stanchion", x: 19, y: 10, d: 3 },
        { kind: "stanchion", x: 23, y: 10, d: 3 },
        { kind: "ledpillar", x: 7, y: 12 },
        { kind: "ledpillar", x: 28, y: 12 },
        // Escritorios a la izquierda.
        { kind: "workdesk", x: 1, y: 4, w: 3 },
        { kind: "workdesk", x: 1, y: 8, w: 3 },
        ...[1, 2, 3].flatMap((x) => [5, 9].map((y) => ({ kind: "officechair" as const, x, y }))),
        // Sala de reuniones vidriada a la derecha.
        { kind: "partition", x: 30, y: 3, d: 6 },
        { kind: "partition", x: 30, y: 9, w: 2 },
        { kind: "partition", x: 33, y: 9, w: 2 },
        { kind: "table", x: 31, y: 5, w: 3 },
        ...[31, 32, 33].flatMap((x) => [
          { kind: "officechair" as const, x, y: 4 },
          { kind: "officechair" as const, x, y: 6 },
        ]),
        // Sala de estar abajo a la izquierda y café abajo a la derecha.
        { kind: "sofa", x: 1, y: 15, w: 3, color: "#2f6bff", dir: "down" },
        { kind: "armchair", x: 5, y: 15, color: "#ffb703" },
        { kind: "coffeetable", x: 2, y: 17, w: 2 },
        { kind: "coffeebar", x: 29, y: 15, w: 4 },
        { kind: "vending", x: 34, y: 15 },
        { kind: "cafetable", x: 30, y: 18, w: 2 },
        { kind: "bigplant", x: 1, y: 20 },
        { kind: "bigplant", x: 34, y: 20 },
      ],
      decor: [
        { kind: "window", x: 1, y: 2, w: 3 },
        { kind: "sponsors", x: 8, y: 2, w: 5 },
        { kind: "neon", x: 13, y: 2, w: 10, text: "RECEPCIÓN", color: "#22d3ee" },
        { kind: "sponsors", x: 23, y: 2, w: 5 },
        { kind: "whiteboard", x: 31, y: 2, w: 3 },
        { kind: "entrance", x: 17, y: h - 1, w: 2 },
      ],
      crowd: [
        sit(1, 1, 5, "up"),
        sit(2, 3, 5, "up"),
        sit(3, 2, 9, "up"),
        sit(4, 31, 4, "down"),
        sit(5, 33, 4, "down"),
        sit(6, 32, 6, "up"),
        sit(7, 1, 15, "down"),
        sit(8, 3, 15, "down"),
        stand(9, 29, 17, "right"),
        stand(10, 30, 17, "left"),
      ],
      npcs: [
        { id: RECEPTIONIST_ID, name: "Recepcionista", look: RECEPTIONIST_LOOK, x: 14, y: 5, dir: "down", talkFrom: front },
        {
          id: `${RECEPTIONIST_ID}-2`,
          name: "Recepcionista",
          look: { ...RECEPTIONIST_LOOK, hair: "short", hairColor: HAIR_COLORS[3]!, skin: SKINS[4]!, shirt: "#2f6bff" },
          x: 21,
          y: 5,
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

const SOFA: Record<ThemeId, string> = { tech: "#2f6bff", minimal: "#9aa5b1", rustic: "#a0522d", medieval: "#7a2a3a", garden: "#5a8f3e", stellar: "#2a2a33", hackathon: "#ff7a1a", starmaker: "#2a2a33" };

/** Objetos de ambiente de cada estilo (también se usan en las salas). */
const ACCENTS: Record<ThemeId, FurniKind[]> = {
  tech: ["ledpillar", "robot", "rack", "ledpillar"],
  minimal: ["bigplant", "lamp", "sculpture", "bigplant"],
  rustic: ["barrel", "lantern", "bookshelf", "plant"],
  medieval: ["armor", "candelabra", "pillar", "armor"],
  garden: ["tree", "lantern", "tree", "flowerbed"],
  stellar: ["constellation", "rocket", "bigplant", "constellation"],
  starmaker: ["constellation", "rocket", "bigplant", "constellation"],
  hackathon: ["rack", "ledpillar", "bigplant", "robot"],
};

/** Salas por piso. Todo evento tiene al menos ocho más el auditorio; las siguientes van al piso de arriba. */
export const ROOMS_PER_FLOOR = 8;
export const MIN_ROOMS = ROOMS_PER_FLOOR + 1;
export const MAX_ROOMS = ROOMS_PER_FLOOR * 2 + 1;
/** Un hackathon tiene el auditorio y 8 salas de charla: cuatro por piso, separadas entre sí. */
export const HACKATHON_ROOMS = 9;
/** Máximo de salas (con el auditorio) según la temática. */
/** Las oficinas Starmaker tienen una sola sala principal: la sala de reunión. */
export const STARMAKER_ROOMS = 1;
export const maxRoomsFor = (theme: ThemeId) => (theme === "hackathon" ? HACKATHON_ROOMS : theme === "starmaker" ? STARMAKER_ROOMS : MAX_ROOMS);
/** Mínimo de salas (con el auditorio) según la temática. */
export const minRoomsFor = (theme: ThemeId) => (theme === "starmaker" ? 1 : MIN_ROOMS);

/** Edificio de una sala: la puerta en el muro y el techo donde va su nombre. */
interface Slot {
  door: Tile & { side: Side };
  roof: Rect;
  zone: string;
  /** Camino pintado desde la entrada del piso hasta la puerta, del color de la sala. */
  trail?: Tile[];
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
  /** La puerta va en la pared de arriba, salvo que `side` diga que va en un muro lateral. */
  main?: Tile & { roof: Rect; trail?: Tile[]; side?: "left" | "right" };
  /** Bloques de muro dentro de los pisos: edificios sueltos, como los pabellones de un parque. */
  holes?: Rect[];
  /** Asientos del salón: quien se para en uno se sienta (por ejemplo, las filas frente a una tarima). */
  seats?: Seat[];
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

// ----- Tecnológica: un campus de innovación en L, con parque y lago, demo hall, cafetería y game zone -----

/** Camino de color: una lista de puntos [x, y] unidos en línea recta. */
const path = (...pts: [number, number][]): Tile[] => pts.map(([x, y]) => ({ x, y }));

/*
 * Se entra abajo a la izquierda y se sube por el bulevar; arriba, la calle
 * principal cruza todo el campus hasta el auditorio, al fondo a la derecha.
 * Dentro de la L: el parque central con su lago, el demo hall (stands y
 * estaciones de prueba), la cafetería y la game zone, todos conectados entre
 * sí y con varias entradas. Las salas van de a dos: sobre la calle principal
 * (dos parejas), en la pared del bulevar y al final de la calle.
 */
function techGround(): Level {
  const park = { x: 23, y: 25, w: 28, h: 20 };
  const demo = { x: 55, y: 25, w: 29, h: 20 };
  const cafe = { x: 23, y: 48, w: 28, h: 11 };
  const games = { x: 55, y: 48, w: 29, h: 11 };
  const [p1a, p1b] = pairH(21, 11, "Calle principal (oeste)");
  const [p2a, p2b] = pairV(7, 24, "left", "Bulevar");
  const [p3a, p3b] = pairH(42, 11, "Calle principal (centro)");
  const [p4a, p4b] = pairV(84, 13, "right", "Fondo de la calle");
  return {
    name: "Planta baja",
    w: 90,
    h: 62,
    floors: [
      { x: 8, y: 12, w: 12, h: 47 }, // bulevar
      { x: 8, y: 12, w: 76, h: 10 }, // calle principal
      park,
      { x: 20, y: 28, w: 3, h: 13 }, // el parque, abierto al bulevar
      { x: 34, y: 22, w: 4, h: 3 },
      demo,
      { x: 58, y: 22, w: 4, h: 3 },
      { x: 76, y: 22, w: 4, h: 3 },
      { x: 51, y: 33, w: 4, h: 4 },
      cafe,
      { x: 20, y: 50, w: 3, h: 4 },
      { x: 30, y: 45, w: 4, h: 3 },
      games,
      { x: 66, y: 45, w: 4, h: 3 },
      { x: 51, y: 51, w: 4, h: 4 },
    ],
    areas: [
      { ...park, floor: "grass" },
      { x: 31, y: 31, w: 11, h: 7, floor: "water" },
      { ...demo, floor: "tiles" },
      { ...cafe, floor: "wood" },
    ],
    exit: { x: 13, y: 59 },
    spawn: { x: 13, y: 56 },
    main: { x: 69, y: 11, roof: { x: 63, y: 3, w: 16, h: 7 }, trail: path([13, 57], [13, 15], [70, 15], [70, 12]) },
    slots: [
      { ...p1a!, trail: path([9, 57], [9, 13], [22, 13], [22, 12]) },
      { ...p4a!, trail: path([17, 57], [17, 19], [81, 19], [81, 14], [83, 14]) },
      { ...p3a!, trail: path([15, 57], [15, 17], [43, 17], [43, 12]) },
      { ...p2a!, trail: path([11, 57], [11, 25], [8, 25]) },
      { ...p1b!, trail: path([10, 57], [10, 14], [27, 14], [27, 12]) },
      { ...p4b!, trail: path([18, 57], [18, 20], [83, 20]) },
      { ...p3b!, trail: path([16, 57], [16, 18], [48, 18], [48, 12]) },
      { ...p2b!, trail: path([12, 57], [12, 30], [8, 30]) },
    ],
    // Primero los del demo hall; después la calle principal y la cafetería.
    stands: [
      { x: 63, y: 25 },
      { x: 68, y: 25 },
      { x: 72, y: 25 },
      { x: 55, y: 25 },
      { x: 33, y: 12 },
      { x: 53, y: 12 },
      { x: 40, y: 48 },
    ],
    stairs: [{ x: 58, y: 11, w: 2, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "portal", x: 34, y: 24, w: 4, text: "PARQUE CENTRAL" },
      { kind: "portal", x: 58, y: 24, w: 4, text: "DEMO HALL" },
      { kind: "portal", x: 76, y: 24, w: 4, text: "DEMO HALL" },
      { kind: "portal", x: 30, y: 47, w: 4, text: "CAFETERÍA" },
      { kind: "portal", x: 66, y: 47, w: 4, text: "GAME ZONE" },
      { kind: "codewall", x: 37, y: 11, w: 4 },
      { kind: "neon", x: 63, y: 11, w: 3, text: "</>", color: "#f472b6" },
      { kind: "sponsors", x: 75, y: 11, w: 5 },
      { kind: "window", x: 9, y: 11, w: 3 },
      { kind: "sponsors", x: 80, y: 24, w: 3 },
      { kind: "window", x: 44, y: 47, w: 4 },
      { kind: "neon", x: 56, y: 47, w: 4, text: "GAME ZONE", color: "#a78bfa" },
      { kind: "codewall", x: 71, y: 47, w: 4 },
    ],
    furni: [
      // Bulevar: la pantalla del evento flotando, columnas de luz, un robot y carteles.
      { kind: "eventscreen", x: 11, y: 45, w: 6, floating: true },
      ...[34, 41, 48].flatMap((y): Furni[] => [
        { kind: "ledpillar", x: 8, y },
        { kind: "ledpillar", x: 19, y },
      ]),
      { kind: "robot", x: 16, y: 38 },
      { kind: "signpost", x: 17, y: 52, label: "↑ Salas · Auditorio →|→ Parque · Demo hall|→ Cafetería · Game zone" },
      { kind: "bigplant", x: 8, y: 58 },
      { kind: "bigplant", x: 19, y: 58 },
      // Calle principal: tótems, drones y una pantalla de patrocinadores.
      ...[30, 40, 56, 64, 77].map((x): Furni => ({ kind: "totem", x, y: 21 })),
      { kind: "drone", x: 36, y: 17 },
      { kind: "drone", x: 66, y: 18 },
      { kind: "hologram", x: 60, y: 15, w: 2, d: 2 },
      { kind: "robot", x: 75, y: 17 },
      { kind: "adboard", x: 24, y: 19, w: 3 },
      // Parque central: el lago con árboles, bancos y flores alrededor.
      ...[
        [24, 26],
        [49, 26],
        [24, 43],
        [49, 43],
        [27, 34],
        [46, 30],
        [44, 41],
      ].map(([x, y]): Furni => ({ kind: "tree", x: x!, y: y! })),
      { kind: "bench", x: 33, y: 40, w: 3 },
      { kind: "bench", x: 39, y: 28, w: 3 },
      { kind: "flowerbed", x: 28, y: 28, w: 3 },
      { kind: "flowerbed", x: 43, y: 38, w: 2 },
      { kind: "lamp", x: 30, y: 30 },
      { kind: "lamp", x: 43, y: 34 },
      // Demo hall: estaciones para probar productos.
      ...[58, 64, 70].flatMap((x): Furni[] => [
        { kind: "workdesk", x, y: 33, w: 3 },
        ...[0, 1, 2].map((dx): Furni => ({ kind: "officechair", x: x + dx, y: 34 })),
      ]),
      { kind: "vrpod", x: 77, y: 32, w: 2 },
      { kind: "printer3d", x: 80, y: 37 },
      { kind: "hologram", x: 60, y: 39, w: 2, d: 2 },
      { kind: "robot", x: 72, y: 40 },
      { kind: "drone", x: 66, y: 30 },
      { kind: "charger", x: 83, y: 43 },
      { kind: "kiosk", x: 56, y: 43 },
      // Cafetería.
      { kind: "coffeebar", x: 24, y: 48, w: 4 },
      { kind: "cooler", x: 29, y: 48 },
      { kind: "vending", x: 46, y: 48 },
      ...[25, 31, 37, 43].map((x, i): Furni => ({ kind: "cafetable", x, y: 52 + (i % 2) * 2, w: 2 })),
      ...lounge(40, 55, "#2f6bff"),
      { kind: "bigplant", x: 23, y: 58 },
      { kind: "bigplant", x: 50, y: 58 },
      // Game zone.
      ...[75, 76, 77, 80, 81, 82].map((x): Furni => ({ kind: "arcade", x, y: 48 })),
      { kind: "pingpong", x: 58, y: 51, w: 3 },
      { kind: "pingpong", x: 58, y: 55, w: 3 },
      { kind: "foosball", x: 65, y: 53, w: 2 },
      { kind: "chess", x: 71, y: 54, w: 2 },
      ...[76, 78, 80].map((x, i): Furni => ({ kind: "beanbag", x, y: 56, color: ["#22d3ee", "#f472b6", "#fbbf24"][i] })),
    ],
    crowd: [
      ...chat(14, 40),
      ...chat(30, 18),
      ...chat(50, 16),
      ...chat(72, 19),
      ...chat(36, 43),
      ...chat(25, 38),
      ...chat(62, 37),
      ...chat(75, 36),
      ...chat(33, 55),
      ...chat(69, 51),
    ],
    directories: [
      { x: 9, y: 53 },
      { x: 18, y: 47 },
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

const UPPER: Record<Exclude<ThemeId, "starmaker">, UpperTheme> = {
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
function upperFloor(theme: Exclude<ThemeId, "starmaker">): Level {
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

// ----- Medieval: un castillo con camino de ronda, patio de armas, gran salón, torres, mercado, huerto y taberna -----

/*
 * Se entra por la puerta de la muralla, abajo. Un camino de ronda rodea todo
 * el castillo y encierra el patio de armas, al que se entra por los cuatro
 * lados. Arriba, el gran salón (el auditorio) y el mercado con sus puestos
 * contra la muralla; a la izquierda, el huerto de hierbas; a la derecha, la
 * taberna. Las salas son torres: dos en la muralla oeste, dos en la este (más
 * abajo), dos sobre la ronda norte y dos frente al patio, en la ronda sur.
 */
function castleGround(): Level {
  const court = { x: 22, y: 28, w: 42, h: 12 };
  const [p1a, p1b] = pairV(5, 24, "left", "Torre oeste");
  const [p2a, p2b] = pairV(80, 36, "right", "Torre este");
  const [p3a, p3b] = pairH(10, 13, "Ronda norte");
  const [p4a, p4b] = pairH(26, 47, "Ronda sur");
  return {
    name: "Planta baja",
    w: 86,
    h: 62,
    floors: [
      { x: 6, y: 14, w: 74, h: 8 }, // ronda norte
      { x: 6, y: 14, w: 10, h: 42 }, // ronda oeste
      { x: 70, y: 14, w: 10, h: 42 }, // ronda este
      { x: 6, y: 48, w: 74, h: 8 }, // ronda sur
      { x: 38, y: 56, w: 10, h: 4 }, // puerta de la muralla
      court,
      { x: 40, y: 22, w: 4, h: 6 },
      { x: 40, y: 40, w: 4, h: 8 },
      { x: 16, y: 33, w: 6, h: 4 },
      { x: 64, y: 33, w: 6, h: 4 },
    ],
    areas: [
      { ...court, floor: "stone" },
      { x: 38, y: 56, w: 10, h: 4, floor: "stone" },
      { x: 6, y: 37, w: 10, h: 11, floor: "grass" },
      { x: 70, y: 44, w: 10, h: 12, floor: "wood" },
    ],
    exit: { x: 42, y: 60 },
    spawn: { x: 42, y: 57 },
    main: { x: 41, y: 13, roof: { x: 35, y: 5, w: 16, h: 7 }, trail: path([42, 58], [42, 14]) },
    slots: [
      { ...p1a!, trail: path([39, 58], [39, 52], [10, 52], [10, 25], [6, 25]) },
      { ...p2a!, trail: path([47, 58], [47, 53], [76, 53], [76, 37], [79, 37]) },
      { ...p3a!, trail: path([40, 58], [40, 51], [11, 51], [11, 14]) },
      { ...p4a!, trail: path([44, 58], [44, 49], [27, 49], [27, 48]) },
      { ...p1b!, trail: path([38, 58], [38, 53], [9, 53], [9, 30], [6, 30]) },
      { ...p2b!, trail: path([46, 58], [46, 52], [75, 52], [75, 42], [79, 42]) },
      { ...p3b!, trail: path([41, 58], [41, 50], [14, 50], [14, 16], [16, 16], [16, 14]) },
      { ...p4b!, trail: path([45, 58], [45, 50], [32, 50], [32, 48]) },
    ],
    // El mercado, contra la muralla norte.
    stands: [
      { x: 22, y: 14 },
      { x: 28, y: 14 },
      { x: 50, y: 14 },
      { x: 56, y: 14 },
      { x: 34, y: 14 },
    ],
    stairs: [{ x: 63, y: 13, w: 2, dir: "up", to: 1, label: "Subir a la muralla" }],
    decor: [
      { kind: "banner", x: 46, y: 13, w: 2, color: "#7a2a3a" },
      { kind: "torch", x: 26, y: 13 },
      { kind: "torch", x: 54, y: 13 },
      { kind: "torch", x: 68, y: 13 },
      { kind: "portal", x: 40, y: 27, w: 4, text: "PATIO DE ARMAS" },
      { kind: "portal", x: 40, y: 47, w: 4, text: "PATIO DE ARMAS" },
      { kind: "banner", x: 28, y: 27, w: 2, color: "#7a2a3a" },
      { kind: "banner", x: 55, y: 27, w: 2, color: "#2a4a7a" },
      { kind: "torch", x: 35, y: 27 },
      { kind: "torch", x: 48, y: 27 },
      { kind: "banner", x: 52, y: 47, w: 2, color: "#2a4a7a" },
      { kind: "torch", x: 22, y: 47 },
      { kind: "torch", x: 60, y: 47 },
      { kind: "sponsors", x: 64, y: 47, w: 4 },
    ],
    furni: [
      // Puerta de la muralla: la pantalla del evento y faroles.
      { kind: "eventscreen", x: 40, y: 54, w: 6, floating: true },
      { kind: "lantern", x: 38, y: 59 },
      { kind: "lantern", x: 47, y: 59 },
      { kind: "signpost", x: 47, y: 56, label: "↑ Patio de armas · Gran salón|← Huerto · Torres oeste|Taberna · Torres este →" },
      // Ronda: candelabros, barriles y armaduras.
      ...[20, 46, 66].map((x): Furni => ({ kind: "candelabra", x, y: 20 })),
      { kind: "armor", x: 6, y: 21 },
      { kind: "armor", x: 79, y: 21 },
      ...[18, 30, 56, 64].map((x): Furni => ({ kind: "barrel", x, y: 55 })),
      { kind: "candelabra", x: 15, y: 33 },
      { kind: "candelabra", x: 70, y: 31 },
      // Patio de armas: muñecos de práctica, pozos y mesas de estrategia.
      ...[23, 25, 61, 63].map((x): Furni => ({ kind: "armor", x, y: 29 })),
      { kind: "fountain", x: 31, y: 32, w: 2, d: 2 },
      { kind: "fountain", x: 53, y: 34, w: 2, d: 2 },
      { kind: "chess", x: 35, y: 37, w: 2 },
      { kind: "chess", x: 48, y: 31, w: 2 },
      ...[27, 58].map((x): Furni => ({ kind: "pillar", x, y: 38 })),
      // Huerto de hierbas.
      { kind: "flowerbed", x: 7, y: 39, w: 3 },
      { kind: "flowerbed", x: 11, y: 42, w: 3 },
      { kind: "tree", x: 6, y: 46 },
      { kind: "tree", x: 15, y: 39 },
      { kind: "bench", x: 8, y: 45, w: 3 },
      // Taberna.
      { kind: "counter", x: 70, y: 44, w: 3 },
      ...[71, 75].flatMap((x): Furni[] => [
        { kind: "table", x, y: 48, w: 2 },
        { kind: "table", x: x + 1, y: 52, w: 2 },
      ]),
      ...[78, 79].map((x): Furni => ({ kind: "barrel", x, y: 44 })),
    ],
    crowd: [...chat(30, 18), ...chat(60, 17), ...chat(36, 33), ...chat(46, 36), ...chat(10, 32), ...chat(74, 25), ...chat(20, 52), ...chat(72, 50), ...chat(55, 51)],
    directories: [
      { x: 38, y: 55 },
      { x: 47, y: 52 },
    ],
  };
}

// ----- Jardín: un jardín botánico al aire libre, con lago, pabellones sueltos, invernadero, pícnic y laberinto de flores -----

/*
 * Casi todo es parque abierto. Se entra abajo a la derecha y un sendero de
 * piedra sube hasta el gran pabellón (el auditorio), arriba a la izquierda.
 * Las salas están en cuatro pabellones sueltos repartidos por el parque, cada
 * uno con dos salas; en el medio, un lago. A la derecha, el invernadero con
 * los stands; además, un prado de pícnic, un laberinto de flores y un café
 * junto a la entrada.
 */
function parkGround(): Level {
  const greenhouse = { x: 74, y: 22, w: 14, h: 20 };
  const [p1a, p1b] = pairH(30, 24, "Pabellón del lago");
  const [p2a, p2b] = pairH(50, 18, "Pabellón norte");
  const [p3a, p3b] = pairH(8, 40, "Pabellón oeste");
  const [p4a, p4b] = pairH(46, 50, "Pabellón del prado");
  return {
    name: "Planta baja",
    w: 90,
    h: 58,
    floors: [{ x: 2, y: 10, w: 86, h: 46 }],
    // Los pabellones: bloques sueltos dentro del parque, con dos salas cada uno.
    holes: [
      { x: 30, y: 18, w: 9, h: 7 },
      { x: 50, y: 12, w: 9, h: 7 },
      { x: 8, y: 34, w: 9, h: 7 },
      { x: 46, y: 44, w: 9, h: 7 },
    ],
    areas: [
      { x: 2, y: 10, w: 86, h: 46, floor: "grass" },
      { x: 61, y: 11, w: 10, h: 45, floor: "stone" },
      { x: 10, y: 10, w: 57, h: 3, floor: "stone" },
      { x: 21, y: 29, w: 20, h: 10, floor: "water" },
      { ...greenhouse, floor: "tiles" },
      { x: 44, y: 28, w: 16, h: 10, floor: "deck" },
    ],
    exit: { x: 66, y: 56 },
    spawn: { x: 66, y: 53 },
    main: { x: 16, y: 9, roof: { x: 10, y: 1, w: 16, h: 7 }, trail: path([66, 54], [66, 11], [17, 11], [17, 10]) },
    slots: [
      { ...p1a!, trail: path([63, 54], [63, 26], [31, 26], [31, 25]) },
      { ...p2a!, trail: path([68, 54], [68, 20], [51, 20], [51, 19]) },
      { ...p3a!, trail: path([62, 54], [62, 42], [9, 42], [9, 41]) },
      { ...p4a!, trail: path([65, 54], [65, 52], [52, 52], [52, 51]) },
      { ...p1b!, trail: path([64, 54], [64, 27], [36, 27], [36, 25]) },
      { ...p2b!, trail: path([69, 54], [69, 21], [56, 21], [56, 19]) },
      { ...p3b!, trail: path([61, 54], [61, 43], [14, 43], [14, 41]) },
      { ...p4b!, trail: path([70, 54], [70, 53], [47, 53], [47, 51]) },
    ],
    // Los stands, sueltos dentro del invernadero.
    stands: [
      { x: 76, y: 24, free: true },
      { x: 82, y: 24, free: true },
      { x: 76, y: 30, free: true },
      { x: 82, y: 30, free: true },
      { x: 76, y: 36, free: true },
      { x: 82, y: 36, free: true },
    ],
    stairs: [{ x: 40, y: 9, w: 2, dir: "up", to: 1, label: "Subir al mirador" }],
    decor: [
      { kind: "ivy", x: 4, y: 9, w: 3 },
      { kind: "ivy", x: 30, y: 9, w: 4 },
      { kind: "ivy", x: 50, y: 9, w: 4 },
      { kind: "sponsors", x: 76, y: 9, w: 5 },
      { kind: "ivy", x: 84, y: 9, w: 3 },
    ],
    furni: [
      // Entrada: la pantalla del evento, faroles a lo largo del sendero y carteles.
      { kind: "eventscreen", x: 63, y: 47, w: 6, floating: true },
      ...[16, 24, 32, 40].flatMap((y): Furni[] => [
        { kind: "lantern", x: 60, y },
        { kind: "lantern", x: 71, y },
      ]),
      { kind: "signpost", x: 71, y: 50, label: "↑ Gran pabellón · Pabellones|→ Invernadero · Café|← Lago · Pícnic · Flores" },
      // Bordes del parque: árboles.
      ...[3, 8, 28, 45, 74, 86].map((x): Furni => ({ kind: "tree", x, y: 10 })),
      ...[14, 22, 30].map((y): Furni => ({ kind: "tree", x: 2, y })),
      ...[3, 22, 40, 86].map((x): Furni => ({ kind: "tree", x, y: 55 })),
      { kind: "tree", x: 87, y: 45 },
      // Alrededor del lago.
      { kind: "bench", x: 24, y: 40, w: 3 },
      { kind: "bench", x: 34, y: 40, w: 3 },
      { kind: "bench", x: 42, y: 32, w: 1 },
      { kind: "tree", x: 20, y: 27 },
      { kind: "tree", x: 41, y: 39 },
      { kind: "flowerbed", x: 22, y: 27, w: 3 },
      { kind: "lantern", x: 30, y: 39 },
      // Prado de pícnic.
      ...[45, 50, 55].map((x, i): Furni => ({ kind: "parasol", x, y: 30 + (i % 2) * 3, w: 2, color: ["#ff5c39", "#22d3ee", "#fbbf24"][i] })),
      { kind: "table", x: 46, y: 35, w: 2 },
      { kind: "table", x: 55, y: 36, w: 2 },
      ...[48, 52, 58].map((x, i): Furni => ({ kind: "beanbag", x, y: 37, color: ["#ffb703", "#ef476f", "#06c38d"][i] })),
      // Invernadero: paredes de vidrio, plantas grandes y una entrada.
      { kind: "partition", x: 73, y: 22, d: 8 },
      { kind: "partition", x: 73, y: 34, d: 8 },
      ...[23, 29, 35, 41].map((y): Furni => ({ kind: "bigplant", x: 87, y })),
      { kind: "bigplant", x: 80, y: 41 },
      // Laberinto de flores.
      ...[45, 49, 53].flatMap((y, i): Furni[] => [
        { kind: "flowerbed", x: 4 + (i % 2) * 3, y, w: 6 },
        { kind: "flowerbed", x: 13 + (i % 2) * 2, y, w: 5 },
      ]),
      { kind: "fountain", x: 21, y: 48, w: 2, d: 2 },
      { kind: "bench", x: 26, y: 50, w: 3 },
      // Café junto a la entrada.
      { kind: "kiosk", x: 74, y: 46 },
      { kind: "coffeebar", x: 78, y: 45, w: 3 },
      { kind: "parasol", x: 75, y: 50, w: 2, color: "#5a8f3e" },
      { kind: "parasol", x: 81, y: 51, w: 2, color: "#ff5c39" },
      { kind: "cafetable", x: 84, y: 48, w: 2 },
      // Cerca de los pabellones.
      { kind: "flowerbed", x: 51, y: 22, w: 3 },
      { kind: "tree", x: 45, y: 16 },
      { kind: "chess", x: 28, y: 13, w: 2 },
    ],
    crowd: [...chat(26, 43), ...chat(47, 32), ...chat(78, 27), ...chat(80, 34), ...chat(12, 30), ...chat(36, 15), ...chat(18, 52), ...chat(77, 48), ...chat(55, 25)],
    directories: [
      { x: 61, y: 51 },
      { x: 70, y: 46 },
    ],
  };
}

// ----- Minimalista: una galería de arte con una gran nave, patio de esculturas, biblioteca y foyer -----

/*
 * Se entra por el foyer, abajo a la derecha, y se llega a la nave: una
 * galería larga y blanca que cruza todo el edificio hasta el auditorio, arriba
 * a la izquierda. Debajo de la nave, el patio de esculturas y la biblioteca,
 * conectados entre sí. Poco mobiliario y mucho aire: obras en las paredes,
 * esculturas y bancos. Las salas son cubos de color: dos parejas sobre la
 * nave, una al fondo de la nave y otra en el foyer.
 */
function galleryGround(): Level {
  const patio = { x: 6, y: 35, w: 25, h: 16 };
  const library = { x: 35, y: 35, w: 19, h: 15 };
  const foyer = { x: 58, y: 32, w: 20, h: 18 };
  const [p1a, p1b] = pairH(36, 21, "Nave (centro)");
  const [p2a, p2b] = pairH(55, 21, "Nave (este)");
  const [p3a, p3b] = pairV(78, 38, "right", "Foyer");
  const [p4a, p4b] = pairV(5, 22, "left", "Fondo de la nave");
  return {
    name: "Planta baja",
    w: 84,
    h: 53,
    floors: [
      { x: 6, y: 22, w: 72, h: 10 }, // nave
      foyer,
      patio,
      { x: 10, y: 32, w: 4, h: 3 },
      { x: 23, y: 32, w: 4, h: 3 },
      library,
      { x: 42, y: 32, w: 4, h: 3 },
      { x: 54, y: 40, w: 4, h: 4 },
      { x: 31, y: 42, w: 4, h: 4 },
    ],
    areas: [
      { ...patio, floor: "stone" },
      { ...library, floor: "wood" },
    ],
    exit: { x: 67, y: 50 },
    spawn: { x: 67, y: 47 },
    main: { x: 14, y: 21, roof: { x: 8, y: 13, w: 16, h: 7 }, trail: path([66, 48], [66, 24], [15, 24], [15, 22]) },
    slots: [
      { ...p1a!, trail: path([69, 48], [69, 26], [37, 26], [37, 22]) },
      { ...p3a!, trail: path([73, 48], [73, 39], [77, 39]) },
      { ...p2a!, trail: path([60, 48], [60, 28], [56, 28], [56, 22]) },
      { ...p4a!, trail: path([71, 48], [71, 31], [8, 31], [8, 23], [6, 23]) },
      { ...p1b!, trail: path([70, 48], [70, 27], [42, 27], [42, 22]) },
      { ...p3b!, trail: path([75, 48], [75, 44], [77, 44]) },
      { ...p2b!, trail: path([62, 48], [62, 22]) },
      { ...p4b!, trail: path([64, 48], [64, 29], [6, 29]) },
    ],
    stands: [
      { x: 46, y: 22 },
      { x: 66, y: 22 },
      { x: 20, y: 22 },
      { x: 71, y: 22 },
      { x: 25, y: 22 },
    ],
    stairs: [{ x: 30, y: 21, w: 2, dir: "up", to: 1, label: "Subir al piso 1" }],
    decor: [
      { kind: "art", x: 8, y: 21, w: 2, color: "#e9b8a4" },
      { kind: "art", x: 34, y: 21, w: 2, color: "#a4c3e9" },
      { kind: "art", x: 50, y: 21, w: 3, color: "#c9e4a4" },
      { kind: "art", x: 75, y: 21, w: 2, color: "#f1d48a" },
      { kind: "portal", x: 10, y: 34, w: 4, text: "PATIO DE ESCULTURAS" },
      { kind: "portal", x: 23, y: 34, w: 4, text: "PATIO DE ESCULTURAS" },
      { kind: "portal", x: 42, y: 34, w: 4, text: "BIBLIOTECA" },
      { kind: "art", x: 16, y: 34, w: 3, color: "#d8c7f0" },
      { kind: "window", x: 36, y: 34, w: 3 },
      { kind: "art", x: 48, y: 34, w: 3, color: "#e9b8a4" },
    ],
    furni: [
      // Nave: pocas piezas y mucho aire.
      { kind: "sculpture", x: 12, y: 29 },
      { kind: "sculpture", x: 29, y: 27 },
      { kind: "sculpture", x: 50, y: 29 },
      { kind: "bench", x: 19, y: 28, w: 3 },
      { kind: "bench", x: 44, y: 29, w: 3 },
      { kind: "bigplant", x: 6, y: 31 },
      { kind: "lamp", x: 34, y: 25 },
      { kind: "lamp", x: 53, y: 25 },
      // Foyer: la pantalla del evento, un café chico y carteles.
      { kind: "eventscreen", x: 65, y: 40, w: 6, floating: true },
      { kind: "coffeebar", x: 58, y: 34, w: 3 },
      { kind: "cafetable", x: 59, y: 38, w: 2 },
      { kind: "cafetable", x: 58, y: 42, w: 2 },
      { kind: "sculpture", x: 76, y: 34 },
      { kind: "bigplant", x: 58, y: 49 },
      { kind: "bigplant", x: 77, y: 49 },
      { kind: "signpost", x: 72, y: 46, label: "↑ Nave · Auditorio ←|← Biblioteca · Patio" },
      // Patio de esculturas.
      { kind: "fountain", x: 17, y: 41, w: 2, d: 2 },
      ...[
        [9, 38],
        [26, 38],
        [10, 47],
        [24, 46],
      ].map(([x, y]): Furni => ({ kind: "sculpture", x: x!, y: y! })),
      { kind: "tree", x: 6, y: 35 },
      { kind: "tree", x: 30, y: 50 },
      { kind: "tree", x: 6, y: 50 },
      { kind: "bench", x: 14, y: 45, w: 3 },
      { kind: "bench", x: 20, y: 37, w: 3 },
      { kind: "flowerbed", x: 27, y: 42, w: 3 },
      // Biblioteca: estantes, sillones y lámparas.
      ...[36, 38, 40, 47, 49, 51].map((x): Furni => ({ kind: "bookshelf", x, y: 35 })),
      ...lounge(37, 40, "#9aa5b1"),
      ...lounge(45, 44, "#9aa5b1"),
      { kind: "chess", x: 38, y: 46, w: 2 },
      { kind: "lamp", x: 44, y: 39 },
      { kind: "lamp", x: 52, y: 48 },
      { kind: "bigplant", x: 53, y: 35 },
    ],
    crowd: [...chat(22, 26), ...chat(46, 26), ...chat(72, 36), ...chat(12, 42), ...chat(20, 49), ...chat(41, 43), ...chat(63, 30)],
    directories: [
      { x: 60, y: 46 },
      { x: 76, y: 42 },
    ],
  };
}

// ----- Rústica: un pueblo con calle mayor, plaza, calle del mercado, huerta, taberna y granero -----

/*
 * Se entra por la calle mayor, que sube hasta la plaza del pueblo, corrida
 * hacia el oeste; en su lado norte está el salón del pueblo (el auditorio).
 * Desde la plaza sale hacia el este la calle del mercado, con los puestos
 * (stands) contra la pared, y de ella se sube a la huerta. Abajo, a cada lado
 * de la calle mayor, la taberna y el granero, con más de una entrada. Las
 * salas van de a dos: en la pared oeste de la plaza, al lado del salón, sobre
 * la calle del mercado y al final de ella.
 */
function villageGround(): Level {
  const plaza = { x: 14, y: 22, w: 34, h: 18 };
  const huerta = { x: 60, y: 8, w: 23, h: 15 };
  const taberna = { x: 6, y: 44, w: 25, h: 13 };
  const granero = { x: 52, y: 42, w: 29, h: 14 };
  const [p1a, p1b] = pairV(13, 24, "left", "Plaza (oeste)");
  const [p2a, p2b] = pairH(39, 21, "Junto al salón del pueblo");
  const [p3a, p3b] = pairH(49, 27, "Calle del mercado");
  const [p4a, p4b] = pairV(81, 28, "right", "Final del mercado");
  return {
    name: "Planta baja",
    w: 88,
    h: 59,
    floors: [
      { x: 38, y: 40, w: 10, h: 16 }, // calle mayor
      plaza,
      { x: 48, y: 28, w: 33, h: 8 }, // calle del mercado
      huerta,
      { x: 68, y: 23, w: 4, h: 5 },
      taberna,
      { x: 18, y: 40, w: 4, h: 4 },
      { x: 31, y: 48, w: 7, h: 4 },
      granero,
      { x: 62, y: 36, w: 4, h: 6 },
      { x: 48, y: 47, w: 4, h: 4 },
    ],
    areas: [
      { ...plaza, floor: "stone" },
      { x: 38, y: 40, w: 10, h: 16, floor: "stone" },
      { ...huerta, floor: "grass" },
      { ...taberna, floor: "wood" },
      { ...granero, floor: "deck" },
    ],
    exit: { x: 42, y: 56 },
    spawn: { x: 42, y: 53 },
    main: { x: 28, y: 21, roof: { x: 22, y: 13, w: 16, h: 7 }, trail: path([42, 54], [42, 23], [29, 23], [29, 22]) },
    slots: [
      { ...p1a!, trail: path([39, 54], [39, 25], [14, 25]) },
      { ...p3a!, trail: path([46, 54], [46, 29], [50, 29], [50, 28]) },
      { ...p2a!, trail: path([41, 54], [41, 27], [40, 27], [40, 22]) },
      { ...p4a!, trail: path([44, 54], [44, 31], [78, 31], [78, 29], [80, 29]) },
      { ...p1b!, trail: path([40, 54], [40, 30], [14, 30]) },
      { ...p3b!, trail: path([47, 54], [47, 30], [55, 30], [55, 28]) },
      { ...p2b!, trail: path([45, 54], [45, 22]) },
      { ...p4b!, trail: path([38, 54], [38, 34], [80, 34]) },
    ],
    // Puestos del mercado primero; después dos en la plaza.
    stands: [
      { x: 58, y: 28 },
      { x: 62, y: 28 },
      { x: 76, y: 28 },
      { x: 72, y: 28 },
      { x: 22, y: 22 },
      { x: 34, y: 22 },
    ],
    stairs: [{ x: 16, y: 21, w: 2, dir: "up", to: 1, label: "Subir al altillo" }],
    decor: [
      { kind: "window", x: 37, y: 21, w: 2 },
      { kind: "portal", x: 68, y: 27, w: 4, text: "HUERTA" },
      { kind: "portal", x: 18, y: 43, w: 4, text: "TABERNA" },
      { kind: "portal", x: 62, y: 41, w: 4, text: "GRANERO" },
      { kind: "sign", x: 65, y: 27, w: 2, text: "MERCADO" },
      { kind: "fireplace", x: 10, y: 43, w: 3 },
      { kind: "shelf", x: 24, y: 43, w: 3 },
      { kind: "window", x: 54, y: 41, w: 3 },
      { kind: "sponsors", x: 72, y: 41, w: 4 },
      { kind: "window", x: 64, y: 7, w: 3 },
      { kind: "window", x: 76, y: 7, w: 3 },
    ],
    furni: [
      // Calle mayor: faroles, barriles y la pantalla del evento.
      { kind: "eventscreen", x: 40, y: 45, w: 6, floating: true },
      ...[42, 48].flatMap((y): Furni[] => [
        { kind: "lantern", x: 38, y },
        { kind: "lantern", x: 47, y },
      ]),
      { kind: "barrel", x: 38, y: 55 },
      { kind: "barrel", x: 47, y: 55 },
      { kind: "signpost", x: 46, y: 51, label: "↑ Plaza · Salón del pueblo|→ Mercado · Huerta|← Taberna · Granero →" },
      // Plaza: fuente, bancos, árboles y flores.
      { kind: "fountain", x: 25, y: 31, w: 2, d: 2 },
      { kind: "bench", x: 20, y: 35, w: 3 },
      { kind: "bench", x: 30, y: 36, w: 3 },
      { kind: "tree", x: 14, y: 39 },
      { kind: "tree", x: 34, y: 28 },
      { kind: "tree", x: 19, y: 28 },
      { kind: "flowerbed", x: 15, y: 34, w: 3 },
      { kind: "flowerbed", x: 31, y: 32, w: 3 },
      { kind: "lantern", x: 22, y: 26 },
      { kind: "lantern", x: 33, y: 39 },
      // Calle del mercado.
      ...[53, 67, 77].map((x): Furni => ({ kind: "barrel", x, y: 35 })),
      ...[57, 70].map((x): Furni => ({ kind: "lantern", x, y: 34 })),
      { kind: "counter", x: 66, y: 33, w: 2 },
      // Huerta: frutales y canteros.
      ...[62, 67, 72, 77, 81].flatMap((x): Furni[] => [
        { kind: "tree", x, y: 9 },
        { kind: "tree", x, y: 15 },
      ]),
      ...[63, 70, 76].map((x): Furni => ({ kind: "flowerbed", x, y: 12, w: 3 })),
      { kind: "bench", x: 74, y: 19, w: 3 },
      { kind: "barrel", x: 60, y: 22 },
      // Taberna: barra, mesas, barriles y el fuego.
      { kind: "counter", x: 6, y: 44, w: 3 },
      ...[9, 15, 21, 26].map((x, i): Furni => ({ kind: "table", x, y: 48 + (i % 2) * 3, w: 2 })),
      ...lounge(9, 53, "#a0522d"),
      ...[6, 7].map((x): Furni => ({ kind: "barrel", x, y: 56 })),
      { kind: "lantern", x: 30, y: 44 },
      // Granero: juegos entre fardos (barriles) y faroles.
      { kind: "pingpong", x: 55, y: 45, w: 3 },
      { kind: "foosball", x: 70, y: 46, w: 2 },
      { kind: "chess", x: 57, y: 51, w: 2 },
      { kind: "chess", x: 62, y: 51, w: 2 },
      ...[74, 76, 78].map((x): Furni => ({ kind: "barrel", x, y: 54 })),
      ...[66, 79].map((x): Furni => ({ kind: "lantern", x, y: 43 })),
      { kind: "bench", x: 69, y: 52, w: 3 },
    ],
    crowd: [...chat(28, 26), ...chat(21, 32), ...chat(55, 32), ...chat(70, 31), ...chat(66, 17), ...chat(16, 50), ...chat(60, 48), ...chat(43, 42)],
    directories: [
      { x: 38, y: 51 },
      { x: 47, y: 44 },
    ],
  };
}

// ----- Stellar: una avenida principal cruzada por dos avenidas, con cuatro zonas y las salas repartidas -----

/*
 * Como el hackathon, pero con la temática Stellar: una avenida principal
 * (norte–sur) va de la entrada al auditorio y la cruzan dos avenidas
 * (este–oeste). A propósito no es simétrico: al oeste, una gran expo llena de
 * stands, abierta de par en par a la avenida principal, con el Café Ancla
 * abajo; al este, la avenida de abajo con el nodo de juegos y el Galaxy Lounge,
 * más chicos y corridos. Las salas van de a dos en cuatro puntos lejanos, cada
 * una con un camino de su color desde la entrada.
 */
const ST_MAIN: Rect = { x: 42, y: 14, w: 12, h: 52 };
const ST_CROSS_A: Rect = { x: 8, y: 20, w: 80, h: 10 };
// La avenida de abajo solo va hacia el este: al oeste, la expo ocupa todo el alto.
const ST_CROSS_B: Rect = { x: 42, y: 46, w: 46, h: 10 };

/** Una zona entre avenidas: su piso, sus pasos y el nombre en cada puerta que da a una avenida. */
function stZone(r: Rect, name: string, side: "west" | "east", doors: { top?: boolean; bottom?: boolean }) {
  const floors: Rect[] = [r];
  const decor: Decor[] = [];
  // Paso lateral desde la avenida principal (más largo si la zona queda más lejos).
  const from = side === "west" ? r.x + r.w : ST_MAIN.x + ST_MAIN.w;
  const to = side === "west" ? ST_MAIN.x : r.x;
  floors.push({ x: from, y: r.y + 3, w: to - from, h: 4 });
  if (doors.top)
    for (const dx of [6, r.w - 10]) {
      floors.push({ x: r.x + dx, y: r.y - 3, w: 4, h: 3 });
      decor.push({ kind: "portal", x: r.x + dx, y: r.y - 1, w: 4, text: name });
    }
  if (doors.bottom) {
    floors.push({ x: r.x + 14, y: r.y + r.h, w: 4, h: 3 });
    decor.push({ kind: "portal", x: r.x + 14, y: r.y + r.h + 2, w: 4, text: name });
  }
  return { floors, decor };
}

/** Camino de color de cada sala: sube por su carril de la avenida principal y dobla hacia su puerta. */
const stTrail = (lane: number, row: number, doorX: number, doorY?: number): Tile[] => [
  { x: lane, y: 63 },
  { x: lane, y: row },
  { x: doorX, y: row },
  ...(doorY === undefined ? [] : [{ x: doorX, y: doorY }]),
];

function stellarGround(): Level {
  // Expo: todo el alto del lado oeste, entre la avenida de arriba y el café.
  const expo = { x: 8, y: 33, w: 31, h: 23 };
  const expoOpening = { x: 39, y: 40, w: 3, h: 13 };
  const expoDoors = [14, 30].map((x) => ({ x, y: 30, w: 4, h: 3 }));
  const q2 = { x: 60, y: 33, w: 28, h: 10 };
  const q3 = { x: 8, y: 59, w: 31, h: 10 };
  const q4 = { x: 62, y: 59, w: 26, h: 10 };
  const nodo = stZone(q2, "NODO DE JUEGOS", "east", { top: true, bottom: true });
  const cafe = stZone(q3, "CAFÉ ANCLA", "west", { top: true });
  const lng = stZone(q4, "GALAXY LOUNGE", "east", { top: true });
  // Salas de a dos: arriba al oeste y al este (puerta en la pared norte), una pareja que da a la expo y otra en la punta este.
  const [aw1, aw2] = pairH(11, 19, "Avenida de arriba (oeste)");
  const [ae1, ae2] = pairH(70, 19, "Avenida de arriba (este)");
  const [bw1, bw2] = pairV(7, 42, "left", "Junto a la expo");
  const [be1, be2] = pairV(88, 47, "right", "Punta este");
  return {
    name: "Hub",
    w: 96,
    h: 72,
    floors: [ST_MAIN, ST_CROSS_A, ST_CROSS_B, expo, expoOpening, ...expoDoors, ...nodo.floors, ...cafe.floors, ...lng.floors],
    areas: [
      { ...expo, floor: "tiles" },
      { ...q3, floor: "deck" },
    ],
    exit: { x: 47, y: 66 },
    spawn: { x: 47, y: 63 },
    main: { x: 46, y: 13, roof: { x: 40, y: 5, w: 16, h: 7 }, trail: [{ x: 47, y: 63 }, { x: 47, y: 14 }] },
    slots: [
      { ...aw1!, trail: stTrail(43, 23, aw1!.door.x, 20) },
      { ...be1!, trail: stTrail(52, be1!.door.y, 87) },
      { ...ae1!, trail: stTrail(51, 23, ae1!.door.x, 20) },
      { ...bw1!, trail: stTrail(44, bw1!.door.y, 8) },
      { ...aw2!, trail: stTrail(45, 24, aw2!.door.x, 20) },
      { ...be2!, trail: stTrail(50, be2!.door.y, 87) },
      { ...ae2!, trail: stTrail(49, 24, ae2!.door.x, 20) },
      { ...bw2!, trail: stTrail(46, bw2!.door.y, 8) },
    ],
    // Primero los de la expo (los patrocinadores se ubican en orden), después unos pocos en las avenidas.
    expo: true,
    stands: [
      // Contra la pared norte de la expo, entre sus dos puertas.
      { x: 9, y: 33 },
      { x: 20, y: 33 },
      { x: 25, y: 33 },
      { x: 35, y: 33 },
      // Dos filas sueltas, corridas entre sí; el pasillo del medio queda libre.
      { x: 12, y: 39, free: true },
      { x: 19, y: 39, free: true },
      { x: 27, y: 39, free: true },
      { x: 15, y: 51, free: true },
      { x: 23, y: 51, free: true },
      { x: 31, y: 51, free: true },
      // Avenidas.
      { x: 25, y: 20 },
      { x: 58, y: 20 },
      { x: 60, y: 46 },
    ],
    stairs: [{ x: 42, y: 13, w: 2, dir: "up", to: 1, label: "Subir a la estación" }],
    decor: [
      ...expoDoors.map((d): Decor => ({ kind: "portal", x: d.x, y: d.y + 2, w: d.w, text: "✦ EXPO STELLAR" })),
      ...nodo.decor,
      ...cafe.decor,
      ...lng.decor,
      { kind: "neon", x: 50, y: 13, w: 3, text: "✦", color: "#fdda24" },
      { kind: "sponsors", x: 34, y: 19, w: 5 },
      { kind: "neon", x: 62, y: 19, w: 4, text: "STELLAR", color: "#fdda24" },
      { kind: "neon", x: 55, y: 45, w: 4, text: "SOROBAN", color: "#b7ace8" },
      { kind: "sponsors", x: 66, y: 45, w: 4 },
      { kind: "neon", x: 83, y: 45, w: 4, text: "HORIZON", color: "#b7ace8" },
    ],
    furni: [
      // Avenida principal: la entrada con su pantalla, el cartel de Stellar, un cohete y constelaciones.
      { kind: "eventscreen", x: 45, y: 58, w: 6, floating: true },
      { kind: "adboard", x: 45, y: 26, w: 6, label: "/assets/logos/stellar.svg" },
      { kind: "rocket", x: 50, y: 53 },
      { kind: "hologram", x: 48, y: 36, w: 2, d: 2 },
      { kind: "constellation", x: 53, y: 34 },
      { kind: "constellation", x: 53, y: 40 },
      { kind: "constellation", x: 42, y: 33 },
      { kind: "totem", x: 43, y: 16 },
      { kind: "totem", x: 52, y: 17 },
      { kind: "totem", x: 52, y: 61 },
      { kind: "signpost", x: 50, y: 61, label: "↑ Auditorio y salas|← Expo · Café|Nodo · Lounge →" },
      { kind: "signpost", x: 50, y: 31, label: "↑ Auditorio · ascensor|← Expo · Salas oeste|Salas este →" },
      { kind: "bigplant", x: 42, y: 64 },
      { kind: "bigplant", x: 53, y: 64 },
      // Avenida de arriba.
      { kind: "constellation", x: 9, y: 27 },
      { kind: "rocket", x: 30, y: 27 },
      { kind: "robot", x: 37, y: 25 },
      { kind: "telescope", x: 77, y: 27 },
      { kind: "constellation", x: 86, y: 28 },
      { kind: "drone", x: 22, y: 25 },
      ...[19, 61, 79].map((x): Furni => ({ kind: "totem", x, y: 29 })),
      // Avenida de abajo (solo al este).
      { kind: "rocket", x: 70, y: 53 },
      { kind: "robot", x: 57, y: 52 },
      { kind: "constellation", x: 84, y: 54 },
      { kind: "drone", x: 76, y: 50 },
      ...[55, 66].map((x): Furni => ({ kind: "totem", x, y: 55 })),
      // Expo: además de los stands, tótems, plantas, un robot que da la bienvenida y un telescopio.
      { kind: "robot", x: 36, y: 43 },
      { kind: "totem", x: 34, y: 46 },
      { kind: "totem", x: 11, y: 54 },
      { kind: "bigplant", x: 38, y: 33 },
      { kind: "bigplant", x: 8, y: 55 },
      { kind: "bigplant", x: 38, y: 55 },
      { kind: "telescope", x: 19, y: 54 },
      { kind: "constellation", x: 27, y: 46 },
      // Nodo de juegos.
      ...[79, 80, 81, 85, 86, 87].map((x): Furni => ({ kind: "arcade", x, y: 33 })),
      { kind: "pingpong", x: 63, y: 37, w: 3 },
      { kind: "foosball", x: 70, y: 36, w: 2 },
      { kind: "chess", x: 76, y: 40, w: 2 },
      ...[81, 83, 86].map((x, i): Furni => ({ kind: "beanbag", x, y: 40, color: i % 2 ? "#fdda24" : "#b7ace8" })),
      // Café Ancla.
      { kind: "coffeebar", x: 9, y: 59, w: 4 },
      { kind: "vending", x: 20, y: 59 },
      ...[11, 18, 26, 33].map((x, i): Furni => ({ kind: "cafetable", x, y: 62 + (i % 2) * 2, w: 2 })),
      ...[14, 22, 30].map((x): Furni => ({ kind: "cafetable", x, y: 67, w: 2 })),
      { kind: "bigplant", x: 8, y: 68 },
      { kind: "bigplant", x: 38, y: 64 },
      // Galaxy Lounge.
      ...lounge(64, 62, "#fdda24"),
      ...lounge(74, 61, "#b7ace8"),
      ...lounge(80, 65, "#fdda24"),
      { kind: "rocket", x: 86, y: 61 },
      ...[65, 70, 76].map((x, i): Furni => ({ kind: "beanbag", x, y: 67, color: i % 2 ? "#fdda24" : "#b7ace8" })),
      { kind: "constellation", x: 62, y: 68 },
    ],
    crowd: [
      ...chat(45, 47),
      ...chat(49, 22),
      ...chat(17, 24),
      ...chat(68, 25),
      ...chat(80, 52),
      ...chat(11, 47),
      ...chat(22, 43),
      ...chat(30, 47),
      ...chat(66, 40),
      ...chat(20, 61),
      ...chat(70, 66),
      ...chat(46, 44),
    ],
    directories: [
      { x: 43, y: 56 },
      { x: 52, y: 56 },
    ],
  };
}

// ----- Starmaker: las oficinas de la comunidad, en un solo piso -----

/*
 * Oficinas de Starmaker Stellar LATAM. Derecho desde la entrada está la sala
 * principal (la Sala Stellar): la reunión de los martes, donde todo el mundo
 * habla y comparte pantalla; lleva el nombre de la sala principal del evento.
 * A su izquierda, ocho salas chiquitas en dos filas, a las que el equipo
 * organizador reparte a la gente al azar; a su derecha, el salón de mentores y,
 * más allá, el de BAF. Abajo: el cowork (mesas de 2 a 6) con el karaoke y la
 * sala de juegos, la sala de estudio (cada mesa se escucha solo entre sí), el
 * café, el descanso y el patio. Se entra por el lobby, con los stands de
 * Stellar y de BAF.
 */
function starmakerOffice(): Level {
  // La sala empieza un poco más abajo: la pared de arriba deja lugar a la pantalla grande.
  const hall = { x: 40, y: 4, w: 24, h: 13 };
  // La tarima, al frente de la sala: solo quien está parado en ella puede compartir pantalla.
  const stage = { x: 44, y: 4, w: 16, h: 3 };
  // Filas de asientos mirando a la tarima, con un pasillo al medio.
  const hallSeats: Seat[] = [9, 11, 13, 15].flatMap((y) => [...range(42, 49), ...range(54, 61)].map((x): Seat => ({ x, y, dir: "up" })));
  const cowork = { x: 6, y: 30, w: 34, h: 22 };
  const study = { x: 60, y: 30, w: 36, h: 12 };
  const cafe = { x: 60, y: 45, w: 14, h: 10 };
  const rest = { x: 76, y: 45, w: 20, h: 10 };
  const patio = { x: 62, y: 58, w: 34, h: 8 };
  const lobby = { x: 44, y: 54, w: 16, h: 11 };
  const karaoke = { x: 6, y: 55, w: 16, h: 12 };
  const games = { x: 24, y: 55, w: 16, h: 12 };
  // Mentores y BAF, con la puerta directo sobre el pasillo principal.
  const mentors = doorRoom({ x: 66, y: 4, w: 14, h: 15 }, 20, "🧭 MENTORES", "#f59e0b");
  const baf = doorRoom({ x: 82, y: 4, w: 14, h: 15 }, 20, "BAF", "#22d3ee");
  // La conversación de una sala empieza apenas se cruza la puerta.
  const withDoor = (room: Rect, passage: Rect): Rect => ({ x: room.x, y: room.y, w: room.w, h: passage.y + passage.h - room.y });
  // Ocho salas chiquitas: cuatro arriba (dan a un pasillo propio) y cuatro abajo (dan al pasillo principal).
  const cols = [6, 13, 20, 27];
  const breakouts = [
    ...cols.map((x) => doorRoom({ x, y: 2, w: 6, h: 5 }, 8, "", "#fdda24")),
    ...cols.map((x) => doorRoom({ x, y: 14, w: 6, h: 5 }, 20, "", "#fdda24")),
  ].map((b, i) => ({ ...b, n: i + 1, door: { ...b.door, text: `SALA ${i + 1}` } }));
  // Mesas del cowork (de 2 a 6 lugares) y de la sala de estudio: cada una con su propia conversación.
  let n = 0;
  const cw = ([seats, x, y]: number[]) => teamTable(++n, seats!, x!, y!, "#22d3ee");
  // Mesas separadas entre sí, con lugar para pasar alrededor.
  const coworkTables = [
    [6, 7, 31], [5, 15, 31], [4, 23, 31], [3, 35, 31],
    [2, 8, 38], [6, 14, 38], [3, 23, 38], [5, 30, 38],
    [4, 7, 45], [3, 14, 45], [6, 21, 45], [4, 30, 45],
  ].map(cw);
  let m = 0;
  const st = ([seats, x, y]: number[]) => {
    const t = teamTable(100 + ++m, seats!, x!, y!, "#a78bfa");
    return { ...t, zone: { ...t.zone, id: `estudio-${m}`, label: `Estudio ${m}` } };
  };
  const studyTables = [
    [4, 62, 31], [2, 67, 31], [4, 77, 31], [4, 82, 31], [2, 87, 31], [4, 91, 31],
    [4, 62, 36], [2, 69, 36], [4, 72, 36], [2, 78, 36], [4, 81, 36], [4, 86, 36], [2, 92, 36],
  ].map(st);
  return {
    name: "Oficinas",
    w: 100,
    h: 70,
    floors: [
      hall,
      { x: 48, y: 17, w: 8, h: 4 },
      ...breakouts.flatMap((b) => [b.room, b.passage]),
      { x: 6, y: 9, w: 31, h: 3 }, // pasillo de las salas de arriba
      { x: 37, y: 9, w: 2, h: 12 },
      { x: 37, y: 9, w: 3, h: 3 },
      mentors.room,
      mentors.passage,
      baf.room,
      baf.passage,
      { x: 6, y: 21, w: 90, h: 6 }, // pasillo principal
      { x: 48, y: 27, w: 8, h: 27 }, // pasillo central
      lobby,
      cowork,
      { x: 12, y: 27, w: 4, h: 3 },
      { x: 30, y: 27, w: 4, h: 3 },
      { x: 40, y: 35, w: 8, h: 8 },
      karaoke,
      { x: 12, y: 52, w: 4, h: 3 },
      games,
      { x: 30, y: 52, w: 4, h: 3 },
      { x: 40, y: 59, w: 4, h: 3 },
      study,
      { x: 72, y: 27, w: 4, h: 3 },
      { x: 56, y: 33, w: 4, h: 4 },
      cafe,
      { x: 64, y: 42, w: 4, h: 3 },
      { x: 56, y: 47, w: 4, h: 4 },
      rest,
      { x: 74, y: 48, w: 2, h: 4 },
      patio,
      { x: 60, y: 59, w: 2, h: 4 },
      { x: 66, y: 55, w: 4, h: 3 },
      { x: 84, y: 55, w: 3, h: 3 },
    ],
    areas: [
      { ...hall, floor: "wood" },
      { ...stage, floor: "stage" },
      { ...cowork, floor: "tiles" },
      { ...study, floor: "tiles" },
      { ...karaoke, floor: "deck" },
      { ...games, floor: "tiles" },
      { ...cafe, floor: "wood" },
      { ...rest, floor: "deck" },
      { ...patio, floor: "grass" },
      { ...mentors.room, floor: "wood" },
      { ...baf.room, floor: "wood" },
    ],
    exit: { x: 51, y: 65 },
    spawn: { x: 51, y: 62 },
    slots: [],
    seats: hallSeats,
    zones: [
      // La sala principal del evento (toma su nombre).
      { id: "reunion", label: "Sala de reunión", ...hall, color: "#fdda24", seats: 100, room: true, share: true, gather: true, stage },
      ...breakouts.map((b): Zone => ({ id: `sala-${b.n}`, label: `Sala ${b.n}`, ...withDoor(b.room, b.passage), color: "#fdda24", seats: 12, room: true, share: true, breakout: true })),
      { id: "mentores", label: "Salón de mentores", ...withDoor(mentors.room, mentors.passage), color: "#f59e0b", seats: 30, room: true },
      { id: "baf", label: "Salón BAF", ...withDoor(baf.room, baf.passage), color: "#22d3ee", seats: 30, room: true },
      { id: "karaoke", label: "Karaoke", ...karaoke, y: 52, h: karaoke.h + 3, color: "#ec4899", seats: 40, room: true, share: true },
      { id: "juegos", label: "Sala de juegos", ...games, y: 52, h: games.h + 3, color: "#a78bfa", seats: 30, room: true, share: true },
      ...coworkTables.map((t) => t.zone),
      ...studyTables.map((t) => t.zone),
    ],
    stands: [],
    stairs: [],
    decor: [
      { kind: "neon", x: 40, y: 3, w: 4, text: "✦ STELLAR", color: "#fdda24" },
      { kind: "neon", x: 60, y: 3, w: 4, text: "STARMAKER", color: "#b7ace8" },
      { kind: "portal", x: 48, y: 20, w: 8, text: "✦ $MAIN" },
      ...breakouts.map((b) => b.door),
      mentors.door,
      baf.door,
      { kind: "portal", x: 12, y: 29, w: 4, text: "COWORK" },
      { kind: "portal", x: 30, y: 29, w: 4, text: "COWORK" },
      { kind: "window", x: 18, y: 29, w: 3 },
      { kind: "whiteboard", x: 23, y: 29, w: 3 },
      { kind: "portal", x: 72, y: 29, w: 4, text: "SALA DE ESTUDIO · SILENCIO" },
      { kind: "window", x: 64, y: 29, w: 3 },
      { kind: "window", x: 84, y: 29, w: 3 },
      { kind: "portal", x: 12, y: 54, w: 4, text: "🎤 KARAOKE" },
      { kind: "neon", x: 17, y: 54, w: 5, text: "KARAOKE", color: "#ec4899" },
      { kind: "portal", x: 30, y: 54, w: 4, text: "🎮 SALA DE JUEGOS" },
      { kind: "window", x: 45, y: 53, w: 2 },
      { kind: "window", x: 57, y: 53, w: 2 },
      { kind: "portal", x: 64, y: 44, w: 4, text: "CAFÉ" },
      { kind: "neon", x: 80, y: 44, w: 5, text: "DESCANSO", color: "#fdda24" },
    ],
    furni: [
      // Sala principal: la tarima con la pantalla grande detrás, un atril y las filas de asientos.
      { kind: "stagescreen", x: 45, y: 4, w: 14 },
      { kind: "lectern", x: 58, y: 5, color: "#fdda24" },
      { kind: "ledpillar", x: 44, y: 6 },
      { kind: "ledpillar", x: 59, y: 6 },
      ...hallSeats.map((t): Furni => ({ kind: "chair", x: t.x, y: t.y, dir: "up", color: t.x % 3 ? "#2a2a33" : "#fdda24" })),
      { kind: "constellation", x: 40, y: 4 },
      { kind: "constellation", x: 63, y: 4 },
      { kind: "rocket", x: 41, y: 15 },
      { kind: "bigplant", x: 62, y: 15 },
      // Salas chiquitas: una mesa con sillas en cada una.
      ...breakouts.flatMap((b): Furni[] => [
        { kind: "table", x: b.room.x + 2, y: b.room.y + 2, w: 2 },
        ...[0, 1].flatMap((dx): Furni[] => [
          { kind: "officechair", x: b.room.x + 2 + dx, y: b.room.y + 1 },
          { kind: "officechair", x: b.room.x + 2 + dx, y: b.room.y + 3 },
        ]),
        { kind: "plant", x: b.room.x, y: b.room.y },
      ]),
      // Mentores y BAF: una mesa grande con café.
      ...meetingRoom(mentors.room, "#b45309", [{ kind: "bookshelf", x: 66, y: 9 }]),
      ...meetingRoom(baf.room, "#0e7490", [{ kind: "adboard", x: 89, y: 14, w: 4, label: "/assets/logos/thebafnetwork.svg" }]),
      // Pasillos.
      ...[20, 34, 66, 80].map((x): Furni => ({ kind: "totem", x, y: 26 })),
      { kind: "signpost", x: 57, y: 23, label: "↑ $MAIN|← Salas 1 a 8|Mentores · BAF →" },
      ...[31, 38, 45].flatMap((y): Furni[] => [
        { kind: "constellation", x: 48, y },
        { kind: "constellation", x: 55, y },
      ]),
      { kind: "adboard", x: 49, y: 28, w: 6, label: "/assets/logos/stellar.svg" },
      // Cowork.
      ...coworkTables.flatMap((t) => t.furni),
      { kind: "printer3d", x: 6, y: 51 },
      { kind: "charger", x: 39, y: 30 },
      { kind: "bigplant", x: 39, y: 51 },
      { kind: "bigplant", x: 27, y: 35 },
      { kind: "coffeebar", x: 17, y: 30, w: 3 },
      // Karaoke: escenario con micrófono, la pantalla con la letra, luces y lugares para mirar.
      { kind: "eventscreen", x: 10, y: 56, w: 6, floating: true },
      { kind: "lectern", x: 13, y: 60, color: "#ec4899" },
      ...[7, 20].flatMap((x): Furni[] => [
        { kind: "ledpillar", x, y: 56 },
        { kind: "rack", x, y: 59 },
      ]),
      ...lounge(8, 63, "#ec4899"),
      ...[15, 17, 19].map((x, i): Furni => ({ kind: "beanbag", x, y: 64, color: ["#fdda24", "#ec4899", "#22d3ee"][i] })),
      // Sala de juegos.
      ...[24, 25, 26, 36, 37, 38].map((x): Furni => ({ kind: "arcade", x, y: 55 })),
      { kind: "pingpong", x: 26, y: 59, w: 3 },
      { kind: "foosball", x: 33, y: 59, w: 2 },
      { kind: "chess", x: 26, y: 63, w: 2 },
      { kind: "vrpod", x: 33, y: 63, w: 2 },
      ...[37, 38].map((x, i): Furni => ({ kind: "beanbag", x, y: 65, color: i ? "#fdda24" : "#a78bfa" })),
      // Sala de estudio.
      ...studyTables.flatMap((t) => t.furni),
      ...[60, 95].map((x): Furni => ({ kind: "bookshelf", x, y: 30 })),
      { kind: "lamp", x: 95, y: 41 },
      // Café.
      { kind: "coffeebar", x: 60, y: 45, w: 4 },
      { kind: "vending", x: 71, y: 45 },
      { kind: "cooler", x: 72, y: 45 },
      ...[61, 66, 70].map((x, i): Furni => ({ kind: "cafetable", x, y: 49 + (i % 2) * 2, w: 2 })),
      { kind: "bigplant", x: 73, y: 54 },
      // Descanso.
      ...lounge(78, 46, "#fdda24"),
      ...lounge(87, 46, "#b7ace8"),
      ...[78, 81, 88, 91].map((x, i): Furni => ({ kind: "beanbag", x, y: 51, color: ["#fdda24", "#b7ace8", "#22d3ee", "#ec4899"][i] })),
      { kind: "bigplant", x: 95, y: 54 },
      // Patio.
      ...[62, 70, 78, 95].map((x): Furni => ({ kind: "tree", x, y: 65 })),
      { kind: "fountain", x: 76, y: 59, w: 2, d: 2 },
      { kind: "parasol", x: 65, y: 60, w: 2, color: "#fdda24" },
      { kind: "parasol", x: 88, y: 60, w: 2, color: "#22d3ee" },
      { kind: "bench", x: 72, y: 64, w: 3 },
      { kind: "bench", x: 83, y: 64, w: 3 },
      { kind: "flowerbed", x: 93, y: 58, w: 2 },
      // Lobby.
      { kind: "eventscreen", x: 49, y: 58, w: 6, floating: true },
      { kind: "signpost", x: 56, y: 61, label: "↑ $MAIN · Cowork · Estudio|← Karaoke · Juegos|Café · Patio →" },
      { kind: "bigplant", x: 44, y: 64 },
      { kind: "bigplant", x: 59, y: 64 },
    ],
    crowd: [
      // Público sentado mirando a la tarima.
      ...([
        [43, 11],
        [46, 11],
        [56, 13],
        [60, 11],
        [44, 15],
        [57, 15],
      ] as const).map(([x, y]): [number, number, Dir, boolean] => [x, y, "up", true]),
      ...chat(30, 23),
      ...chat(62, 50),
      ...chat(84, 50),
      ...chat(68, 61),
      ...chat(50, 56),
      ...chat(9, 10),
      ...chat(14, 61),
      ...chat(29, 61),
    ],
    directories: [
      { x: 46, y: 62 },
      { x: 55, y: 49 },
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
function teamTable(n: number, seats: number, x: number, y: number, color: string): { zone: Zone; furni: Furni[] } {
  // Con un número impar de lugares, del lado de abajo queda una silla menos.
  const cols = Math.ceil(seats / 2);
  const below = Math.floor(seats / 2);
  return {
    zone: { id: `mesa-${n}`, label: `Mesa ${n}`, x, y, w: cols + 2, h: 5, color, seats },
    furni: [
      { kind: "table", x: x + 1, y: y + 2, w: cols },
      ...Array.from({ length: cols }, (_, i) => ({ kind: "officechair" as const, x: x + 1 + i, y: y + 1 })),
      ...Array.from({ length: below }, (_, i) => ({ kind: "officechair" as const, x: x + 1 + i, y: y + 3 })),
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
  entrances: { rect: Rect; portal?: Tile; sign?: Tile & { side: "left" | "right" } }[];
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
        if (e.portal) decor.push({ kind: "portal", x: e.portal.x, y: e.portal.y, w: e.rect.w, text: `SALA DE EQUIPOS ${s.hall}` });
        if (e.sign) {
          const name = `SALA DE EQUIPOS ${s.hall}`;
          furni.push({ kind: "signpost", x: e.sign.x, y: e.sign.y, label: e.sign.side === "left" ? `← ${name}|   Mesas de hackers` : `${name} →|Mesas de hackers   ` });
        }
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
const HACK_CROSS_A: Rect = { x: 16, y: 16, w: 82, h: 12 };
const HACK_CROSS_B: Rect = { x: 16, y: 58, w: 82, h: 12 };
const hackHalls = (first: number): HallSpot[] => {
  const top = (x0: number, y: number) => [
    { rect: { x: x0 + 4, y, w: 4, h: 3 }, portal: { x: x0 + 4, y: y + 2 } },
    { rect: { x: x0 + 22, y, w: 4, h: 3 }, portal: { x: x0 + 22, y: y + 2 } },
  ];
  // Puerta de atrás, hacia el patio de afuera.
  const back = (x0: number) => ({ rect: { x: x0 + 19, y: 97, w: 4, h: 2 }, portal: { x: x0 + 19, y: 98 } });
  return [
    { hall: first, x: 14, y: 31, entrances: [...top(14, 28), { rect: { x: 47, y: 40, w: 3, h: 5 }, sign: { x: 50, y: 45, side: "left" } }] },
    { hall: first + 1, x: 67, y: 31, entrances: [...top(67, 28), { rect: { x: 64, y: 40, w: 3, h: 5 }, sign: { x: 63, y: 45, side: "right" } }] },
    { hall: first + 2, x: 14, y: 73, entrances: [...top(14, 70), { rect: { x: 47, y: 76, w: 3, h: 5 }, sign: { x: 50, y: 81, side: "left" } }, back(14)] },
    { hall: first + 3, x: 67, y: 73, entrances: [...top(67, 70), { rect: { x: 64, y: 76, w: 3, h: 5 }, sign: { x: 63, y: 81, side: "right" } }, back(67)] },
  ];
};

/** Una sala de charla en cada punta de las calles cruzadas, a pocos pasos de su sala de equipos. */
const hackRoomSlots = (prefix: string, lanes: number[], from: number, bend: number): Slot[] => {
  const lane = (i: number, y: number, x: number) => [{ x: lanes[i]!, y: from }, { x: lanes[i]!, y }, { x, y }];
  return [
    // Edificios grandes, que asoman sobre el patio de afuera: así se ve que ahí hay una sala.
    { ...singleV(15, 19, "left", `${prefix}junto a equipos (noroeste)`), roof: { x: 6, y: 16, w: 9, h: 7 }, trail: lane(0, 20, 16) },
    { ...singleV(98, 19, "right", `${prefix}junto a equipos (noreste)`), roof: { x: 99, y: 16, w: 9, h: 7 }, trail: lane(1, 21, 97) },
    { ...singleV(15, 61, "left", `${prefix}junto a equipos (suroeste)`), roof: { x: 9, y: 58, w: 6, h: 7 }, trail: lane(2, 62 + bend, 16) },
    { ...singleV(98, 61, "right", `${prefix}junto a equipos (sureste)`), roof: { x: 99, y: 58, w: 6, h: 7 }, trail: lane(3, 63 - bend, 97) },
  ];
};

/** Stands: contra la pared de arriba de las dos calles cruzadas, separados entre sí y de cada puerta. */
const HACK_STANDS = [
  ...[18, 35, 41, 63, 69, 87, 93].map((x) => ({ x, y: 16 })),
  ...[20, 30, 40, 73, 83, 93].map((x) => ({ x, y: 58 })),
];

/** Paredes de las calles: pantallas con código que corre intercaladas con pantallas de patrocinadores. */
const hackWallDecor = (): Decor[] => [
  { kind: "codewall", x: 22, y: 15, w: 5 },
  { kind: "sponsors", x: 45, y: 15, w: 3 },
  { kind: "codewall", x: 73, y: 15, w: 6 },
  { kind: "sponsors", x: 24, y: 57, w: 5 },
  { kind: "codewall", x: 34, y: 57, w: 5 },
  { kind: "sponsors", x: 44, y: 57, w: 4 },
  { kind: "codewall", x: 67, y: 57, w: 5 },
  { kind: "sponsors", x: 77, y: 57, w: 5 },
  { kind: "codewall", x: 87, y: 57, w: 5 },
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
  ...chat(47, 21),
  ...chat(66, 66),
];

/** Vida en las calles: robots, hologramas, pantallas del evento, tótems con los patrocinadores y luces. Nada corta el paso. */
const hackStreetFurni = (north: string, south: string): Furni[] => [
  // Calle principal.
  { kind: "countdown", x: 54, y: 43, w: 6 },
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
  // Cruces: publicidad gigante (Stellar al centro, patrocinadores a los lados) y luces.
  ...[20, 62].flatMap((y): Furni[] => [
    { kind: "adboard", x: 54, y, w: 6, label: "/assets/logos/stellar.svg" },
    { kind: "adboard", x: 50, y: y + 3, w: 3 },
    { kind: "adboard", x: 61, y: y + 3, w: 3 },
  ]),
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
  { kind: "vrpod", x: 18, y: 22, w: 2 },
  { kind: "vrpod", x: 94, y: 22, w: 2 },
  { kind: "vrpod", x: 18, y: 64, w: 2 },
  { kind: "vrpod", x: 94, y: 64, w: 2 },
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
  { kind: "photobooth", x: 71, y: 62, w: 2 },
];

/*
 * El patio de afuera: un solo espacio abierto que rodea el edificio por los
 * costados y por abajo. Al oeste, un parque y un patio con sombrillas; al
 * este, un café y una zona de descanso; abajo, la plaza de llegada que lleva a
 * la puerta principal. Se entra y se sale por muchos lados: las puntas de las
 * dos calles cruzadas, la puerta principal y la puerta de atrás de las salas
 * de equipos 3 y 4. Arriba, el mismo contorno es una terraza en la azotea.
 */
const HACK_H = 108;
const OUT = {
  // Costados anchos, con un paso más angosto junto a las salas de charla.
  west: [
    { x: 1, y: 25, w: 12, h: 32 },
    { x: 1, y: 25, w: 8, h: 74 },
    { x: 1, y: 67, w: 12, h: 32 },
  ],
  east: [
    { x: 101, y: 25, w: 10, h: 32 },
    { x: 105, y: 25, w: 6, h: 74 },
    { x: 101, y: 67, w: 10, h: 32 },
  ],
  plaza: { x: 1, y: 99, w: 110, h: 7 },
  // Antesala de la puerta principal, entre las salas de equipos 3 y 4.
  forecourt: { x: 48, y: 85, w: 18, h: 14 },
  gate: { x: 52, y: 83, w: 10, h: 2 },
} satisfies Record<string, Rect | Rect[]>;
const OUT_PASSAGES: Rect[] = [
  { x: 13, y: 25, w: 3, h: 3 },
  { x: 13, y: 67, w: 3, h: 3 },
  { x: 98, y: 25, w: 3, h: 3 },
  { x: 98, y: 67, w: 3, h: 3 },
];

function hackOutdoor(upper: boolean) {
  const furni: Furni[] = [];
  const crowd: [number, number, Dir][] = [];
  // Parque (o jardín, arriba): árboles, fuente, bancos y ajedrez.
  furni.push(
    ...[26, 33, 41, 49].map((y): Furni => ({ kind: "tree", x: 1, y })),
    ...[31, 40, 49].map((y): Furni => ({ kind: "tree", x: 11, y })),
    { kind: "fountain", x: 6, y: 38, w: 2, d: 2 },
    { kind: "bench", x: 3, y: 35, w: 3 },
    { kind: "bench", x: 8, y: 35, w: 3 },
    { kind: "bench", x: 5, y: 42, w: 4 },
    { kind: "flowerbed", x: 3, y: 29, w: 3 },
    { kind: "flowerbed", x: 7, y: 29, w: 3 },
    ...(upper
      ? [
          { kind: "telescope" as const, x: 4, y: 47 },
          { kind: "bigplant" as const, x: 8, y: 47 },
        ]
      : [
          { kind: "chess" as const, x: 3, y: 47, w: 2 },
          { kind: "chess" as const, x: 7, y: 47, w: 2 },
        ]),
    // El paso junto a la sala de charla: un sendero entre árboles.
    { kind: "tree", x: 1, y: 58 },
    { kind: "flowerbed", x: 6, y: 61, w: 2 },
    { kind: "tree", x: 1, y: 65 },
  );
  crowd.push(...chat(4, 44), ...chat(8, 27), ...chat(4, 54));
  // Patio con sombrillas (o food court, arriba).
  furni.push(
    upper ? { kind: "kiosk", x: 3, y: 67 } : { kind: "coffeebar", x: 2, y: 67, w: 4 },
    upper ? { kind: "kiosk", x: 6, y: 67 } : { kind: "vending", x: 7, y: 67 },
    { kind: "vending", x: 9, y: 67 },
    ...[72, 79, 86].flatMap((y, row): Furni[] =>
      [3, 8].map((x): Furni => (upper ? { kind: "cafetable", x, y, w: 2 } : { kind: "parasol", x, y, w: 2, color: ["#ff5c39", "#22d3ee", "#a78bfa"][row] })),
    ),
    { kind: "lamp", x: 6, y: 91 },
    { kind: "beanbag", x: 3, y: 94, color: "#fbbf24" },
    { kind: "beanbag", x: 9, y: 94, color: "#f472b6" },
  );
  crowd.push(...chat(3, 75), ...chat(8, 82));
  // Café (o zona tranquila con libros, arriba).
  furni.push(
    upper ? { kind: "bookshelf", x: 104, y: 25 } : { kind: "coffeebar", x: 104, y: 25, w: 5 },
    upper ? { kind: "bookshelf", x: 106, y: 25 } : { kind: "vending", x: 109, y: 25 },
    upper ? { kind: "bookshelf", x: 108, y: 25 } : { kind: "cooler", x: 110, y: 25 },
    ...[30, 37, 44].flatMap((y): Furni[] => [102, 107].map((x): Furni => ({ kind: "cafetable", x, y, w: 2 }))),
    { kind: "sofa", x: 102, y: 51, w: 3, color: "#a78bfa", dir: "down" },
    { kind: "sofa", x: 107, y: 51, w: 3, color: "#22d3ee", dir: "down" },
    { kind: "coffeetable", x: 103, y: 53, w: 2 },
    { kind: "coffeetable", x: 108, y: 53, w: 2 },
    { kind: "tree", x: 110, y: 58 },
    { kind: "flowerbed", x: 106, y: 61, w: 2 },
    { kind: "tree", x: 110, y: 65 },
  );
  crowd.push(...chat(105, 28), ...chat(104, 48));
  // Zona de descanso (o arcade, arriba).
  furni.push(
    { kind: "sofa", x: 102, y: 70, w: 3, color: "#a78bfa", dir: "down" },
    { kind: "sofa", x: 107, y: 70, w: 3, color: "#f472b6", dir: "down" },
    { kind: "coffeetable", x: 103, y: 72, w: 2 },
    { kind: "coffeetable", x: 108, y: 72, w: 2 },
    ...[102, 104, 106, 108].map((x, i): Furni => ({ kind: "beanbag", x, y: 78, color: ["#fbbf24", "#22d3ee", "#f472b6", "#10b981"][i] })),
    ...(upper
      ? [102, 103, 104, 107, 108, 109].map((x): Furni => ({ kind: "arcade", x, y: 84 }))
      : [
          { kind: "pingpong" as const, x: 102, y: 85, w: 3 },
          { kind: "foosball" as const, x: 107, y: 85, w: 2 },
        ]),
    { kind: "armchair", x: 102, y: 91, color: "#ffb703" },
    { kind: "armchair", x: 108, y: 91, color: "#ffb703" },
    { kind: "lamp", x: 105, y: 91 },
  );
  crowd.push(...chat(104, 81), ...chat(106, 88));
  // Plaza de abajo: árboles, bancos, fuentes y un food truck, con el camino a la puerta libre.
  furni.push(
    ...[3, 12, 22, 32, 42, 70, 80, 90, 100, 109].map((x): Furni => ({ kind: "tree", x, y: 99 })),
    ...[7, 27, 37, 75, 85, 105].map((x): Furni => ({ kind: "bench", x, y: 104, w: 3 })),
    { kind: "fountain", x: 17, y: 101, w: 2, d: 2 },
    { kind: "fountain", x: 94, y: 101, w: 2, d: 2 },
    upper ? { kind: "telescope", x: 46, y: 102 } : { kind: "kiosk", x: 46, y: 101 },
    { kind: "parasol", x: 65, y: 102, w: 2, color: "#f59e0b" },
    { kind: "parasol", x: 40, y: 102, w: 2, color: "#22d3ee" },
    { kind: "flowerbed", x: 47, y: 105, w: 3 },
    { kind: "flowerbed", x: 64, y: 105, w: 3 },
  );
  crowd.push(...chat(24, 102), ...chat(88, 102), ...chat(66, 104), ...chat(8, 101), ...chat(102, 101));
  // Antesala de la puerta: columnas de luz a los lados del camino, plantas y tótems.
  furni.push(
    ...[87, 91, 95].flatMap((y): Furni[] => [
      { kind: "ledpillar", x: 51, y },
      { kind: "ledpillar", x: 62, y },
    ]),
    { kind: "bigplant", x: 48, y: 85 },
    { kind: "bigplant", x: 65, y: 85 },
    { kind: "totem", x: 49, y: 92 },
    { kind: "totem", x: 64, y: 92 },
    upper ? { kind: "bigplant", x: 48, y: 89 } : { kind: "photobooth", x: 48, y: 88, w: 2 },
    { kind: "robot", x: 64, y: 88 },
  );
  // Carteles: en la punta de cada calle cruzada y en la plaza.
  const names = upper ? ["🌿 JARDÍN", "🍕 FOOD COURT", "📚 ZONA TRANQUILA", "🕹 ARCADE"] : ["🌳 PARQUE", "☕ PATIO", "☕ CAFÉ", "🛋 DESCANSO"];
  furni.push(
    { kind: "signpost", x: 16, y: 27, label: `← ${names[0]}` },
    { kind: "signpost", x: 16, y: 69, label: `← ${names[1]}` },
    { kind: "signpost", x: 97, y: 27, label: `${names[2]} →` },
    { kind: "signpost", x: 97, y: 69, label: `${names[3]} →` },
    {
      kind: "signpost",
      x: 60,
      y: 97,
      label: upper ? "↑ Salas y ascensor|← Food court · Jardín|Arcade · Zona tranquila →" : "↑ Entrada al hackathon|← Patio · Parque|Descanso · Café →",
    },
  );
  const { west, east, plaza, forecourt, gate } = OUT;
  return {
    floors: [...west, ...east, plaza, forecourt, gate, ...OUT_PASSAGES],
    areas: [
      ...west.map((r): Area => ({ ...r, floor: "grass" })),
      ...east.map((r): Area => ({ ...r, floor: "grass" })),
      { ...plaza, floor: "grass" },
      // Pisos de madera bajo el patio, el café y la zona de descanso.
      { x: 1, y: 67, w: 12, h: 25, floor: "deck" },
      { x: 101, y: 25, w: 10, h: 31, floor: "wood" },
      { x: 101, y: 69, w: 10, h: 25, floor: "wood" },
      // Camino de piedra de la puerta principal a la salida.
      { ...forecourt, floor: "stone" },
      { x: 52, y: 99, w: 10, h: 7, floor: "stone" },
    ] as Area[],
    furni,
    crowd,
    decor: [{ kind: "portal", x: gate.x, y: gate.y + 1, w: gate.w, text: upper ? "🌇 TERRAZA" : "HACK NIGHT LATAM · BIENVENIDOS" }] as Decor[],
  };
}

function hackathonGround(capacity: number): Level {
  const halls = teamHalls(hackHalls(1), capacity);
  const fun = hackOutdoor(false);
  const mentors = doorRoom({ x: 24, y: 3, w: 13, h: 10 }, 15, "🧭 MENTORES", "#f59e0b");
  const staff = doorRoom({ x: 77, y: 3, w: 13, h: 10 }, 15, "🔒 STAFF", "#ef4444");
  return {
    name: "Planta baja",
    w: 112,
    h: HACK_H,
    floors: [HACK_MAIN, HACK_CROSS_A, HACK_CROSS_B, ...halls.floors, ...fun.floors, mentors.room, mentors.passage, staff.room, staff.passage],
    areas: [{ ...mentors.room, floor: "wood" }, ...fun.areas],
    exit: { x: 56, y: 106 },
    spawn: { x: 56, y: 102 },
    main: { x: 55, y: 15, roof: { x: 48, y: 7, w: 18, h: 7 }, trail: [{ x: 56, y: 84 }, { x: 56, y: 16 }] },
    slots: hackRoomSlots("", [52, 61, 53, 60], 84, 0),
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
    decor: [...halls.decor, ...hackWallDecor(), ...fun.decor, mentors.door, staff.door],
    furni: [
      ...halls.furni,
      ...fun.furni,
      ...hackStreetFurni("↑ Auditorio · ← Mentores · Staff →|← Equipos 1 · Equipos 2 →|← Charlas en las puntas →|← Parque · Café →", "← Equipos 3 · Equipos 4 →|← Charlas en las puntas →|← Patio · Descanso →|↑ Auditorio y ascensor"),
      ...meetingRoom(mentors.room, "#b45309", [{ kind: "bookshelf", x: 24, y: 7 }]),
      ...meetingRoom(staff.room, "#ef4444", [{ kind: "rack", x: 77, y: 7 }]),
      { kind: "eventscreen", x: 54, y: 74, w: 6, floating: true },
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
      ...chat(54, 47),
      ...chat(52, 67),
      ...chat(35, 63),
      ...HACK_STREET_CROWD,
      ...fun.crowd,
    ],
    directories: [],
  };
}

/** Piso alto: las mismas calles con vida, las salas de equipos 5 a 8, una terraza, una sala de descanso y una zona de juegos. */
function hackathonUpper(capacity: number): Level {
  const halls = teamHalls(hackHalls(5), capacity);
  const fun = hackOutdoor(true);
  const terrace = doorRoom({ x: 24, y: 3, w: 13, h: 10 }, 15, "🌿 TERRAZA", "#10b981");
  const lounge = doorRoom({ x: 77, y: 3, w: 13, h: 10 }, 15, "☕ SALA DE DESCANSO", "#a78bfa");
  const games = doorRoom({ x: 48, y: 3, w: 18, h: 10 }, 15, "🎮 ZONA DE JUEGOS", "#22d3ee");
  return {
    name: "Piso 1",
    w: 112,
    h: HACK_H,
    floors: [HACK_MAIN, HACK_CROSS_A, HACK_CROSS_B, ...halls.floors, ...fun.floors, terrace.room, terrace.passage, lounge.room, lounge.passage, games.room, games.passage],
    areas: [
      ...fun.areas,
      { ...terrace.room, floor: "deck" },
      { ...lounge.room, floor: "wood" },
    ],
    spawn: { x: 50, y: 16 },
    slots: hackRoomSlots("Piso 1 · ", [50, 51, 52, 53], 17, 1),
    zones: halls.zones,
    closed: halls.closed,
    stands: HACK_STANDS,
    expo: true,
    stairs: [{ x: 50, y: 15, w: 2, dir: "down", to: 0, label: "ASCENSOR · auditorio, mentores y staff" }],
    decor: [...halls.decor, ...hackWallDecor(), ...fun.decor, terrace.door, lounge.door, games.door],
    furni: [
      ...halls.furni,
      ...fun.furni,
      ...hackStreetFurni("↑ Juegos · ← Terraza · Descanso →|← Equipos 5 · Equipos 6 →|← Charlas en las puntas →|← Jardín · Zona tranquila →", "← Equipos 7 · Equipos 8 →|← Charlas en las puntas →|← Food court · Arcade →|↑ Ascensor"),
      { kind: "eventscreen", x: 54, y: 74, w: 6, floating: true },
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
    crowd: [...chat(26, 21), ...chat(84, 20), ...chat(54, 47), ...chat(28, 7), ...chat(56, 9), ...HACK_STREET_CROWD, ...fun.crowd],
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
  // Un solo piso.
  starmaker: () => [starmakerOffice()],
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
  const trails: Trail[] = [];
  if (main && L.main?.trail) trails.push({ points: L.main.trail, color: main.color, w: 2 });
  if (main && L.main) {
    doors.push({ side: L.main.side ?? "top", x: L.main.x, y: L.main.y, w: L.main.side ? 2 : 4, id: main.id, label: main.name, color: main.color, theme: main.theme ?? theme, zone: "Auditorio principal", main: true });
    roofs.push({ ...L.main.roof, label: main.name, color: main.color, open: true });
  }
  // Si el plano tiene una sala de reunión sin puerta, esa es la sala principal: lleva su nombre ($MAIN en carteles).
  const gather = (L.zones ?? []).find((z) => z.gather);
  const mainName = main?.name ?? "Sala principal";
  const zones = (L.zones ?? []).map((z) => (z.gather && main ? { ...z, label: main.name } : z));
  const decor = L.decor.map((d) => (d.text?.includes("$MAIN") ? { ...d, text: d.text.replaceAll("$MAIN", mainName.toUpperCase()) } : d));
  L.slots.forEach((slot, i) => {
    const room = rooms[i];
    roofs.push({ ...slot.roof, label: room?.name ?? "", color: room?.color ?? "", open: Boolean(room) });
    // La puerta lleva la temática de la sala si tiene una propia (por ejemplo, una sala Stellar en un evento tecnológico).
    if (room) doors.push({ ...slot.door, w: 2, id: room.id, label: room.name, color: room.color, theme: room.theme ?? theme, zone: slot.zone, main: false });
    // Los puestos sin sala de los muros de frente muestran un cuadro.
    else if (slot.door.side === "top") decor.push({ kind: "art", x: slot.door.x, y: slot.door.y, w: 2, color: "#9aa5b1" });
    if (room && slot.trail) {
      // La alfombra cubre todo el vano de la puerta, del lado del pasillo.
      const d = slot.door;
      const mat = d.side === "left" ? { x: d.x + 1, y: d.y, w: 3, h: 2 } : d.side === "right" ? { x: d.x - 3, y: d.y, w: 3, h: 2 } : undefined;
      trails.push({ points: slot.trail, color: room.color, mat });
    }
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
    tiles: carve(L.w, L.h, L.floors, undefined, L.holes),
    style: styleFor(theme),
    floorName: L.name,
    spawn: L.spawn,
    furni: [
      ...L.furni.map((f) => (f.label?.includes("$MAIN") ? { ...f, label: f.label.replaceAll("$MAIN", mainName) } : f)),
      ...booths,
      ...L.directories.map((d): Furni => ({ kind: "directory", x: d.x, y: d.y })),
    ],
    decor,
    doors,
    roofs,
    npcs: reps,
    stairs: L.stairs,
    zones: [...zones, ...standZones],
    closed: L.closed ?? [],
    restricted: [...(L.restricted ?? []), ...standBacks],
    areas: L.areas ?? [],
    trails,
    crowd: L.crowd.map(([x, y, dir, sit], i) => ({ ...attendee(i, x, y, dir), sit })),
    exit: L.exit ? { side: "bottom", x: L.exit.x, y: L.exit.y, w: 2 } : null,
    directories: L.directories,
    meetingRoom: gather && main ? main.id : undefined,
    seats: L.seats ?? [],
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

const STAGE_RUG: Record<ThemeId, string> = { tech: "#cfe3f7", minimal: "#e9e3d8", rustic: "#b5523b", medieval: "#7a2a3a", garden: "#e9dfc4", stellar: "#2a2a33", hackathon: "#2b3a3a", starmaker: "#2a2a33" };

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
    style: styleFor(theme),
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
