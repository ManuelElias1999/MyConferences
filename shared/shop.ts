// Ropero del personaje: prendas por parte del cuerpo que se combinan entre sí.
// Las básicas son gratis y se eligen de cualquier color; las especiales se compran una vez con USDC (en Stellar).

export type ShopSlot = "top" | "bottom" | "feet" | "hat" | "glasses" | "back";

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  description: string;
  /** Precio en USDC; 0 es gratis. */
  price: number;
  /** Se elige su color. */
  colorable: boolean;
}

export const SHOP_SLOTS: { id: ShopSlot; label: string; optional: boolean }[] = [
  { id: "top", label: "Arriba", optional: false },
  { id: "bottom", label: "Abajo", optional: false },
  { id: "feet", label: "Zapatos", optional: false },
  { id: "hat", label: "Cabeza", optional: true },
  { id: "glasses", label: "Lentes", optional: true },
  { id: "back", label: "Espalda", optional: true },
];

const free = (id: string, slot: ShopSlot, name: string, description: string): ShopItem => ({ id, slot, name, description, price: 0, colorable: true });
const paid = (id: string, slot: ShopSlot, name: string, description: string, price: number, colorable = false): ShopItem => ({ id, slot, name, description, price, colorable });

export const SHOP_ITEMS: ShopItem[] = [
  free("polera", "top", "Polera", "Manga corta y cuello en V."),
  free("camisa", "top", "Camisa", "Manga larga, cuello y botones."),
  free("buzo", "top", "Buzo", "Con capucha y bolsillo."),
  paid("smoking", "top", "Saco de smoking", "Saco negro, camisa blanca y moño.", 3),
  paid("astronauta", "top", "Traje espacial", "Parte de arriba del traje de astronauta, con panel de control.", 4),
  paid("dorado", "top", "Saco dorado", "Brilla en cualquier pasillo.", 4),
  paid("superheroe", "top", "Traje de superhéroe", "Rojo, con emblema y cinturón dorado.", 3),
  paid("armadura", "top", "Armadura", "Placas de acero y hombreras.", 4),
  paid("hacker", "top", "Buzo hacker", "Oscuro, con detalles de neón.", 2),

  free("pantalon", "bottom", "Pantalón", "Largo, de corte recto."),
  free("shorts", "bottom", "Shorts", "Hasta la rodilla."),
  free("falda", "bottom", "Falda", "Corta y con vuelo."),
  paid("pantalon-smoking", "bottom", "Pantalón de smoking", "Negro, con franja de raso.", 2),
  paid("pantalon-astronauta", "bottom", "Pantalón espacial", "Blanco, con rodilleras.", 2),
  paid("pantalon-armadura", "bottom", "Grebas de armadura", "Placas en las piernas.", 2),

  free("zapatillas", "feet", "Zapatillas", "Cómodas para recorrer el evento."),
  free("botas", "feet", "Botas", "Altas, hasta media pierna."),
  paid("charol", "feet", "Zapatos de charol", "Negros y brillantes.", 1),
  paid("botas-espaciales", "feet", "Botas espaciales", "Grises, de suela gruesa.", 2),

  free("gorro", "hat", "Gorro de lana", "Con pompón."),
  paid("copa", "hat", "Sombrero de copa", "Negro, con cinta roja.", 3),
  paid("corona", "hat", "Corona", "De oro, con tres piedras.", 5),
  paid("vaquero", "hat", "Sombrero vaquero", "De cuero, con el ala curvada.", 2),
  paid("mago", "hat", "Sombrero de mago", "Violeta y con estrellas.", 2),
  paid("casco-astronauta", "hat", "Casco de astronauta", "Con vidrio. Combina con cualquier ropa, también con el smoking.", 4),

  { id: "lentes", slot: "glasses", name: "Lentes", description: "Marco fino.", price: 0, colorable: false },
  paid("lentes-sol", "glasses", "Lentes de sol", "Negros, para mirar el escenario con estilo.", 1),
  paid("visor", "glasses", "Visor futurista", "Una franja de luz celeste.", 2),

  free("mochila", "back", "Mochila", "Para llevar la laptop."),
  paid("capa", "back", "Capa", "Larga, del color que quieras.", 3, true),
  paid("jetpack", "back", "Mochila cohete", "Dos tanques y fuego en las toberas.", 4),
  paid("mochila-oxigeno", "back", "Mochila de oxígeno", "La del traje de astronauta.", 2),
];

/** Lo que lleva puesto quien no eligió nada en las partes obligatorias. */
export const DEFAULT_ITEMS: Record<"top" | "bottom" | "feet", string> = { top: "polera", bottom: "pantalon", feet: "zapatillas" };

export const shopItem = (id: unknown) => SHOP_ITEMS.find((i) => i.id === id);
/** Una prenda válida para esa parte, o null. */
export const itemFor = (slot: ShopSlot, id: unknown) => {
  const item = shopItem(id);
  return item && item.slot === slot ? item.id : null;
};

/** Prendas de antes (cuando un traje era una sola pieza) y lo que equivale ahora. */
export const LEGACY_ITEMS: Record<string, string[]> = {
  smoking: ["smoking", "pantalon-smoking", "charol"],
  astronauta: ["astronauta", "pantalon-astronauta", "botas-espaciales", "casco-astronauta", "mochila-oxigeno"],
  armadura: ["armadura", "pantalon-armadura"],
  superheroe: ["superheroe", "capa"],
  lentes: ["lentes-sol"],
};
