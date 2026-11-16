// Pago de una prenda con USDC en Stellar (o simulado, en modo de prueba).

import { useEffect, useRef, useState } from "react";
import type { ShopItem } from "../../shared/shop.ts";
import type { Account, ShopConfig, ShopOrder } from "../../shared/types.ts";
import { accountApi } from "./lib.ts";

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
export function Payment({
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
          Volver
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
        Volver a la ropa
      </button>
    </div>
  );
}
