// Personaje de bloques visto desde arriba: cabeza en forma de cubo (se ve su tapa y
// su frente), cuerpo y extremidades rectangulares. El origen son los pies y y crece hacia abajo.

import type { Dir } from "../../shared/maps.ts";
import type { Look } from "../../shared/types.ts";

const OUTLINE = "#1d1b26";
const EYES = "#1d1b26";
const UNDER_CAP = "#3a2a1e";

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Bloque: x, y, ancho, alto, color. Las coordenadas son píxeles con los pies en el origen. */
type B = [x: number, y: number, w: number, h: number, color: string];

function hair(look: Look, view: "front" | "back" | "side"): { back: B[]; front: B[] } {
  const c = look.hairColor;
  const d = shade(c, -0.2);
  const top = shade(c, 0.15);
  // La tapa del cubo (arriba de la cara) siempre lleva pelo, salvo rapado.
  const lid: B = [-9, -47, 18, 5, top];
  switch (look.hair) {
    case "short":
      if (view === "back") return { back: [], front: [lid, [-9, -42, 18, 11, c]] };
      if (view === "side") return { back: [], front: [lid, [-9, -42, 18, 3, c], [-9, -42, 7, 9, d]] };
      return { back: [], front: [lid, [-9, -42, 18, 4, c], [-9, -38, 3, 5, d], [6, -38, 3, 5, d], [-3, -38, 4, 2, c]] };
    case "long":
      if (view === "back") return { back: [], front: [lid, [-10, -42, 20, 22, c]] };
      if (view === "side") return { back: [[-10, -40, 8, 20, d]], front: [lid, [-9, -42, 18, 3, c], [-9, -42, 7, 12, d]] };
      return { back: [[-11, -40, 22, 20, d]], front: [lid, [-9, -42, 18, 4, c], [-11, -42, 4, 21, c], [7, -42, 4, 21, c]] };
    case "spiky": {
      const spikes: B[] = [
        [-8, -51, 4, 4, c],
        [-2, -53, 4, 6, c],
        [4, -51, 4, 4, c],
      ];
      if (view === "back") return { back: [], front: [...spikes, lid, [-9, -42, 18, 10, c]] };
      if (view === "side") return { back: [], front: [...spikes, lid, [-9, -42, 7, 8, d]] };
      return { back: [], front: [...spikes, lid, [-9, -42, 18, 3, c], [-9, -39, 3, 4, d], [6, -39, 3, 4, d]] };
    }
    case "bun": {
      const bun: B = view === "side" ? [-8, -53, 7, 6, d] : [-4, -53, 8, 6, d];
      if (view === "back") return { back: [], front: [bun, lid, [-9, -42, 18, 12, c]] };
      if (view === "side") return { back: [], front: [bun, lid, [-9, -42, 7, 10, d]] };
      return { back: [], front: [bun, lid, [-9, -42, 18, 4, c], [-9, -38, 3, 6, d], [6, -38, 3, 6, d]] };
    }
    case "cap": {
      const capTop: B = [-10, -48, 20, 7, c];
      if (view === "back") return { back: [], front: [capTop, [-9, -41, 18, 6, UNDER_CAP]] };
      if (view === "side") return { back: [], front: [[-9, -41, 5, 7, UNDER_CAP], capTop, [6, -42, 9, 3, d]] };
      return { back: [], front: [capTop, [-11, -42, 22, 3, d], [-9, -39, 2, 4, UNDER_CAP], [7, -39, 2, 4, UNDER_CAP]] };
    }
    case "bald":
      return { back: [], front: [[-9, -47, 18, 5, shade(look.skin, 0.12)]] };
  }
}

function blocks(look: Look, dir: Dir, step: number, sitting: boolean): B[] {
  const view = dir === "down" ? "front" : dir === "up" ? "back" : "side";
  const skinTop = shade(look.skin, 0.12);
  const skinSide = shade(look.skin, -0.15);
  const shirtD = shade(look.shirt, -0.18);
  const shirtL = shade(look.shirt, 0.15);
  const pantsD = shade(look.pants, -0.2);
  const drop = sitting ? 4 : 0;
  const up = (b: B): B => [b[0], b[1] + drop, b[2], b[3], b[4]];
  const out: B[] = [];
  const h = hair(look, view);

  if (!sitting) {
    if (view === "side") {
      out.push([-4 - step, -11, 5, 9, pantsD], [-4 - step, -4, 7, 4, shade(look.shoes, -0.15)], [-1 + step, -11, 5, 9, look.pants], [-1 + step, -4, 8, 4, look.shoes]);
    } else {
      const liftL = step > 0 ? 2 : 0;
      const liftR = step < 0 ? 2 : 0;
      out.push(
        [-7, -11, 6, 9 - liftL, look.pants],
        [1, -11, 6, 9 - liftR, look.pants],
        [-7, -4 - liftL, 6, 4, look.shoes],
        [1, -4 - liftR, 6, 4, look.shoes],
      );
    }
  }

  const swing = sitting ? 0 : step;
  const upper: B[] = [...h.back];
  if (view === "side") {
    upper.push(
      [-3 - swing, -24, 4, 11, shade(look.shirt, -0.3)],
      [-7, -25, 13, 15, look.shirt],
      [-7, -25, 13, 2, shirtL],
      [3, -23, 3, 13, shirtD],
      [-2 + swing, -24, 4, 11, shirtD],
      [-2 + swing, -13, 4, 3, look.skin],
    );
  } else {
    upper.push(
      [-12, -24 + swing, 4, 11, shirtD],
      [8, -24 - swing, 4, 11, shirtD],
      [-12, -13 + swing, 4, 3, look.skin],
      [8, -13 - swing, 4, 3, look.skin],
      [-8, -25, 16, 15, look.shirt],
      [-8, -25, 16, 2, shirtL],
      [4, -23, 4, 13, shirtD],
    );
    if (view === "front") upper.push([-2, -25, 4, 3, look.skin]);
  }

  // Cabeza: frente de la cara, tapa del cubo arriba y un lado en sombra.
  upper.push([-9, -42, 18, 16, look.skin], [-9, -47, 18, 5, skinTop], [view === "side" ? -9 : 6, -42, 3, 16, skinSide]);
  if (view === "front") {
    upper.push([-6, -36, 4, 4, EYES], [2, -36, 4, 4, EYES], [-5, -36, 1, 1, "#ffffff"], [3, -36, 1, 1, "#ffffff"], [-2, -30, 4, 1, skinSide], [-8, -32, 2, 2, "rgba(255,110,110,0.45)"], [6, -32, 2, 2, "rgba(255,110,110,0.45)"]);
  } else if (view === "side") {
    upper.push([3, -36, 4, 4, EYES], [4, -36, 1, 1, "#ffffff"], [9, -33, 2, 3, skinSide], [-4, -36, 3, 4, skinSide]);
  }
  upper.push(...h.front);
  out.push(...upper.map(up));
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
  ctx.fillRect(ox - 10, Math.round(y) - 3, 20, 4);
  // Primero el contorno de todos los bloques y encima los colores: queda una silueta limpia.
  ctx.fillStyle = OUTLINE;
  for (const b of list) ctx.fillRect(px(b) - 1, oy + b[1] - 1, b[2] + 2, b[3] + 2);
  for (const b of list) {
    ctx.fillStyle = b[4];
    ctx.fillRect(px(b), oy + b[1], b[2], b[3]);
  }
  ctx.restore();
}

/** Alto aproximado del personaje en píxeles, para ubicar nombres y globos. */
export const avatarHeight = (sitting: boolean) => (sitting ? 47 : 51);
