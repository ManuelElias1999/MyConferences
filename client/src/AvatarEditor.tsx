import { useEffect, useState } from "react";
import { ACCESSORY_COLORS, BEARDS, HAIR_COLORS, HAIR_STYLES, PANTS, SHIRTS, SHOES, SKINS } from "../../shared/look.ts";
import type { Dir } from "../../shared/maps.ts";
import { DEFAULT_ITEMS, SHOP_ITEMS, SHOP_SLOTS, shopItem, type ShopItem, type ShopSlot } from "../../shared/shop.ts";
import type { Account, Look, ShopConfig, ShopOrder } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { accountApi, socket } from "./lib.ts";
import Modal from "./Modal.tsx";
import { Payment } from "./Payment.tsx";

const TURN: Dir[] = ["down", "left", "up", "right"];

/** Dónde se guarda la prenda de cada parte, y de dónde sale su color. */
const SLOT_KEYS: Record<ShopSlot, { item: keyof Look; color?: keyof Look; palette?: string[]; colorLabel?: string }> = {
  top: { item: "top", color: "shirt", palette: SHIRTS, colorLabel: "Color de arriba" },
  bottom: { item: "bottom", color: "pants", palette: PANTS, colorLabel: "Color de abajo" },
  feet: { item: "feet", color: "shoes", palette: SHOES, colorLabel: "Color del calzado" },
  hat: { item: "hat", color: "hatColor", palette: ACCESSORY_COLORS, colorLabel: "Color" },
  glasses: { item: "glasses" },
  back: { item: "back", color: "backColor", palette: ACCESSORY_COLORS, colorLabel: "Color" },
};

const usdc = (n: number) => `${n.toLocaleString("es-AR")} USDC`;

function Swatches({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="swatches">
      <legend>{label}</legend>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${c === value ? "selected" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`${label} ${c}`}
          aria-pressed={c === value}
        />
      ))}
    </fieldset>
  );
}

/**
 * Mi personaje: la apariencia (piel, pelo, barba) y la ropa por partes. Las prendas básicas son gratis y de cualquier
 * color; las especiales se pueden probar y, para guardarlas, se compran con USDC.
 */
export default function AvatarEditor({
  account,
  welcome,
  tab: initialTab = "look",
  onSaved,
  onAccount,
  onClose,
}: {
  account: Account;
  welcome: boolean;
  tab?: "look" | "clothes";
  onSaved: (account: Account) => void;
  /** La cuenta cambió sin cerrar el editor (por ejemplo, después de comprar una prenda). */
  onAccount: (account: Account) => void;
  onClose: () => void;
}) {
  const [look, setLook] = useState<Look>(account.look);
  const [name, setName] = useState(account.name);
  const [dir, setDir] = useState<Dir>("down");
  const [tab, setTab] = useState(initialTab);
  const [slot, setSlot] = useState<ShopSlot>("top");
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [buying, setBuying] = useState<{ item: ShopItem; order: ShopOrder } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const turn = (by: number) => setDir((d) => TURN[(TURN.indexOf(d) + by + TURN.length) % TURN.length]!);
  const set = <K extends keyof Look>(key: K) => (value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));

  useEffect(() => {
    accountApi<{ config: ShopConfig }>("/shop").then(
      (res) => setConfig(res.config),
      () => {},
    );
  }, []);

  const owns = (item: ShopItem) => item.price === 0 || account.wardrobe.includes(item.id);
  const keys = SLOT_KEYS[slot];
  const current = (look[keys.item] as string | null | undefined) ?? (slot in DEFAULT_ITEMS ? DEFAULT_ITEMS[slot as keyof typeof DEFAULT_ITEMS] : null);
  const currentItem = current ? shopItem(current) : undefined;
  // Prendas pagas que lleva puestas y todavía no compró: se pueden probar, pero para guardar hay que comprarlas.
  const locked = SHOP_SLOTS.map((s) => shopItem(look[SLOT_KEYS[s.id].item]))
    .filter((i): i is ShopItem => Boolean(i) && !owns(i!));

  const buy = async (item: ShopItem) => {
    setError("");
    try {
      const res = await accountApi<{ order: ShopOrder }>("/shop/orders", { body: { itemId: item.id } });
      setBuying({ item, order: res.order });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la compra");
    }
  };

  const save = () => {
    if (locked.length) return setError(`Para guardar, compra primero: ${locked.map((i) => i.name).join(", ")}. O cámbialo por otra prenda.`);
    setBusy(true);
    setError("");
    socket.emit("setLook", { name, look }, (res) => {
      setBusy(false);
      if (!res.ok) return setError(res.error);
      onSaved(res.data.account);
    });
  };

  const tryOn = (s: ShopSlot, id: string | null) => setLook((l) => ({ ...l, [SLOT_KEYS[s].item]: id }));

  return (
    <Modal title={welcome ? "Crea tu personaje" : "Mi personaje"} onClose={onClose}>
      <div className="editor">
        <div className="editor-preview">
          <AvatarCanvas look={look} dir={dir} size={200} />
          <div className="editor-rotate">
            <button className="btn sm" onClick={() => turn(-1)} aria-label="Girar a la izquierda">
              ↺
            </button>
            <button className="btn sm" onClick={() => turn(1)} aria-label="Girar a la derecha">
              ↻
            </button>
          </div>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          </label>
        </div>

        <div className="editor-options">
          {buying && config ? (
            <Payment
              item={buying.item}
              initial={buying.order}
              config={config}
              onPaid={(acc) => {
                onAccount(acc);
                setBuying(null);
              }}
              onBack={() => setBuying(null)}
            />
          ) : (
            <>
              <div className="editor-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "look"} className={tab === "look" ? "active" : ""} onClick={() => setTab("look")}>
                  Apariencia
                </button>
                <button role="tab" aria-selected={tab === "clothes"} className={tab === "clothes" ? "active" : ""} onClick={() => setTab("clothes")}>
                  Ropa
                </button>
              </div>

              {tab === "look" ? (
                <>
                  <fieldset className="styles">
                    <legend>Peinado</legend>
                    {HAIR_STYLES.map((h) => (
                      <button key={h.id} type="button" className={`chip ${look.hair === h.id ? "selected" : ""}`} onClick={() => set("hair")(h.id)} aria-pressed={look.hair === h.id}>
                        {h.label}
                      </button>
                    ))}
                  </fieldset>
                  <Swatches label={look.hair === "cap" ? "Color de la gorra" : "Color de pelo"} options={HAIR_COLORS} value={look.hairColor} onChange={set("hairColor")} />
                  <Swatches label="Piel" options={SKINS} value={look.skin} onChange={set("skin")} />
                  <fieldset className="styles">
                    <legend>Barba</legend>
                    {BEARDS.map((b) => (
                      <button key={b.id} type="button" className={`chip ${(look.beard ?? "none") === b.id ? "selected" : ""}`} onClick={() => set("beard")(b.id)} aria-pressed={(look.beard ?? "none") === b.id}>
                        {b.label}
                      </button>
                    ))}
                  </fieldset>
                </>
              ) : (
                <>
                  <div className="shop-tabs">
                    {SHOP_SLOTS.map((s) => (
                      <button key={s.id} type="button" className={`chip ${slot === s.id ? "selected" : ""}`} onClick={() => setSlot(s.id)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <ul className="wardrobe-grid">
                    {SHOP_SLOTS.find((s) => s.id === slot)!.optional && (
                      <li>
                        <button type="button" className={`wardrobe-card ${!current ? "selected" : ""}`} onClick={() => tryOn(slot, null)}>
                          <AvatarCanvas look={{ ...look, [keys.item]: null }} size={64} />
                          <span>Nada</span>
                        </button>
                      </li>
                    )}
                    {SHOP_ITEMS.filter((i) => i.slot === slot).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`wardrobe-card ${current === item.id ? "selected" : ""} ${owns(item) ? "" : "locked"}`}
                          onClick={() => tryOn(slot, item.id)}
                          title={item.description}
                        >
                          <AvatarCanvas look={{ ...look, [keys.item]: item.id }} size={64} />
                          <span>{item.name}</span>
                          <small className={item.price === 0 ? "free" : owns(item) ? "mine" : "price"}>
                            {item.price === 0 ? "Gratis" : owns(item) ? "Tuyo" : `🔒 ${usdc(item.price)}`}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {currentItem && <p className="muted small">{currentItem.description}</p>}
                  {currentItem && !owns(currentItem) && (
                    <p className="wardrobe-buy">
                      Te la estás probando. Para usarla, cómprala una vez y queda tuya para siempre.{" "}
                      <button type="button" className="btn sm primary" disabled={!config?.enabled} onClick={() => void buy(currentItem)}>
                        Comprar · {usdc(currentItem.price)}
                      </button>
                    </p>
                  )}
                  {currentItem?.colorable && keys.color && keys.palette && (
                    <Swatches label={keys.colorLabel ?? "Color"} options={keys.palette} value={(look[keys.color] as string | undefined) ?? keys.palette[0]!} onChange={(c) => setLook((l) => ({ ...l, [keys.color!]: c }))} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!buying && (
        <div className="modal-actions">
          {locked.length > 0 && <span className="muted small wardrobe-note">Te estás probando prendas sin comprar ({locked.map((i) => i.name).join(", ")}).</span>}
          <button className="btn ghost" onClick={onClose}>
            {welcome ? "Más tarde" : "Cancelar"}
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Guardando…" : "Guardar personaje"}
          </button>
        </div>
      )}
    </Modal>
  );
}
