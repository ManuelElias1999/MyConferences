// Personaje pixel-art visto desde arriba, al estilo Gather: cabeza grande y cuatro direcciones.
// Las coordenadas están en "unidades" de U píxeles; el origen son los pies y y crece hacia abajo.

import type { Dir } from "../../shared/maps.ts";
import type { Look } from "../../shared/types.ts";

const U = 2;
const OUTLINE = "rgba(22, 16, 30, 0.92)";
const EYES = "#1c1a2a";

type R = [x: number, y: number, w: number, h: number, color: string];

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function hair(look: Look, view: "front" | "back" | "side"): R[] {
  const c = look.hairColor;
  const d = shade(c, -0.22);
  const under = "#3a2a1e";
  switch (look.hair) {
    case "short":
      if (view === "front") return [[-4, -16, 8, 3, c], [-4, -13, 1, 2, d], [3, -13, 1, 2, d]];
      if (view === "back") return [[-4, -16, 8, 6, c]];
      return [[-4, -16, 8, 3, c], [-4, -13, 3, 3, d]];
    case "long":
      if (view === "front") return [[-4, -16, 8, 3, c], [-5, -14, 1, 8, d], [4, -14, 1, 8, d]];
      if (view === "back") return [[-5, -16, 10, 11, c]];
      return [[-4, -16, 8, 3, c], [-4, -13, 3, 8, d]];
    case "spiky": {
      const spikes: R[] = [[-4, -17, 2, 1, c], [-1, -18, 2, 2, c], [2, -17, 2, 1, c]];
      if (view === "front") return [...spikes, [-4, -16, 8, 2, c], [-4, -14, 1, 2, d], [3, -14, 1, 2, d]];
      if (view === "back") return [...spikes, [-4, -16, 8, 6, c]];
      return [...spikes, [-4, -16, 8, 2, c], [-4, -14, 3, 3, d]];
    }
    case "bun":
      if (view === "front") return [[-2, -19, 4, 3, d], [-4, -16, 8, 3, c], [-4, -13, 1, 3, d], [3, -13, 1, 3, d]];
      if (view === "back") return [[-2, -19, 4, 3, d], [-4, -16, 8, 6, c]];
      return [[-3, -19, 4, 3, d], [-4, -16, 8, 3, c], [-4, -13, 3, 3, d]];
    case "cap":
      if (view === "front") return [[-4, -17, 8, 3, c], [-5, -14, 10, 1, d], [-4, -13, 1, 1, under], [3, -13, 1, 1, under]];
      if (view === "back") return [[-4, -17, 8, 4, c], [-4, -13, 8, 2, under]];
      return [[-4, -17, 8, 3, c], [2, -14, 4, 1, d], [-4, -14, 2, 3, under]];
    case "bald":
      return view === "back" ? [[-3, -15, 6, 1, shade(look.skin, -0.1)]] : [];
  }
}

function parts(look: Look, dir: Dir, step: number, sitting: boolean): R[] {
  const skinD = shade(look.skin, -0.14);
  const shirtD = shade(look.shirt, -0.2);
  const pantsD = shade(look.pants, -0.22);
  const view = dir === "down" ? "front" : dir === "up" ? "back" : "side";
  // Sentado: se ocultan las piernas y el cuerpo baja un poco.
  const drop = sitting ? 2 : 0;
  const y = (v: number) => v + drop;
  const rects: R[] = [];

  if (!sitting) {
    if (view === "side") {
      rects.push(
        [-2 - step, -3, 2, 3, pantsD],
        [-2 - step, -1, 2, 1, shade(look.shoes, -0.2)],
        [step, -3, 2, 3, look.pants],
        [step, -1, 3, 1, look.shoes],
      );
    } else {
      const l = step > 0 ? 1 : 0;
      const r = step < 0 ? 1 : 0;
      rects.push(
        [-3, -3, 2, 3 - l, look.pants],
        [-3, -1 - l, 2, 1, look.shoes],
        [1, -3, 2, 3 - r, look.pants],
        [1, -1 - r, 2, 1, look.shoes],
      );
    }
  }

  if (view === "side") {
    rects.push([-2, y(-8), 5, 5, look.shirt], [-2, y(-4), 5, 1, pantsD], [0 + step, y(-8), 2, 4, shirtD], [0 + step, y(-4), 2, 1, look.skin]);
  } else {
    const swing = sitting ? 0 : step;
    rects.push(
      [-4, y(-8) + swing, 1, 4, shirtD],
      [-4, y(-4) + swing, 1, 1, skinD],
      [3, y(-8) - swing, 1, 4, shirtD],
      [3, y(-4) - swing, 1, 1, skinD],
      [-3, y(-8), 6, 5, look.shirt],
      [-3, y(-4), 6, 1, pantsD],
    );
  }

  rects.push([-4, y(-15), 8, 7, look.skin]);
  if (view === "front") rects.push([-2, y(-11), 1, 2, EYES], [1, y(-11), 1, 2, EYES], [-3, y(-9), 1, 1, "#e89a9a"], [2, y(-9), 1, 1, "#e89a9a"]);
  if (view === "side") rects.push([2, y(-11), 1, 2, EYES], [-1, y(-11), 1, 2, skinD]);
  rects.push(...hair(look, view).map(([x, yy, w, h, c]): R => [x, y(yy), w, h, c]));
  return rects;
}

export interface AvatarPose {
  dir: Dir;
  /** Fase de la caminata en [0, 1), o null si está quieto. */
  walk: number | null;
  sitting: boolean;
}

/** Dibuja el personaje con los pies en (x, y). */
export function drawAvatar(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, pose: AvatarPose, alpha = 1) {
  const mirror = pose.dir === "left";
  const phase = pose.walk === null ? 0 : Math.floor(pose.walk * 4);
  const step = pose.walk === null ? 0 : [0, 1, 0, -1][phase]!;
  const bob = pose.walk !== null && (phase === 1 || phase === 3) ? -1 : 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const rects = parts(look, pose.dir, step, pose.sitting);
  const ox = Math.round(x);
  const oy = Math.round(y) + bob;
  const px = (r: R) => (mirror ? ox - (r[0] + r[2]) * U : ox + r[0] * U);
  ctx.fillStyle = OUTLINE;
  for (const r of rects) ctx.fillRect(px(r) - 1, oy + r[1] * U - 1, r[2] * U + 2, r[3] * U + 2);
  for (const r of rects) {
    ctx.fillStyle = r[4];
    ctx.fillRect(px(r), oy + r[1] * U, r[2] * U, r[3] * U);
  }
  ctx.restore();
}

/** Alto aproximado del personaje en píxeles, para ubicar nombres y globos. */
export const avatarHeight = (sitting: boolean) => (sitting ? 36 : 40);
