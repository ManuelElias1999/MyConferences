import type { HairStyle, Look } from "./types.ts";

export const SKINS = ["#f6d7c3", "#eec1a0", "#d9a07a", "#b9785a", "#8d5a3f", "#5e3b2a"];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Corto" },
  { id: "long", label: "Largo" },
  { id: "spiky", label: "Puntas" },
  { id: "bun", label: "Moño" },
  { id: "cap", label: "Gorra" },
  { id: "bald", label: "Rapado" },
];
export const HAIR_COLORS = ["#2b1d14", "#5a3825", "#8a5a2b", "#d9a441", "#e8d39a", "#b8401f", "#9aa0a6", "#6c4bd8"];
export const SHIRTS = ["#5b5bf0", "#e5484d", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6", "#f1f1f1", "#2d2f3a", "#14b8a6"];
export const PANTS = ["#2b3a67", "#1f2430", "#5a4632", "#6b7280", "#7c2d12", "#365314", "#e7e2d6", "#3b82f6"];
export const SHOES = ["#1b1b1f", "#f4f4f5", "#8b4513", "#dc2626"];

/** Personaje con el que entran los invitados. */
export const DEFAULT_LOOK: Look = {
  skin: SKINS[1]!,
  hair: "short",
  hairColor: HAIR_COLORS[1]!,
  shirt: "#9aa3b5",
  pants: PANTS[0]!,
  shoes: SHOES[0]!,
};

export const RECEPTIONIST_LOOK: Look = {
  skin: SKINS[2]!,
  hair: "bun",
  hairColor: HAIR_COLORS[0]!,
  shirt: "#b8325a",
  pants: PANTS[1]!,
  shoes: SHOES[0]!,
};

const pick = (value: unknown, options: readonly string[], fallback: string) =>
  typeof value === "string" && options.includes(value) ? value : fallback;

/** Acepta solo valores de las paletas para que nadie pueda inyectar colores arbitrarios. */
export function sanitizeLook(raw: unknown): Look {
  const l = (raw ?? {}) as Partial<Record<keyof Look, unknown>>;
  return {
    skin: pick(l.skin, SKINS, DEFAULT_LOOK.skin),
    hair: pick(l.hair, HAIR_STYLES.map((h) => h.id), DEFAULT_LOOK.hair) as HairStyle,
    hairColor: pick(l.hairColor, HAIR_COLORS, DEFAULT_LOOK.hairColor),
    shirt: pick(l.shirt, [...SHIRTS, DEFAULT_LOOK.shirt], DEFAULT_LOOK.shirt),
    pants: pick(l.pants, PANTS, DEFAULT_LOOK.pants),
    shoes: pick(l.shoes, SHOES, DEFAULT_LOOK.shoes),
  };
}
