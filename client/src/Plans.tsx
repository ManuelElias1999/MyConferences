import { useState } from "react";
import { ENTERPRISE_PRICES, EXCLUSIVE_THEMES, PLANS, type Plan, type PlanId } from "../../shared/plans.ts";
import { THEMES } from "../../shared/themes.ts";
import type { Account } from "../../shared/types.ts";
import { accountApi } from "./lib.ts";
import Modal from "./Modal.tsx";

const usd = (n: number) => `US$${n.toLocaleString("es-AR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const limit = (n: number | null, none = "—") => (n === null ? "Sin límite" : n === 0 ? none : String(n));
const hours = (h: number) => (h % 24 === 0 ? `Hasta ${h / 24} ${h === 24 ? "día" : "días"}` : `Hasta ${h} horas`);

/** Las temáticas de cada plan, sin contar las exclusivas de una comunidad (van en su propia fila). */
function themesText(p: Plan) {
  const open = THEMES.filter((t) => !EXCLUSIVE_THEMES[t.id]);
  const included = open.filter((t) => !p.themes || p.themes.includes(t.id));
  if (included.length === open.length) return "Todas";
  return included.map((t) => t.label).join(", ");
}

/** Filas de la tabla, por sección. */
const SECTIONS: { title: string; rows: [string, (p: Plan) => string][] }[] = [
  {
    title: "Precio y capacidad",
    rows: [
      ["Precio", (p) => (p.price === null ? `Desde ${usd(ENTERPRISE_PRICES[0]!.price)} por evento` : p.price === 0 ? "Gratis" : `${usd(p.price)}/mes`)],
      ["Personas a la vez por evento", (p) => (p.id === "enterprise" ? `${ENTERPRISE_PRICES[0]!.people} a ${p.people}` : String(p.people))],
    ],
  },
  {
    title: "Eventos y duración",
    rows: [
      ["Eventos", (p) => (p.id === "enterprise" ? "Según contrato" : p.lifetimeEvents !== undefined ? `${p.lifetimeEvents} de prueba` : p.eventsPerMonth === null ? "Sin límite" : `${p.eventsPerMonth} por mes`)],
      ["Charlas y meetups", (p) => hours(p.talkHours)],
      ["Hackathon", (p) => (p.hackathonDays ? `${hours(p.hackathonDays * 24)}` : "— Solo charlas")],
      [
        "Hackathons por mes",
        (p) => (!p.hackathonDays ? "—" : p.hackathonsPerMonth !== null ? `Hasta ${p.hackathonsPerMonth}, dentro de los ${p.eventsPerMonth} eventos` : p.eventsPerMonth !== null ? `Dentro de los ${p.eventsPerMonth} eventos` : "Sin límite"),
      ],
      ["Espacio permanente (siempre abierto, como Starmaker)", (p) => limit(p.permanent)],
    ],
  },
  {
    title: "Lugar y mapa",
    rows: [
      ["Temáticas", themesText],
      ["Temáticas Stellar y Starmaker (oficinas)", () => "Solo la comunidad Stellar"],
      ["Logo propio en el lobby y las pantallas", (p) => (p.logo ? "✔" : "—")],
      ["Mapa diseñado a medida", (p) => p.customMap],
    ],
  },
  {
    title: "Organización y acceso",
    rows: [
      ["Evento abierto (entra cualquiera con el número)", () => "✔"],
      ["Evento privado (lista de correos)", (p) => (p.privateEvents ? "✔" : "—")],
      ["Organizadores, además de ti", (p) => limit(p.staff)],
      ["Mentores", (p) => limit(p.mentors)],
      ["Sponsors con stand", (p) => limit(p.sponsors)],
    ],
  },
  { title: "Soporte", rows: [["Soporte", (p) => p.support]] },
];

/** Página de planes: qué incluye cada uno, cuál tienes y para pedir otro. */
export default function Plans({ account, onChange, onClose }: { account: Account; onChange: (acc: Account) => void; onClose: () => void }) {
  const [busy, setBusy] = useState<PlanId | "cancel" | null>(null);
  const [error, setError] = useState("");

  const request = async (plan: PlanId | null) => {
    setBusy(plan ?? "cancel");
    setError("");
    try {
      const res = await accountApi<{ account: Account }>("/plan/request", { body: { plan } });
      onChange(res.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el pedido");
    } finally {
      setBusy(null);
    }
  };

  const pending = account.planRequest && PLANS.find((p) => p.id === account.planRequest);

  return (
    <Modal title="Planes" onClose={onClose}>
      <p className="muted small">
        Tu plan: <b>{PLANS.find((p) => p.id === account.plan)?.name}</b>. Todavía no se cobra en línea: pides el plan aquí y la administración te contacta para el pago y
        lo activa.
      </p>
      {pending && (
        <p className="plan-pending">
          Pediste el plan <b>{pending.name}</b>. La administración te va a contactar.{" "}
          <button className="link small" onClick={() => void request(null)} disabled={busy !== null}>
            Cancelar pedido
          </button>
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="plans-scroll">
        <table className="plans-table">
          <thead>
            <tr>
              <th />
              {PLANS.map((p) => (
                <th key={p.id} className={p.id === account.plan ? "current" : ""}>
                  <strong>{p.name}</strong>
                  <span className="plan-price">{p.price === null ? "A cotizar" : p.price === 0 ? "US$0" : `${usd(p.price)}/mes`}</span>
                  <span className="plan-pitch">{p.pitch}</span>
                  {p.id === account.plan ? (
                    <span className="badge">Tu plan</span>
                  ) : p.id === "free" ? null : (
                    <button className="btn sm primary" disabled={busy !== null || account.planRequest === p.id} onClick={() => void request(p.id)}>
                      {account.planRequest === p.id ? "Pedido" : busy === p.id ? "Enviando…" : p.id === "enterprise" ? "Cotizar" : "Lo quiero"}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {SECTIONS.map((section) => (
            <tbody key={section.title}>
              <tr className="plans-section">
                <th colSpan={PLANS.length + 1}>{section.title}</th>
              </tr>
              {section.rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {PLANS.map((p) => (
                    <td key={p.id} className={p.id === account.plan ? "current" : ""}>
                      {value(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <h3 className="plans-subtitle">Evento Empresarial: precio según las personas</h3>
      <div className="plans-scroll">
        <table className="plans-table compact">
          <thead>
            <tr>
              <th>Personas a la vez</th>
              <th>Hasta 3 días</th>
              <th>Hasta 7 días (+30%)</th>
              <th>Por persona</th>
            </tr>
          </thead>
          <tbody>
            {ENTERPRISE_PRICES.map((e) => (
              <tr key={e.people}>
                <td>{e.people}</td>
                <td>{usd(e.price)}</td>
                <td>{usd(Math.round(e.price * 1.3))}</td>
                <td>{usd(Math.round((e.price / e.people) * 100) / 100)}</td>
              </tr>
            ))}
            <tr>
              <td>Más de 1000</td>
              <td colSpan={3}>A cotizar</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Incluye mapa a medida con su marca, sin «MyConferences» a la vista, sponsors y equipo sin límite, un ensayo previo y soporte en vivo durante el evento. Pago: 50% al
        confirmar y 50% antes del evento. Cada hackathon cuenta como 1 evento del mes; el espacio permanente no cuenta.
      </p>
    </Modal>
  );
}
