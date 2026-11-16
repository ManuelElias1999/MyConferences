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

// ---------- Ropa ----------

/** El personaje ya vestido: colores fijos de las prendas especiales y forma de mangas, piernas y calzado. */
interface Dress extends Look {
  sleeves: "short" | "long";
  legs: "long" | "shorts" | "skirt";
  boots: boolean;
}

const TOP_STYLE: Record<string, { color?: string; sleeves: Dress["sleeves"] }> = {
  polera: { sleeves: "short" },
  camisa: { sleeves: "long" },
  buzo: { sleeves: "long" },
  smoking: { color: "#1d1d26", sleeves: "long" },
  astronauta: { color: "#eef2f6", sleeves: "long" },
  dorado: { color: "#d6a92e", sleeves: "long" },
  superheroe: { color: "#d62839", sleeves: "long" },
  armadura: { color: "#a9b3c1", sleeves: "long" },
  hacker: { color: "#1f2430", sleeves: "long" },
};
const BOTTOM_STYLE: Record<string, { color?: string; legs: Dress["legs"] }> = {
  pantalon: { legs: "long" },
  shorts: { legs: "shorts" },
  falda: { legs: "skirt" },
  "pantalon-smoking": { color: "#1d1d26", legs: "long" },
  "pantalon-astronauta": { color: "#dde3ea", legs: "long" },
  "pantalon-armadura": { color: "#8d97a6", legs: "long" },
};
const FEET_STYLE: Record<string, { color?: string; boots: boolean }> = {
  zapatillas: { boots: false },
  botas: { boots: true },
  charol: { color: "#0d0d12", boots: false },
  "botas-espaciales": { color: "#9aa3b5", boots: true },
};

function dress(look: Look): Dress {
  const top = TOP_STYLE[look.top ?? "polera"] ?? TOP_STYLE.polera!;
  const bottom = BOTTOM_STYLE[look.bottom ?? "pantalon"] ?? BOTTOM_STYLE.pantalon!;
  const feet = FEET_STYLE[look.feet ?? "zapatillas"] ?? FEET_STYLE.zapatillas!;
  // Con casco no se ve el pelo; con sombrero, el pelo alto se aplasta.
  let hair = look.hair;
  if (look.hat === "casco-astronauta") hair = "bald";
  else if (look.hat && (hair === "spiky" || hair === "bun" || hair === "cap")) hair = "short";
  return {
    ...look,
    hair,
    shirt: top.color ?? look.shirt,
    pants: bottom.color ?? look.pants,
    shoes: feet.color ?? look.shoes,
    sleeves: top.sleeves,
    legs: bottom.legs,
    boots: feet.boots,
  };
}

/** Personaje de perfil mirando a la derecha (para la izquierda se refleja). */
function sideBlocks(look: Dress, step: number, sitting: boolean): B[] {
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
  const long = look.sleeves === "long";

  if (!sitting) {
    // Pierna de atrás más oscura; al caminar se cruzan hacia adelante y atrás. Con shorts o falda se ve la piel.
    const bare = look.legs !== "long";
    const shoeTop = look.boots ? -7 : -4;
    const shoeH = look.boots ? 6 : 3;
    for (const [x, front] of [
      [-3 - step, false],
      [-2 + step, true],
    ] as const) {
      const cloth = front ? pants : pantsD;
      const leg = front ? skin : skinDeep;
      if (look.legs === "shorts") out.push([x, -12, 5, 4, cloth], [x, -8, 5, 5, leg]);
      else if (bare) out.push([x, -12, 5, 9, leg]);
      else out.push([x, -12, 5, 9, cloth]);
      if (front && !bare) out.push(detail(x, -12, 1, 8, shade(pants, 0.15)));
      out.push([x, shoeTop, front ? 8 : 7, shoeH, front ? look.shoes : shade(look.shoes, -0.15)], detail(x, -1, front ? 8 : 7, 1, sole));
      if (front) out.push(detail(x + 6, shoeTop, 2, 1, shade(look.shoes, 0.3)));
    }
  }
  const swing = sitting ? 0 : step;
  const upper: B[] = [
    ...h.back,
    // Brazo de atrás.
    ...(long
      ? [[-2 - swing, -25, 4, 9, shade(shirt, -0.32)] as B, [-2 - swing, -16, 4, 2, skinDeep] as B]
      : [[-2 - swing, -25, 4, 6, shade(shirt, -0.32)] as B, [-2 - swing, -19, 4, 5, skinDeep] as B]),
    // Torso de costado, más angosto.
    [-5, -26, 11, 15, shirt],
    detail(-5, -26, 11, 2, shirtL),
    detail(3, -24, 3, 12, shirtD),
    detail(-5, -13, 11, 1, shirtD),
    [-5, -12, 11, 2, pantsD],
    ...(look.legs === "skirt" ? [[-6, -13, 13, 5, pants] as B, detail(-6, -9, 13, 1, pantsD)] : []),
    // Brazo de adelante, balanceándose.
    ...(long
      ? [[-1 + swing, -25, 4, 9, shirtD] as B, detail(-1 + swing, -25, 4, 1, shirtL), [-1 + swing, -16, 4, 2, skin] as B]
      : [[-1 + swing, -25, 4, 7, shirtD] as B, detail(-1 + swing, -25, 4, 1, shirtL), [-1 + swing, -18, 4, 4, skin] as B, detail(-1 + swing, -15, 4, 1, skinSide)]),
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

function blocks(look: Dress, dir: Dir, step: number, sitting: boolean): B[] {
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
    const shoeTop = look.boots ? 7 : 4;
    for (const [x, up] of [
      [-7, liftL],
      [1, liftR],
    ] as const) {
      if (look.legs === "long") out.push([x, -12, 6, 9 - up, pants], detail(x, -12, 1, 8 - up, pantsL), detail(x + 5, -12, 1, 8 - up, pantsD));
      else if (look.legs === "shorts") out.push([x, -12, 6, 4, pants], detail(x, -12, 1, 4, pantsL), [x, -8, 6, 5 - up, skin], detail(x + 5, -8, 1, 4 - up, skinSide));
      else out.push([x, -12, 6, 9 - up, skin], detail(x + 5, -12, 1, 8 - up, skinSide));
      out.push([x, -shoeTop - up, 6, shoeTop - 1, look.shoes], detail(x, -1 - up, 6, 1, sole), detail(x + 1, -shoeTop - up, 2, 1, shade(look.shoes, 0.3)));
    }
  }

  const swing = sitting ? 0 : step;
  const upper: B[] = [...h.back];
  // Mangas cortas con el antebrazo a la vista, o largas hasta la mano.
  if (look.sleeves === "long")
    upper.push(
      [-12, -25 + swing, 4, 10, shirtD],
      [-12, -15 + swing, 4, 2, skin],
      [8, -25 - swing, 4, 10, shirtD],
      [8, -15 - swing, 4, 2, skinSide],
    );
  else
    upper.push(
      [-12, -25 + swing, 4, 6, shirtD],
      [-12, -19 + swing, 4, 6, skin],
      detail(-12, -14 + swing, 4, 1, skinSide),
      [8, -25 - swing, 4, 6, shirtD],
      [8, -19 - swing, 4, 6, skinSide],
    );
  upper.push(
    [-8, -26, 16, 15, shirt],
    detail(-8, -26, 16, 2, shirtL),
    detail(-8, -24, 2, 11, shirtL),
    detail(5, -24, 3, 11, shirtD),
    detail(-8, -13, 16, 1, shirtD),
    [-8, -12, 16, 2, pantsD],
  );
  if (look.legs === "skirt") upper.push([-9, -13, 18, 5, pants], detail(-9, -13, 18, 1, pantsL), detail(-9, -9, 18, 1, pantsD), detail(-3, -12, 1, 3, pantsD), detail(3, -12, 1, 3, pantsD));
  else if (view === "front") upper.push(detail(-1, -12, 3, 2, "#e0b84a"));
  if (view === "back") upper.push(detail(-3, -26, 6, 1, skinSide));

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

// ---------- Capas de cada prenda ----------

type Side = "front" | "back" | "side";

/** Lo que va detrás del cuerpo (capas, mochilas) y lo que va encima. */
interface Layers {
  behind: B[];
  over: B[];
}

const NONE: Layers = { behind: [], over: [] };
const GLASS = "rgba(125,211,252,0.28)";
const SHINE = "rgba(255,255,255,0.7)";

function topLayers(d: Dress, side: Side): Layers {
  const c = d.shirt;
  switch (d.top ?? "polera") {
    case "polera":
      // Cuello en V con solapas.
      if (side === "front")
        return { behind: [], over: [detail(-3, -26, 6, 2, d.skin), detail(-2, -24, 4, 1, d.skin), detail(-1, -23, 2, 1, d.skin), detail(-4, -26, 1, 3, shade(c, 0.18)), detail(3, -26, 1, 3, shade(c, 0.18))] };
      return NONE;
    case "camisa":
      if (side === "front")
        return { behind: [], over: [detail(-2, -26, 4, 2, d.skin), detail(-5, -26, 4, 2, shade(c, 0.3)), detail(1, -26, 4, 2, shade(c, 0.3)), detail(0, -24, 1, 11, shade(c, -0.25)), detail(1, -22, 1, 1, "#f4f4f5"), detail(1, -18, 1, 1, "#f4f4f5"), detail(1, -14, 1, 1, "#f4f4f5")] };
      if (side === "side") return { behind: [], over: [detail(1, -26, 4, 2, shade(c, 0.3))] };
      return { behind: [], over: [detail(-5, -27, 10, 2, shade(c, 0.3))] };
    case "buzo": {
      const hood = shade(c, -0.22);
      if (side === "front")
        return { behind: [], over: [detail(-7, -27, 14, 2, hood), detail(-2, -25, 1, 4, "#f4f4f5"), detail(1, -25, 1, 4, "#f4f4f5"), detail(-5, -18, 10, 3, hood)] };
      if (side === "back") return { behind: [], over: [[-7, -30, 14, 5, hood]] };
      return { behind: [], over: [[-8, -31, 5, 7, hood]] };
    }
    case "smoking":
      if (side === "front")
        return {
          behind: [],
          over: [
            detail(-2, -26, 4, 10, "#f4f4f5"),
            detail(-4, -23, 2, 7, "#2e2e3a"),
            detail(2, -23, 2, 7, "#2e2e3a"),
            detail(-4, -25, 3, 2, "#0b0b0f"),
            detail(1, -25, 3, 2, "#0b0b0f"),
            detail(-1, -25, 2, 2, "#2a2a33"),
            detail(-1, -21, 1, 1, "#9ca3af"),
            detail(-1, -18, 1, 1, "#9ca3af"),
            detail(-7, -22, 2, 1, "#e5484d"),
          ],
        };
      if (side === "side") return { behind: [], over: [detail(3, -26, 3, 7, "#f4f4f5"), detail(4, -25, 2, 2, "#0b0b0f")] };
      return NONE;
    case "astronauta":
      if (side === "front")
        return { behind: [], over: [detail(-4, -22, 8, 5, "#c7d0db"), detail(-3, -21, 2, 1, "#e5484d"), detail(0, -21, 1, 1, "#22c55e"), detail(2, -21, 1, 1, "#2f6bff"), detail(-12, -24, 3, 2, "#2f6bff")] };
      if (side === "side") return { behind: [], over: [detail(0, -24, 3, 2, "#2f6bff")] };
      return NONE;
    case "dorado": {
      const spark = "#fff6c2";
      if (side === "front") return { behind: [], over: [detail(-2, -26, 4, 7, "#1d1d26"), detail(-6, -22, 1, 1, spark), detail(5, -19, 1, 1, spark), detail(-3, -15, 1, 1, spark), detail(3, -24, 1, 1, spark)] };
      return { behind: [], over: [detail(0, -21, 1, 1, spark), detail(-3, -16, 1, 1, spark), detail(4, -24, 1, 1, spark)] };
    }
    case "superheroe":
      if (side === "front") return { behind: [], over: [detail(-3, -23, 6, 5, "#fbbf24"), detail(-2, -22, 4, 3, "#d62839"), detail(-1, -21, 2, 1, "#fbbf24"), detail(-8, -13, 16, 1, "#fbbf24")] };
      if (side === "side") return { behind: [], over: [detail(-5, -13, 11, 1, "#fbbf24"), detail(2, -22, 3, 4, "#fbbf24")] };
      return { behind: [], over: [detail(-8, -13, 16, 1, "#fbbf24")] };
    case "armadura":
      if (side === "side") return { behind: [], over: [[-3, -27, 7, 4, "#cbd5e1"], detail(-2, -26, 5, 1, "#e5e9f0")] };
      return {
        behind: [],
        over: [
          [-13, -27, 6, 4, "#cbd5e1"],
          [7, -27, 6, 4, "#cbd5e1"],
          detail(-12, -26, 4, 1, "#e5e9f0"),
          detail(8, -26, 4, 1, "#e5e9f0"),
          ...(side === "front" ? [detail(-1, -25, 2, 11, "#d7dee7"), detail(-6, -24, 1, 1, "#6b7280"), detail(5, -24, 1, 1, "#6b7280")] : []),
        ],
      };
    case "hacker": {
      const neon = "#22d3ee";
      if (side === "front") return { behind: [], over: [detail(-9, -27, 18, 2, "#2a3142"), detail(-3, -25, 1, 4, neon), detail(2, -25, 1, 4, neon), detail(-4, -18, 8, 3, "#262c3a"), detail(-8, -14, 16, 1, neon)] };
      if (side === "back") return { behind: [], over: [[-8, -30, 16, 5, "#2a3142"], detail(-8, -14, 16, 1, neon)] };
      return { behind: [], over: [[-9, -31, 5, 7, "#2a3142"], detail(-5, -14, 11, 1, neon)] };
    }
  }
  return NONE;
}

/** Detalles en las piernas (solo de pie: sentado no se ven). */
function bottomLayers(d: Dress, side: Side): B[] {
  if (side === "side") {
    if (d.bottom === "pantalon-astronauta") return [detail(-1, -8, 4, 2, "#c7d0db")];
    if (d.bottom === "pantalon-armadura") return [detail(-1, -10, 4, 3, "#cbd5e1")];
    return [];
  }
  switch (d.bottom) {
    case "pantalon-smoking":
      return [detail(-7, -12, 1, 8, "#3a3a48"), detail(6, -12, 1, 8, "#3a3a48")];
    case "pantalon-astronauta":
      return [detail(-6, -8, 4, 2, "#c7d0db"), detail(2, -8, 4, 2, "#c7d0db")];
    case "pantalon-armadura":
      return [detail(-6, -10, 4, 3, "#cbd5e1"), detail(2, -10, 4, 3, "#cbd5e1")];
  }
  return [];
}

function beardLayers(d: Dress, side: Side): B[] {
  const hc = shade(d.hairColor, -0.1);
  if (side === "back" || !d.beard || d.beard === "none") return [];
  if (side === "side") {
    if (d.beard === "stubble") return [detail(0, -31, 8, 4, "rgba(40,25,15,0.22)")];
    if (d.beard === "mustache") return [detail(4, -31, 4, 1, hc)];
    return [detail(-3, -33, 3, 6, hc), detail(-1, -28, 9, 2, hc), detail(4, -31, 4, 1, hc)];
  }
  if (d.beard === "stubble") return [detail(-7, -31, 14, 4, "rgba(40,25,15,0.22)")];
  if (d.beard === "mustache") return [detail(-4, -31, 8, 1, hc)];
  return [detail(-9, -34, 2, 7, hc), detail(7, -34, 2, 7, hc), detail(-9, -28, 18, 2, hc), detail(-4, -31, 8, 1, hc)];
}

function glassesLayers(id: string, side: Side): B[] {
  const dark = "#1f2937";
  switch (id) {
    case "lentes":
      if (side === "front")
        return [
          detail(-8, -38, 6, 1, dark), detail(-8, -33, 6, 1, dark), detail(-8, -37, 1, 4, dark), detail(-3, -37, 1, 4, dark),
          detail(2, -38, 6, 1, dark), detail(2, -33, 6, 1, dark), detail(2, -37, 1, 4, dark), detail(7, -37, 1, 4, dark),
          detail(-2, -37, 4, 1, dark),
        ];
      if (side === "side") return [detail(2, -38, 5, 1, dark), detail(2, -33, 5, 1, dark), detail(6, -37, 1, 4, dark), detail(-3, -37, 5, 1, dark)];
      return [];
    case "lentes-sol":
      if (side === "front") return [detail(-8, -38, 6, 3, "#111318"), detail(2, -38, 6, 3, "#111318"), detail(-2, -37, 4, 1, "#111318"), detail(-7, -38, 2, 1, "#4b5563"), detail(3, -38, 2, 1, "#4b5563")];
      if (side === "side") return [detail(2, -38, 5, 3, "#111318"), detail(-3, -37, 5, 1, "#111318")];
      return [detail(-9, -37, 18, 1, "#111318")];
    case "visor":
      if (side === "front") return [detail(-10, -38, 20, 3, "rgba(34,211,238,0.85)"), detail(-8, -38, 5, 1, SHINE)];
      if (side === "side") return [detail(-1, -38, 10, 3, "rgba(34,211,238,0.85)")];
      return [detail(-10, -37, 20, 1, "#0e7490")];
  }
  return [];
}

function hatLayers(d: Dress, side: Side): B[] {
  const narrow = side === "side";
  switch (d.hat) {
    case "gorro": {
      const c = d.hatColor ?? "#e5484d";
      return narrow
        ? [[-9, -53, 18, 8, c], detail(-9, -47, 18, 2, shade(c, -0.2)), [-3, -57, 5, 4, shade(c, 0.3)]]
        : [[-10, -53, 20, 8, c], detail(-10, -47, 20, 2, shade(c, -0.2)), detail(-6, -52, 1, 4, shade(c, 0.15)), detail(0, -52, 1, 4, shade(c, 0.15)), detail(5, -52, 1, 4, shade(c, 0.15)), [-3, -57, 6, 4, shade(c, 0.3)]];
    }
    case "copa":
      return narrow
        ? [[-7, -61, 14, 12, "#16161d"], detail(-7, -52, 14, 2, "#b91c1c"), [-10, -50, 20, 2, "#16161d"]]
        : [[-8, -61, 16, 12, "#16161d"], detail(-8, -52, 16, 2, "#b91c1c"), detail(-6, -60, 2, 7, "#2e2e3a"), [-11, -50, 22, 2, "#16161d"]];
    case "corona": {
      const gold = "#f5c518";
      return narrow
        ? [[-7, -52, 14, 4, gold], [-7, -56, 3, 4, gold], [-1, -58, 3, 6, gold], [4, -56, 3, 4, gold], detail(-6, -52, 12, 1, "#ffe58a"), detail(0, -51, 2, 2, "#e5484d")]
        : [[-8, -52, 16, 4, gold], [-8, -56, 3, 4, gold], [-2, -58, 4, 6, gold], [5, -56, 3, 4, gold], detail(-7, -52, 14, 1, "#ffe58a"), detail(-1, -51, 2, 2, "#e5484d"), detail(-6, -51, 2, 1, "#2f6bff"), detail(4, -51, 2, 1, "#10b981")];
    }
    case "vaquero":
      return narrow
        ? [[-6, -56, 12, 7, "#8b5a2b"], detail(-6, -51, 12, 1, "#3b2414"), [-12, -50, 24, 3, "#7a4b22"]]
        : [[-7, -56, 14, 7, "#8b5a2b"], detail(-1, -56, 2, 2, "#6f4520"), detail(-7, -51, 14, 1, "#3b2414"), [-14, -50, 28, 3, "#7a4b22"], [-14, -52, 2, 2, "#7a4b22"], [12, -52, 2, 2, "#7a4b22"]];
    case "mago": {
      const star = "#fde68a";
      return [
        [-8, -53, 16, 4, "#4c1d95"],
        [-6, -57, 12, 4, "#4c1d95"],
        [-4, -61, 8, 4, "#5b21b6"],
        [-2, -65, 4, 4, "#5b21b6"],
        [narrow ? 1 : 0, -67, 3, 2, "#5b21b6"],
        detail(-4, -56, 1, 1, star),
        detail(2, -60, 1, 1, star),
        detail(-1, -52, 1, 1, star),
        [-11, -50, 22, 2, "#3b0f7a"],
      ];
    }
    case "casco-astronauta":
      // Marco blanco y vidrio sobre la cara (de espaldas, la parte de atrás del casco).
      if (side === "front")
        return [[-12, -51, 24, 3, "#f1f5f9"], [-12, -48, 3, 21, "#f1f5f9"], [9, -48, 3, 21, "#e2e8f0"], [-12, -28, 24, 3, "#cbd5e1"], detail(-9, -48, 18, 20, GLASS), detail(-8, -47, 2, 6, SHINE), detail(-5, -47, 1, 2, SHINE)];
      if (side === "back") return [[-12, -51, 24, 26, "#f1f5f9"], detail(-10, -49, 6, 2, "#ffffff")];
      return [[-10, -51, 21, 3, "#f1f5f9"], [-10, -48, 4, 21, "#f1f5f9"], [-10, -28, 21, 3, "#cbd5e1"], [9, -48, 2, 21, "#e2e8f0"], detail(-6, -48, 15, 20, GLASS), detail(5, -47, 2, 5, SHINE)];
  }
  return [];
}

function backLayers(d: Dress, side: Side): Layers {
  const c = d.backColor ?? "#5b5bf0";
  switch (d.back) {
    case "mochila":
      if (side === "front") return { behind: [], over: [detail(-7, -26, 2, 11, shade(c, -0.2)), detail(5, -26, 2, 11, shade(c, -0.2))] };
      if (side === "back") return { behind: [], over: [[-6, -25, 12, 12, c], detail(-6, -25, 12, 1, shade(c, 0.2)), detail(-4, -21, 8, 3, shade(c, -0.15))] };
      return { behind: [[-10, -25, 5, 11, c]], over: [] };
    case "capa": {
      const trim = shade(c, -0.3);
      if (side === "front") return { behind: [[-11, -27, 22, 23, shade(c, -0.15)]], over: [] };
      if (side === "back") return { behind: [], over: [[-10, -27, 20, 24, c], detail(-10, -27, 20, 2, trim), detail(-10, -5, 20, 1, trim), detail(-1, -24, 2, 18, shade(c, -0.12))] };
      return { behind: [[-10, -26, 6, 22, shade(c, -0.15)], detail(-10, -5, 6, 1, trim)], over: [] };
    }
    case "jetpack": {
      const tank = "#9aa3b5";
      const fire = "#f97316";
      if (side === "back")
        return {
          behind: [],
          over: [[-8, -26, 6, 13, tank], [2, -26, 6, 13, tank], detail(-8, -26, 6, 2, "#cbd5e1"), detail(2, -26, 6, 2, "#cbd5e1"), [-7, -13, 4, 3, fire], [3, -13, 4, 3, fire], detail(-6, -10, 2, 2, "#fde047"), detail(4, -10, 2, 2, "#fde047")],
        };
      if (side === "front") return { behind: [[-10, -30, 4, 6, tank], [6, -30, 4, 6, tank]], over: [] };
      return { behind: [[-11, -26, 6, 13, tank], [-10, -13, 4, 3, fire], detail(-9, -10, 2, 2, "#fde047")], over: [] };
    }
    case "mochila-oxigeno":
      if (side === "back") return { behind: [], over: [[-7, -25, 14, 12, "#c7d0db"], detail(-5, -23, 10, 1, "#9aa3b5"), detail(-5, -20, 10, 1, "#9aa3b5")] };
      if (side === "side") return { behind: [[-10, -25, 5, 12, "#c7d0db"]], over: [] };
      return NONE;
  }
  return NONE;
}

/** Bloques del personaje vestido: lo de atrás primero, después el cuerpo, y encima ropa, barba, lentes y sombrero. */
function dressedBlocks(look: Look, dir: Dir, step: number, sitting: boolean): B[] {
  const d = dress(look);
  const base = blocks(d, dir, step, sitting);
  const side: Side = dir === "down" ? "front" : dir === "up" ? "back" : "side";
  const drop = sitting ? 4 : 0;
  const lift = (b: B): B => [b[0], b[1] + drop, b[2], b[3], b[4], b[5]];
  const top = topLayers(d, side);
  const back = backLayers(d, side);
  const legs = sitting ? [] : bottomLayers(d, side);
  const over = [...top.over, ...beardLayers(d, side), ...(d.glasses ? glassesLayers(d.glasses, side) : []), ...back.over, ...hatLayers(d, side)];
  return [...[...back.behind, ...top.behind].map(lift), ...base, ...legs, ...over.map(lift)];
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
  const list = dressedBlocks(look, pose.dir, step, pose.sitting);
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

/** Lo que suma cada sombrero al alto del personaje. */
const HAT_HEIGHT: Record<string, number> = { gorro: 9, copa: 13, corona: 10, vaquero: 8, mago: 19, "casco-astronauta": 3 };

/** Alto aproximado del personaje en píxeles, para ubicar nombres y globos (más alto con sombrero). */
export const avatarHeight = (sitting: boolean, look?: Look) => (sitting ? 48 : 52) + (look?.hat ? (HAT_HEIGHT[look.hat] ?? 0) : 0);
