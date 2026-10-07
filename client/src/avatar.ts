// Personaje de bloques visto desde arriba: cabeza en forma de cubo (se ve su tapa y
// su frente), ropa con sombreado de tres tonos y detalles en cara y pelo.
// El origen son los pies y y crece hacia abajo.

import type { Dir } from "../../shared/maps.ts";
import type { Look } from "../../shared/types.ts";

const OUTLINE = "#1d1b26";
const PUPIL = "#1d1b26";
const UNDER_CAP = "#3a2a1e";

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Bloque: x, y, ancho, alto, color. Si `outline` es false no suma al contorno (detalles internos). */
type B = [x: number, y: number, w: number, h: number, color: string, outline?: boolean];

const detail = (x: number, y: number, w: number, h: number, color: string): B => [x, y, w, h, color, false];

type View = "front" | "back";

function hair(look: Look, view: View): { back: B[]; front: B[] } {
  const c = look.hairColor;
  const d = shade(c, -0.22);
  const l = shade(c, 0.22);
  // La tapa del cubo siempre lleva pelo (salvo rapado), con un brillo arriba.
  const lid: B[] = [[-9, -48, 18, 6, shade(c, 0.08)], detail(-6, -47, 7, 1, l)];
  switch (look.hair) {
    case "short":
      if (view === "back") return { back: [], front: [...lid, [-9, -42, 18, 11, c], detail(-9, -33, 18, 2, d), detail(-4, -40, 1, 6, d), detail(3, -40, 1, 6, d)] };
      // Flequillo escalonado y patillas.
      return {
        back: [],
        front: [...lid, [-9, -42, 18, 4, c], detail(-9, -38, 5, 2, c), detail(4, -38, 5, 2, c), detail(-1, -38, 3, 1, c), [-10, -42, 2, 8, d], [8, -42, 2, 8, d], detail(-6, -42, 5, 1, l)],
      };
    case "long":
      if (view === "back") return { back: [], front: [...lid, [-10, -42, 20, 23, c], detail(-6, -40, 1, 18, d), detail(2, -40, 1, 18, d), detail(-10, -21, 20, 2, d)] };
      return {
        back: [[-11, -40, 22, 21, d]],
        front: [...lid, [-9, -42, 18, 5, c], detail(-2, -37, 4, 1, c), [-11, -42, 4, 22, c], [7, -42, 4, 22, c], detail(-10, -38, 1, 16, l), detail(9, -38, 1, 16, d)],
      };
    case "spiky": {
      const spikes: B[] = [
        [-9, -52, 4, 5, c],
        [-4, -55, 4, 8, c],
        [1, -53, 4, 6, c],
        [5, -51, 4, 4, c],
        detail(-3, -54, 2, 3, l),
      ];
      if (view === "back") return { back: [], front: [...spikes, ...lid, [-9, -42, 18, 10, c], detail(-9, -33, 18, 1, d)] };
      return { back: [], front: [...spikes, ...lid, [-9, -42, 18, 3, c], [-10, -42, 2, 6, d], [8, -42, 2, 6, d], detail(-5, -39, 3, 2, c), detail(2, -39, 3, 2, c)] };
    }
    case "bun": {
      const bun: B[] = [[-4, -55, 8, 7, d], detail(-2, -54, 3, 1, c)];
      if (view === "back") return { back: [], front: [...bun, ...lid, [-9, -42, 18, 12, c], detail(-9, -31, 18, 1, d)] };
      return { back: [], front: [...bun, ...lid, [-9, -42, 18, 4, c], [-10, -42, 2, 9, d], [8, -42, 2, 9, d], detail(-8, -38, 6, 1, c)] };
    }
    case "cap": {
      const top: B[] = [[-10, -49, 20, 8, c], detail(-1, -49, 2, 8, shade(c, 0.25)), detail(-7, -48, 4, 1, shade(c, 0.4))];
      if (view === "back") return { back: [], front: [...top, [-9, -41, 18, 7, UNDER_CAP], detail(-3, -42, 6, 2, shade(c, -0.3))] };
      return { back: [], front: [...top, [-11, -42, 22, 4, d], detail(-11, -39, 22, 1, shade(c, -0.4)), [-10, -38, 2, 4, UNDER_CAP], [8, -38, 2, 4, UNDER_CAP]] };
    }
    case "bald":
      return { back: [], front: [[-9, -48, 18, 6, shade(look.skin, 0.12)], detail(-5, -47, 5, 1, shade(look.skin, 0.3))] };
  }
}

/** Pelo de perfil (mirando a la derecha): cubre la tapa y la nuca, con flequillo adelante. */
function sideHair(look: Look): { back: B[]; front: B[] } {
  const c = look.hairColor;
  const d = shade(c, -0.22);
  const l = shade(c, 0.22);
  const lid: B[] = [[-8, -48, 16, 6, shade(c, 0.08)], detail(-5, -47, 6, 1, l)];
  switch (look.hair) {
    case "short":
      return { back: [], front: [...lid, [-8, -42, 9, 9, c], [1, -42, 7, 3, c], detail(-8, -34, 8, 1, d), detail(-4, -40, 1, 5, d)] };
    case "long":
      return { back: [[-10, -40, 8, 21, d]], front: [...lid, [-8, -42, 9, 13, c], [1, -42, 7, 3, c], detail(-6, -40, 1, 10, d), detail(-8, -30, 9, 1, d)] };
    case "spiky":
      return {
        back: [],
        front: [[-10, -52, 4, 4, c], [-6, -54, 4, 6, c], [-1, -53, 4, 5, c], [3, -51, 4, 3, c], ...lid, [-8, -42, 8, 8, c], [0, -42, 7, 2, c], detail(-5, -53, 2, 3, l)],
      };
    case "bun":
      return { back: [[-12, -50, 7, 7, d]], front: [...lid, [-8, -42, 9, 10, c], [1, -42, 7, 3, c], detail(-11, -49, 3, 1, c)] };
    case "cap":
      return {
        back: [],
        front: [[-8, -41, 6, 8, UNDER_CAP], [-9, -49, 18, 8, c], detail(-6, -48, 4, 1, shade(c, 0.4)), [7, -42, 8, 3, d], detail(7, -40, 8, 1, shade(c, -0.4))],
      };
    case "bald":
      return { back: [], front: [[-8, -48, 16, 6, shade(look.skin, 0.12)], detail(-4, -47, 5, 1, shade(look.skin, 0.3))] };
  }
}

/** Personaje de perfil mirando a la derecha (para la izquierda se refleja). */
function sideBlocks(look: Look, step: number, sitting: boolean): B[] {
  const skin = look.skin;
  const skinSide = shade(skin, -0.14);
  const skinDeep = shade(skin, -0.28);
  const shirt = look.shirt;
  const shirtD = shade(shirt, -0.2);
  const shirtL = shade(shirt, 0.18);
  const pants = look.pants;
  const pantsD = shade(pants, -0.22);
  const sole = shade(look.shoes, -0.45);
  const drop = sitting ? 4 : 0;
  const lift = (b: B): B => [b[0], b[1] + drop, b[2], b[3], b[4], b[5]];
  const h = sideHair(look);
  const out: B[] = [];

  if (!sitting) {
    // Pierna de atrás más oscura; al caminar se cruzan hacia adelante y atrás.
    out.push(
      [-3 - step, -12, 5, 9, pantsD],
      [-3 - step, -4, 7, 3, shade(look.shoes, -0.15)],
      detail(-3 - step, -1, 7, 1, sole),
      [-2 + step, -12, 5, 9, pants],
      detail(-2 + step, -12, 1, 8, shade(pants, 0.15)),
      [-2 + step, -4, 8, 3, look.shoes],
      detail(-2 + step, -1, 8, 1, sole),
      detail(4 + step, -4, 2, 1, shade(look.shoes, 0.3)),
    );
  }
  const swing = sitting ? 0 : step;
  const upper: B[] = [
    ...h.back,
    // Brazo de atrás.
    [-2 - swing, -25, 4, 6, shade(shirt, -0.32)],
    [-2 - swing, -19, 4, 5, skinDeep],
    // Torso de costado, más angosto.
    [-5, -26, 11, 15, shirt],
    detail(-5, -26, 11, 2, shirtL),
    detail(3, -24, 3, 12, shirtD),
    detail(-5, -13, 11, 1, shirtD),
    [-5, -12, 11, 2, pantsD],
    // Brazo de adelante, balanceándose.
    [-1 + swing, -25, 4, 7, shirtD],
    detail(-1 + swing, -25, 4, 1, shirtL),
    [-1 + swing, -18, 4, 4, skin],
    detail(-1 + swing, -15, 4, 1, skinSide),
    // Cuello y cabeza de perfil, con la nariz hacia adelante.
    [-2, -28, 5, 3, skinSide],
    [-8, -43, 16, 17, skin],
    [-8, -48, 16, 5, shade(skin, 0.12)],
    detail(-8, -43, 3, 17, skinSide),
    detail(-8, -27, 16, 1, skinDeep),
    [8, -36, 2, 4, skin],
    detail(8, -33, 2, 1, skinSide),
    // Oreja, ojo con pupila hacia adelante, ceja, mejilla y boca.
    [-3, -37, 3, 5, skinSide],
    detail(-2, -36, 1, 3, skinDeep),
    detail(2, -39, 4, 1, shade(look.hairColor, -0.1)),
    detail(3, -37, 3, 4, "#ffffff"),
    detail(4, -37, 2, 4, PUPIL),
    detail(4, -37, 1, 1, "#ffffff"),
    detail(4, -32, 2, 1, "rgba(255,110,110,0.45)"),
    detail(5, -30, 3, 1, "#a8504a"),
    ...h.front,
  ];
  out.push(...upper.map(lift));
  return out;
}

function blocks(look: Look, dir: Dir, step: number, sitting: boolean): B[] {
  if (dir === "left" || dir === "right") return sideBlocks(look, step, sitting);
  const view: View = dir === "down" ? "front" : "back";
  const skin = look.skin;
  const skinTop = shade(skin, 0.12);
  const skinSide = shade(skin, -0.14);
  const skinDeep = shade(skin, -0.28);
  const shirt = look.shirt;
  const shirtD = shade(shirt, -0.2);
  const shirtL = shade(shirt, 0.18);
  const pants = look.pants;
  const pantsD = shade(pants, -0.22);
  const pantsL = shade(pants, 0.15);
  const sole = shade(look.shoes, -0.45);
  const drop = sitting ? 4 : 0;
  const lift = (b: B): B => [b[0], b[1] + drop, b[2], b[3], b[4], b[5]];
  const out: B[] = [];
  const h = hair(look, view);

  if (!sitting) {
    const liftL = step > 0 ? 2 : 0;
    const liftR = step < 0 ? 2 : 0;
    for (const [x, up] of [
      [-7, liftL],
      [1, liftR],
    ] as const) {
      out.push(
        [x, -12, 6, 9 - up, pants],
        detail(x, -12, 1, 8 - up, pantsL),
        detail(x + 5, -12, 1, 8 - up, pantsD),
        [x, -4 - up, 6, 3, look.shoes],
        detail(x, -1 - up, 6, 1, sole),
        detail(x + 1, -4 - up, 2, 1, shade(look.shoes, 0.3)),
      );
    }
  }

  const swing = sitting ? 0 : step;
  const upper: B[] = [...h.back];
  // Mangas cortas con antebrazo a la vista.
  upper.push(
    [-12, -25 + swing, 4, 6, shirtD],
    [-12, -19 + swing, 4, 6, skin],
    detail(-12, -14 + swing, 4, 1, skinSide),
    [8, -25 - swing, 4, 6, shirtD],
    [8, -19 - swing, 4, 6, skinSide],
    [-8, -26, 16, 15, shirt],
    detail(-8, -26, 16, 2, shirtL),
    detail(-8, -24, 2, 11, shirtL),
    detail(5, -24, 3, 11, shirtD),
    detail(-8, -13, 16, 1, shirtD),
    [-8, -12, 16, 2, pantsD],
  );
  if (view === "front") {
    // Cuello en V, solapas y hebilla del cinturón.
    upper.push(
      detail(-3, -26, 6, 2, skin),
      detail(-2, -24, 4, 1, skin),
      detail(-1, -23, 2, 1, skin),
      detail(-4, -26, 1, 3, shirtL),
      detail(3, -26, 1, 3, shirtL),
      detail(-1, -12, 3, 2, "#e0b84a"),
    );
  } else {
    upper.push(detail(-3, -26, 6, 1, skinSide));
  }

  // Cuello y cabeza: frente de la cara, tapa del cubo arriba y un lado en sombra.
  upper.push([-3, -28, 6, 3, skinSide]);
  if (view === "front") upper.push([-11, -37, 2, 5, skinSide], [9, -37, 2, 5, skinSide]);
  upper.push([-9, -43, 18, 17, skin], [-9, -48, 18, 5, skinTop], detail(6, -43, 3, 17, skinSide), detail(-9, -27, 18, 1, skinDeep));
  if (view === "front") {
    upper.push(
      // Cejas, ojos con blanco y pupila, nariz, mejillas y boca.
      detail(-7, -39, 4, 1, shade(look.hairColor, -0.1)),
      detail(3, -39, 4, 1, shade(look.hairColor, -0.1)),
      detail(-7, -37, 4, 4, "#ffffff"),
      detail(3, -37, 4, 4, "#ffffff"),
      detail(-5, -37, 2, 4, PUPIL),
      detail(4, -37, 2, 4, PUPIL),
      detail(-5, -37, 1, 1, "#ffffff"),
      detail(4, -37, 1, 1, "#ffffff"),
      detail(-1, -33, 2, 2, skinSide),
      detail(-8, -32, 2, 1, "rgba(255,110,110,0.45)"),
      detail(6, -32, 2, 1, "rgba(255,110,110,0.45)"),
      detail(-2, -30, 4, 1, "#a8504a"),
    );
  } else {
    upper.push([-11, -37, 2, 5, skinSide], [9, -37, 2, 5, skinSide]);
  }
  upper.push(...h.front);
  out.push(...upper.map(lift));
  return out;
}

export interface AvatarPose {
  dir: Dir;
  /** Fase de la caminata en [0, 1), o null si está quieto. */
  walk: number | null;
  sitting: boolean;
}

/** Dibuja el personaje con los pies en (x, y). */
export function drawAvatar(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, pose: AvatarPose, alpha = 1) {
  const phase = pose.walk === null ? 0 : Math.sin(pose.walk * Math.PI * 2);
  const step = Math.round(phase * 2);
  const bob = pose.walk !== null && Math.abs(phase) > 0.6 ? -1 : 0;
  const mirror = pose.dir === "left";
  const list = blocks(look, pose.dir, step, pose.sitting);
  const ox = Math.round(x);
  const oy = Math.round(y) + bob;
  const px = (b: B) => (mirror ? ox - b[0] - b[2] : ox + b[0]);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(20, 18, 30, 0.22)";
  ctx.fillRect(ox - 11, Math.round(y) - 3, 22, 4);
  // Primero el contorno de los bloques principales y encima los colores: queda una silueta limpia.
  ctx.fillStyle = OUTLINE;
  for (const b of list) if (b[5] !== false) ctx.fillRect(px(b) - 1, oy + b[1] - 1, b[2] + 2, b[3] + 2);
  for (const b of list) {
    ctx.fillStyle = b[4];
    ctx.fillRect(px(b), oy + b[1], b[2], b[3]);
  }
  ctx.restore();
}

/** Alto aproximado del personaje en píxeles, para ubicar nombres y globos. */
export const avatarHeight = (sitting: boolean) => (sitting ? 48 : 52);
