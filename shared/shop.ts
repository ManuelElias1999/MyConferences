// Tienda de estilos: prendas para el personaje que se compran con USDC (en Stellar).
// Cada prenda va en un lugar: traje (cambia toda la ropa), sombrero o accesorio.

export type ShopSlot = "outfit" | "hat" | "extra";

export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  description: string;
  /** Precio en USDC. */
  price: number;
}

export const SHOP_SLOTS: { id: ShopSlot; label: string }[] = [
  { id: "outfit", label: "Trajes" },
  { id: "hat", label: "Sombreros" },
  { id: "extra", label: "Accesorios" },
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: "smoking", slot: "outfit", name: "Smoking", description: "Saco negro, camisa blanca y moño. Para la gala de clausura.", price: 4 },
  { id: "astronauta", slot: "outfit", name: "Astronauta", description: "Traje espacial con casco de vidrio y mochila de oxígeno.", price: 8 },
  { id: "dorado", slot: "outfit", name: "Traje dorado", description: "Brilla en cualquier pasillo. Imposible pasar desapercibido.", price: 6 },
  { id: "superheroe", slot: "outfit", name: "Superhéroe", description: "Traje rojo y azul con emblema, cinturón y capa.", price: 6 },
  { id: "armadura", slot: "outfit", name: "Armadura", description: "Placas de acero y hombreras, para la temática medieval.", price: 7 },
  { id: "hacker", slot: "outfit", name: "Buzo hacker", description: "Buzo oscuro con detalles de neón, ideal para la hackathon.", price: 3 },
  { id: "copa", slot: "hat", name: "Sombrero de copa", description: "Negro, con cinta roja. Combina con el smoking.", price: 3 },
  { id: "corona", slot: "hat", name: "Corona", description: "De oro, con tres piedras.", price: 5 },
  { id: "vaquero", slot: "hat", name: "Sombrero vaquero", description: "De cuero, con el ala curvada.", price: 3 },
  { id: "mago", slot: "hat", name: "Sombrero de mago", description: "Violeta y con estrellas.", price: 3 },
  { id: "lentes", slot: "extra", name: "Lentes de sol", description: "Negros, para mirar el escenario con estilo.", price: 2 },
  { id: "capa", slot: "extra", name: "Capa real", description: "Violeta con borde dorado.", price: 4 },
  { id: "jetpack", slot: "extra", name: "Mochila cohete", description: "Dos tanques y fuego en las toberas.", price: 5 },
];

export const shopItem = (id: unknown) => SHOP_ITEMS.find((i) => i.id === id);
/** Una prenda válida para ese lugar, o null. */
export const itemFor = (slot: ShopSlot, id: unknown) => {
  const item = shopItem(id);
  return item && item.slot === slot ? item.id : null;
};
