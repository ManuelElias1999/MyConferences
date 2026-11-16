import { DEFAULT_ITEMS, itemFor, LEGACY_ITEMS, shopItem, type ShopSlot } from "./shop.ts";
import type { Beard, HairStyle, Look } from "./types.ts";

export const SKINS = ["#f6d7c3", "#eec1a0", "#d9a07a", "#b9785a", "#8d5a3f", "#5e3b2a"];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Corto" },
  { id: "long", label: "Largo" },
  { id: "spiky", label: "Puntas" },
  { id: "bun", label: "Moño" },
  { id: "cap", label: "Gorra" },
  { id: "bald", label: "Rapado" },
];
export const BEARDS: { id: Beard; label: string }[] = [
  { id: "none", label: "Sin barba" },
  { id: "stubble", label: "Barba corta" },
  { id: "mustache", label: "Bigote" },
  { id: "full", label: "Barba" },
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

/** Colores para gorros, mochilas y capas. */
export const ACCESSORY_COLORS = SHIRTS;

/** Acepta solo valores de las paletas y prendas que existen, para que nadie pueda inyectar colores o prendas. */
export function sanitizeLook(raw: unknown): Look {
  const l = (raw ?? {}) as Partial<Record<keyof Look | "outfit" | "extra", unknown>>;
  // Personajes guardados cuando un traje era una sola pieza (outfit) y había un accesorio (extra).
  const legacy = typeof l.outfit === "string" ? (LEGACY_ITEMS[l.outfit] ?? [l.outfit]) : [];
  const extra = l.extra === "lentes" ? "lentes-sol" : l.extra;
  const from = (slot: ShopSlot, value: unknown) => itemFor(slot, value) ?? legacy.map((id) => itemFor(slot, id)).find(Boolean) ?? null;
  return {
    skin: pick(l.skin, SKINS, DEFAULT_LOOK.skin),
    hair: pick(l.hair, HAIR_STYLES.map((h) => h.id), DEFAULT_LOOK.hair) as HairStyle,
    hairColor: pick(l.hairColor, HAIR_COLORS, DEFAULT_LOOK.hairColor),
    beard: pick(l.beard, BEARDS.map((b) => b.id), "none") as Beard,
    top: from("top", l.top) ?? DEFAULT_ITEMS.top,
    shirt: pick(l.shirt, [...SHIRTS, DEFAULT_LOOK.shirt], DEFAULT_LOOK.shirt),
    bottom: from("bottom", l.bottom) ?? DEFAULT_ITEMS.bottom,
    pants: pick(l.pants, PANTS, DEFAULT_LOOK.pants),
    feet: from("feet", l.feet) ?? DEFAULT_ITEMS.feet,
    shoes: pick(l.shoes, SHOES, DEFAULT_LOOK.shoes),
    hat: from("hat", l.hat),
    hatColor: pick(l.hatColor, ACCESSORY_COLORS, ACCESSORY_COLORS[1]!),
    glasses: itemFor("glasses", l.glasses) ?? itemFor("glasses", extra),
    back: from("back", l.back) ?? itemFor("back", extra),
    backColor: pick(l.backColor, ACCESSORY_COLORS, ACCESSORY_COLORS[0]!),
  };
}

/** Cambia por la básica (o saca) toda prenda paga que la cuenta no compró. */
export function onlyOwned(look: Look, wardrobe: readonly string[]): Look {
  const ok = (id: string | null | undefined) => !id || (shopItem(id)?.price ?? 0) === 0 || wardrobe.includes(id);
  return {
    ...look,
    top: ok(look.top) ? look.top : DEFAULT_ITEMS.top,
    bottom: ok(look.bottom) ? look.bottom : DEFAULT_ITEMS.bottom,
    feet: ok(look.feet) ? look.feet : DEFAULT_ITEMS.feet,
    hat: ok(look.hat) ? look.hat : null,
    glasses: ok(look.glasses) ? look.glasses : null,
    back: ok(look.back) ? look.back : null,
  };
}
