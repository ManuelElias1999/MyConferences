import { useEffect, useRef, useState } from "react";
import { SHOP_ITEMS, SHOP_SLOTS, type ShopItem, type ShopSlot } from "../../shared/shop.ts";
import type { Account, ShopConfig, ShopOrder } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { accountApi, socket } from "./lib.ts";
import Modal from "./Modal.tsx";

const usdc = (n: number | string) => `${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })} USDC`;

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

/** Cómo pagar un pedido: a qué cuenta, cuánto y con qué memo; se revisa solo cada pocos segundos. */
function Payment({
  item,
  initial,
  config,
  onPaid,
  onBack,
}: {
  item: ShopItem;
  initial: ShopOrder;
  config: ShopConfig;
  onPaid: (account: Account) => void;
  onBack: () => void;
}) {
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const paidRef = useRef(onPaid);
  paidRef.current = onPaid;

  // Mientras esté pendiente, se pregunta cada 5 segundos si ya llegó el pago.
  useEffect(() => {
    if (order.status !== "pending" || config.demo) return;
    const timer = setInterval(async () => {
      try {
        const res = await accountApi<{ order: ShopOrder; account?: Account }>(`/shop/orders/${order.id}`);
        setOrder(res.order);
        if (res.account) paidRef.current(res.account);
      } catch {
        // Se vuelve a intentar en la próxima vuelta.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [order.id, order.status, config.demo]);

  const simulate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await accountApi<{ order: ShopOrder; account?: Account }>(`/shop/orders/${order.id}/simulate`, { body: {} });
      setOrder(res.order);
      if (res.account) onPaid(res.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo simular el pago");
    } finally {
      setBusy(false);
    }
  };

  if (order.status === "expired")
    return (
      <div className="pay">
        <p>Este pedido venció sin pago. Puedes volver a comprar la prenda cuando quieras.</p>
        <button className="btn" onClick={onBack}>
          Volver a la tienda
        </button>
      </div>
    );

  return (
    <div className="pay">
      <h3>
        Comprar {item.name} · {usdc(order.amount)}
      </h3>
      {config.demo ? (
        <>
          <p className="muted small">
            La tienda está en <b>modo de prueba</b>: no se cobra. Con la cuenta de Stellar de la plataforma configurada, aquí aparecen la dirección y el memo para pagar con USDC.
          </p>
          <button className="btn primary" onClick={() => void simulate()} disabled={busy}>
            {busy ? "Un momento…" : "Simular el pago"}
          </button>
        </>
      ) : (
        <>
          <p className="small">
            Manda <b>exactamente {usdc(order.amount)}</b> por la red <b>{config.network === "public" ? "Stellar" : "Stellar de pruebas (testnet)"}</b> desde tu wallet (LOBSTR, Freighter, xBull…):
          </p>
          <dl className="pay-fields">
            <dt>A la cuenta</dt>
            <dd>
              <code>{config.receiver}</code>
              <Copy value={config.receiver ?? ""} />
            </dd>
            <dt>Con el memo</dt>
            <dd>
              <code className="pay-memo">{order.memo}</code>
              <Copy value={order.memo} />
            </dd>
            <dt>Monto</dt>
            <dd>
              <code>{order.amount}</code> USDC
            </dd>
          </dl>
          <p className="pay-warning">⚠ Sin el memo no podemos reconocer tu pago.</p>
          {order.payUri && (
            <a className="btn primary" href={order.payUri}>
              Abrir en mi wallet
            </a>
          )}
          <p className="muted small pay-wait">
            <span className="pay-spinner" aria-hidden /> Esperando el pago… lo revisamos solo cada pocos segundos. El pedido vence a la hora.
          </p>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <button className="link small" onClick={onBack}>
        Volver a la tienda
      </button>
    </div>
  );
}

/** Tienda de estilos: prendas extravagantes para el personaje, pagadas con USDC en Stellar. */
export default function Shop({ account, onChange, onClose }: { account: Account; onChange: (account: Account) => void; onClose: () => void }) {
  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [slot, setSlot] = useState<ShopSlot>("outfit");
  const [buying, setBuying] = useState<{ item: ShopItem; order: ShopOrder } | null>(null);
  const [justBought, setJustBought] = useState<ShopItem | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ config: ShopConfig }>("/shop").then(
      (res) => setConfig(res.config),
      (err: Error) => setError(err.message),
    );
  }, []);

  const wearing = (item: ShopItem) => account.look[item.slot] === item.id;

  const wear = (item: ShopItem, on: boolean) => {
    setBusy(item.id);
    setError("");
    socket.emit("setLook", { name: account.name, look: { ...account.look, [item.slot]: on ? item.id : null } }, (res) => {
      setBusy(null);
      if (!res.ok) return setError(res.error);
      onChange(res.data.account);
    });
  };

  const buy = async (item: ShopItem) => {
    setBusy(item.id);
    setError("");
    try {
      const res = await accountApi<{ order: ShopOrder }>("/shop/orders", { body: { itemId: item.id } });
      setBuying({ item, order: res.order });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la compra");
    } finally {
      setBusy(null);
    }
  };

  const paid = (acc: Account) => {
    onChange(acc);
    setJustBought(buying?.item ?? null);
    setBuying(null);
  };

  return (
    <Modal title="Tienda de estilos" onClose={onClose}>
      {buying && config ? (
        <Payment item={buying.item} initial={buying.order} config={config} onPaid={paid} onBack={() => setBuying(null)} />
      ) : (
        <>
          <p className="muted small">
            Prendas para que tu personaje no pase desapercibido. Se pagan una sola vez con <b>USDC en Stellar</b> y quedan tuyas para siempre, en todos los eventos.
          </p>
          {config && !config.enabled && <p className="error">La tienda todavía no está abierta.</p>}
          {justBought && (
            <p className="shop-success">
              ¡Listo! <b>{justBought.name}</b> ya es tuyo.{" "}
              {!wearing(justBought) && (
                <button className="btn sm primary" onClick={() => wear(justBought, true)}>
                  Ponérmelo
                </button>
              )}
            </p>
          )}
          <div className="shop-tabs" role="tablist">
            {SHOP_SLOTS.map((s) => (
              <button key={s.id} role="tab" aria-selected={slot === s.id} className={`chip ${slot === s.id ? "selected" : ""}`} onClick={() => setSlot(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <ul className="shop-grid">
            {SHOP_ITEMS.filter((i) => i.slot === slot).map((item) => {
              const owned = account.wardrobe.includes(item.id);
              const on = wearing(item);
              return (
                <li key={item.id} className={`shop-card ${on ? "wearing" : ""}`}>
                  <div className="shop-preview">
                    <AvatarCanvas look={{ ...account.look, [item.slot]: item.id }} size={110} />
                  </div>
                  <strong>{item.name}</strong>
                  <span className="muted small">{item.description}</span>
                  <div className="shop-actions">
                    {owned ? (
                      <>
                        <span className="badge">{on ? "Lo llevas puesto" : "Es tuyo"}</span>
                        <button className={`btn sm ${on ? "" : "primary"}`} disabled={busy === item.id} onClick={() => wear(item, !on)}>
                          {on ? "Quitármelo" : "Ponérmelo"}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="shop-price">{usdc(item.price)}</span>
                        <button className="btn sm primary" disabled={busy === item.id || !config?.enabled} onClick={() => void buy(item)}>
                          {busy === item.id ? "Un momento…" : "Comprar"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
