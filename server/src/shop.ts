// Compras de la tienda de estilos con USDC en Stellar.
//
// Cada compra es un pedido con un memo único. Quien compra le manda USDC a la cuenta de la plataforma
// (STELLAR_RECEIVER) con ese memo, y el servidor revisa en Horizon (la API pública de Stellar) que haya
// llegado un pago de USDC con ese memo y al menos el monto del pedido. Ahí la prenda pasa a ser suya.
//
// Sin STELLAR_RECEIVER, fuera de producción, la tienda funciona en modo de prueba: el pago se simula.

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ShopConfig, ShopOrder } from "../../shared/types.ts";

const NETWORKS = {
  testnet: {
    horizon: "https://horizon-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
  public: {
    horizon: "https://horizon.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
} as const;

const ORDER_MS = 60 * 60_000;
const CHECK_EVERY_MS = 4_000;

interface StoredOrder extends ShopOrder {
  accountId: string;
  /** Pago que lo pagó (para no usar el mismo pago dos veces). */
  txHash?: string;
  lastCheck?: number;
}

export function createShop(dataDir: string) {
  const networkName = process.env.STELLAR_NETWORK === "public" ? "public" : "testnet";
  const network = NETWORKS[networkName];
  const receiver = process.env.STELLAR_RECEIVER?.trim() || null;
  const issuer = process.env.USDC_ISSUER?.trim() || network.usdcIssuer;
  const demo = !receiver && process.env.NODE_ENV !== "production";
  const config: ShopConfig = { enabled: Boolean(receiver) || demo, demo, network: networkName, receiver, assetCode: "USDC", assetIssuer: issuer };
  if (receiver && !/^G[A-Z2-7]{55}$/.test(receiver)) console.warn("[tienda] STELLAR_RECEIVER no parece una cuenta de Stellar (empieza con G y tiene 56 caracteres)");
  console.log(receiver ? `[tienda] Cobros en USDC (${networkName}) a ${receiver}` : demo ? "[tienda] Sin STELLAR_RECEIVER: modo de prueba, los pagos se simulan." : "[tienda] Sin STELLAR_RECEIVER: la tienda está cerrada.");

  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "orders.json");
  const orders: StoredOrder[] = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as StoredOrder[]) : [];
  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.then(async () => {
      await writeFile(`${file}.tmp`, JSON.stringify(orders, null, 2));
      await rename(`${file}.tmp`, file);
    });
    return writing;
  };

  /** Enlace SEP-7: lo abren las wallets (LOBSTR, Freighter, xBull…) con el pago ya cargado. */
  const payUri = (o: ShopOrder) => {
    const params: Record<string, string> = {
      destination: receiver ?? "",
      amount: o.amount,
      asset_code: "USDC",
      asset_issuer: issuer,
      memo: o.memo,
      memo_type: "MEMO_TEXT",
      network_passphrase: network.passphrase,
    };
    // SEP-7 pide los valores codificados con %20 (no con «+», que algunas wallets leen literal).
    return `web+stellar:pay?${Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
  };

  const view = (o: StoredOrder): ShopOrder => ({ id: o.id, itemId: o.itemId, amount: o.amount, memo: o.memo, status: o.status, createdAt: o.createdAt, expiresAt: o.expiresAt, payUri: receiver ? payUri(o) : null });

  /** Busca en Horizon un pago de USDC a la cuenta de la plataforma con el memo del pedido. */
  async function findPayment(o: StoredOrder) {
    const url = `${network.horizon}/accounts/${receiver}/payments?order=desc&limit=100&join=transactions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Horizon respondió ${res.status}`);
    const data = (await res.json()) as {
      _embedded?: {
        records?: {
          type: string;
          to?: string;
          asset_code?: string;
          asset_issuer?: string;
          amount?: string;
          transaction_hash: string;
          transaction_successful?: boolean;
          created_at: string;
          transaction?: { memo?: string; memo_type?: string; successful?: boolean };
        }[];
      };
    };
    const used = new Set(orders.flatMap((x) => (x.txHash ? [x.txHash] : [])));
    return (data._embedded?.records ?? []).find(
      (p) =>
        (p.type === "payment" || p.type === "path_payment_strict_receive" || p.type === "path_payment_strict_send") &&
        p.to === receiver &&
        p.asset_code === "USDC" &&
        p.asset_issuer === issuer &&
        Number(p.amount) >= Number(o.amount) &&
        p.transaction?.memo === o.memo &&
        p.transaction?.successful !== false &&
        Date.parse(p.created_at) >= o.createdAt - 60_000 &&
        !used.has(p.transaction_hash),
    );
  }

  return {
    config,

    async create(accountId: string, itemId: string, price: number) {
      // Si ya hay un pedido pendiente de esa prenda, se reutiliza (mismo memo).
      const open = orders.find((o) => o.accountId === accountId && o.itemId === itemId && o.status === "pending" && o.expiresAt > Date.now());
      if (open) return view(open);
      const order: StoredOrder = {
        id: randomUUID(),
        accountId,
        itemId,
        amount: price.toFixed(2),
        // Memo de texto corto (Stellar admite hasta 28 bytes): MC- y 10 caracteres al azar.
        memo: `MC-${randomBytes(5).toString("hex").toUpperCase()}`,
        status: "pending",
        createdAt: Date.now(),
        expiresAt: Date.now() + ORDER_MS,
        payUri: null,
      };
      orders.push(order);
      await persist();
      return view(order);
    },

    /** Revisa si el pedido ya se pagó. Devuelve el pedido y, si se acaba de pagar, `paidNow`. */
    async check(accountId: string, orderId: string, simulate = false) {
      const o = orders.find((x) => x.id === orderId && x.accountId === accountId);
      if (!o) return null;
      if (o.status !== "pending") return { order: view(o), paidNow: false };
      if (o.expiresAt < Date.now()) {
        o.status = "expired";
        await persist();
        return { order: view(o), paidNow: false };
      }
      if (demo && simulate) {
        o.status = "paid";
        o.txHash = `demo-${o.id}`;
        await persist();
        return { order: view(o), paidNow: true };
      }
      if (!receiver || (o.lastCheck && Date.now() - o.lastCheck < CHECK_EVERY_MS)) return { order: view(o), paidNow: false };
      o.lastCheck = Date.now();
      try {
        const payment = await findPayment(o);
        if (payment) {
          o.status = "paid";
          o.txHash = payment.transaction_hash;
          await persist();
          return { order: view(o), paidNow: true };
        }
      } catch (err) {
        console.warn("[tienda] No se pudo revisar el pago en Horizon:", err instanceof Error ? err.message : err);
      }
      return { order: view(o), paidNow: false };
    },
  };
}
