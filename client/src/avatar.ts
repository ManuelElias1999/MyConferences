// Personaje visto desde arriba al estilo Gather: cabeza grande, formas redondeadas
// con contorno y cuatro direcciones. El origen son los pies y y crece hacia abajo.

import type { Dir } from "../../shared/maps.ts";
import type { Look } from "../../shared/types.ts";

const OUTLINE = "#2a2238";
const EYES = "#2a2238";
const UNDER_CAP = "#3a2a1e";

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

function ell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, stroke = true) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

function poly(ctx: Ctx, pts: [number, number][], fill: string, stroke = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

const spikes = (ctx: Ctx, color: string, shift = 0) =>
  poly(
    ctx,
    [
      [-10.5, -40],
      [-9 + shift, -50],
      [-5, -45],
      [-1 + shift, -53],
      [2, -46],
      [7 + shift, -51],
      [10.5, -40],
    ],
    color,
  );

/** Pelo que va detrás de la cabeza (melena larga y moño). */
function hairBack(ctx: Ctx, look: Look, view: "front" | "back" | "side") {
  const c = look.hairColor;
  if (look.hair === "long") {
    if (view === "side") rr(ctx, -11.5, -42, 10, 22, 5, shade(c, -0.12));
    else rr(ctx, -12.5, -44, 25, 27, 9, shade(c, -0.12));
  }
  if (look.hair === "bun") ell(ctx, view === "side" ? -6 : 0, -49, 5.5, 5, shade(c, -0.08));
}

/** Pelo por delante de la cabeza. */
function hairFront(ctx: Ctx, look: Look, view: "front" | "back" | "side") {
  const c = look.hairColor;
  const d = shade(c, -0.18);
  switch (look.hair) {
    case "short":
    case "long":
    case "bun":
      if (view === "back") {
        rr(ctx, -10.8, -47, 21.6, look.hair === "long" ? 22 : 17, 9, c);
        return;
      }
      rr(ctx, -10.8, -47.5, 21.6, 11, 8, c);
      if (view === "front") {
        // Flequillo con algunos mechones.
        poly(
          ctx,
          [
            [-10.2, -39],
            [-6.5, -35.5],
            [-3, -38.5],
            [0.5, -35],
            [4, -38.5],
            [7.5, -35.8],
            [10.2, -39],
          ],
          c,
          false,
        );
        rr(ctx, -10.8, -41, 3.2, look.hair === "long" ? 16 : 8, 1.5, d);
        rr(ctx, 7.6, -41, 3.2, look.hair === "long" ? 16 : 8, 1.5, d);
      } else {
        rr(ctx, -10.8, -42, 8, look.hair === "long" ? 20 : 10, 4, d);
      }
      return;
    case "spiky":
      spikes(ctx, c, view === "side" ? -1.5 : 0);
      if (view === "back") rr(ctx, -10.8, -45, 21.6, 15, 8, c);
      else if (view === "side") rr(ctx, -10.8, -43, 7, 10, 3, d);
      return;
    case "cap":
      if (view === "back") rr(ctx, -10.5, -37, 21, 6, 3, UNDER_CAP);
      if (view === "side") rr(ctx, -10.5, -40, 6, 8, 3, UNDER_CAP);
      rr(ctx, -11, -48, 22, 12, 8, c);
      ell(ctx, 0, -46, 2, 1.3, shade(c, 0.35), false);
      if (view === "front") rr(ctx, -12, -39, 24, 4, 2, d);
      if (view === "side") rr(ctx, 5, -39.5, 11, 3.5, 1.7, d);
      return;
    case "bald":
      if (view !== "back") ell(ctx, -3.5, -42, 3.5, 1.6, "rgba(255,255,255,0.35)", false);
      return;
  }
}

export interface AvatarPose {
  dir: Dir;
  /** Fase de la caminata en [0, 1), o null si está quieto. */
  walk: number | null;
  sitting: boolean;
}

/** Dibuja el personaje con los pies en (x, y). */
export function drawAvatar(ctx: Ctx, look: Look, x: number, y: number, pose: AvatarPose, alpha = 1) {
  const view = pose.dir === "down" ? "front" : pose.dir === "up" ? "back" : "side";
  const phase = pose.walk === null ? 0 : Math.sin(pose.walk * Math.PI * 2);
  const step = Math.round(phase * 2);
  const bob = pose.walk === null ? 0 : -Math.abs(phase) * 1.2;
  const skinD = shade(look.skin, -0.12);
  const shirtD = shade(look.shirt, -0.16);
  const pantsD = shade(look.pants, -0.2);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ell(ctx, 0, -1, 11, 4, "rgba(30,25,45,0.22)", false);
  if (pose.dir === "left") ctx.scale(-1, 1);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;

  // Piernas (se ocultan al estar sentado).
  if (!pose.sitting) {
    if (view === "side") {
      rr(ctx, -4 - step, -12, 5, 10, 2, pantsD);
      rr(ctx, -4 - step, -4.5, 7, 4.5, 2, shade(look.shoes, -0.15));
      rr(ctx, -1 + step, -12, 5, 10, 2, look.pants);
      rr(ctx, -1 + step, -4.5, 8, 4.5, 2, look.shoes);
    } else {
      const liftL = step > 0 ? 2 : 0;
      const liftR = step < 0 ? 2 : 0;
      rr(ctx, -6.5, -12, 5.5, 10 - liftL, 2, look.pants);
      rr(ctx, 1, -12, 5.5, 10 - liftR, 2, look.pants);
      rr(ctx, -7.5, -4.5 - liftL, 7, 4.5, 2, look.shoes);
      rr(ctx, 0.5, -4.5 - liftR, 7, 4.5, 2, look.shoes);
    }
  }

  ctx.translate(0, (pose.sitting ? 4 : 0) + bob);
  const swing = pose.sitting ? 0 : step;
  hairBack(ctx, look, view);

  if (view === "side") {
    rr(ctx, -2.5 - swing, -24, 4.5, 12, 2.2, shade(look.shirt, -0.28));
    rr(ctx, -6.5, -25, 13, 15, 6, look.shirt);
    rr(ctx, 1.5, -24, 4, 13, 3, shirtD, false);
    rr(ctx, -2.5 + swing, -24, 4.5, 12, 2.2, shirtD);
    ell(ctx, -0.2 + swing, -11.5, 2.5, 2.5, look.skin);
  } else {
    rr(ctx, -11, -24 + swing, 4.5, 12, 2.2, shirtD);
    rr(ctx, 6.5, -24 - swing, 4.5, 12, 2.2, shirtD);
    ell(ctx, -8.8, -11.5 + swing, 2.6, 2.6, look.skin);
    ell(ctx, 8.8, -11.5 - swing, 2.6, 2.6, look.skin);
    rr(ctx, -8, -25, 16, 15, 6, look.shirt);
    rr(ctx, 2.5, -23.5, 4, 12, 2.5, shirtD, false);
    rr(ctx, -6, -23, 2.5, 7, 1.5, shade(look.shirt, 0.25), false);
    if (view === "front") poly(ctx, [[-3, -25], [3, -25], [0, -21.5]], look.skin, false);
  }

  // Cabeza.
  if (view === "front") {
    ell(ctx, -10, -34, 2.6, 3, look.skin);
    ell(ctx, 10, -34, 2.6, 3, look.skin);
  }
  rr(ctx, -10, -45, 20, 20, 9, look.skin);
  if (view === "front") {
    ell(ctx, -4, -34, 1.9, 2.5, EYES, false);
    ell(ctx, 4, -34, 1.9, 2.5, EYES, false);
    ell(ctx, -3.3, -34.9, 0.8, 0.8, "#ffffff", false);
    ell(ctx, 4.7, -34.9, 0.8, 0.8, "#ffffff", false);
    ell(ctx, -6.8, -30.5, 2.1, 1.2, "rgba(255,120,130,0.4)", false);
    ell(ctx, 6.8, -30.5, 2.1, 1.2, "rgba(255,120,130,0.4)", false);
    ctx.beginPath();
    ctx.arc(0, -30.5, 2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.lineWidth = 1.5;
  } else if (view === "side") {
    ell(ctx, 5, -34, 1.9, 2.5, EYES, false);
    ell(ctx, 5.7, -34.9, 0.8, 0.8, "#ffffff", false);
    ell(ctx, 7.5, -30.5, 1.8, 1.1, "rgba(255,120,130,0.4)", false);
    ell(ctx, -2.5, -33.5, 2.4, 2.8, skinD);
  }
  hairFront(ctx, look, view);
  ctx.restore();
}

/** Alto aproximado del personaje en píxeles, para ubicar nombres y globos. */
export const avatarHeight = (sitting: boolean) => (sitting ? 46 : 50);
