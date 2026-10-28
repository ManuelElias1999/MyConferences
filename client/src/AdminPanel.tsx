import { useEffect, useState } from "react";
import { COMMUNITIES, PLANS, planOf, type PlanId } from "../../shared/plans.ts";
import type { AdminAccount } from "../../shared/types.ts";
import { accountApi } from "./lib.ts";
import Modal from "./Modal.tsx";

/** Administración: todas las cuentas y el plan de cada una. */
export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<AdminAccount[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    accountApi<AdminAccount[]>("/admin/accounts")
      .then(setList)
      .catch((err: Error) => setError(err.message));
  }, []);

  const change = async (a: AdminAccount, body: { plan?: PlanId; communities?: string[] }) => {
    setBusy(a.id);
    setError("");
    try {
      const updated = await accountApi<AdminAccount>(`/admin/accounts/${a.id}`, { body });
      setList((l) => l?.map((x) => (x.id === a.id ? updated : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar");
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (list ?? []).filter((a) => !q || a.email.includes(q) || a.name.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q));
  const requests = (list ?? []).filter((a) => a.planRequest).length;
  const perPlan = PLANS.map((p) => ({ p, n: (list ?? []).filter((a) => a.plan === p.id).length })).filter((x) => x.n);

  return (
    <Modal title="Administración" onClose={onClose}>
      <p className="muted small">
        Para entrar, todos necesitan una cuenta con el correo confirmado. Cada cuenta empieza con el plan Gratis; aquí le asignas otro cuando pague. Los pedidos
        de la página de planes aparecen marcados.
      </p>
      <input className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo u organización" aria-label="Buscar cuentas" />
      {error && <p className="error">{error}</p>}
      {!list && !error && <p className="muted">Cargando cuentas…</p>}
      {list && (
        <>
          <p className="muted small">
            {list.length} {list.length === 1 ? "cuenta" : "cuentas"} · {perPlan.map(({ p, n }) => `${n} ${p.name}`).join(" · ")}
            {requests > 0 && ` · ${requests} ${requests === 1 ? "pedido" : "pedidos"} de plan`}
          </p>
          <ul className="admin-list">
            {shown.map((a) => (
              <li key={a.id}>
                <div>
                  <p>
                    <b>{a.name}</b> {a.admin && <span className="badge">Administración</span>} {!a.verified && <span className="badge warn">Sin confirmar</span>}{" "}
                    {a.planRequest && <span className="badge warn">Pidió {planOf(a.planRequest).name}</span>}
                  </p>
                  <p className="muted small">
                    {a.email}
                    {a.company && ` · ${a.company}`}
                  </p>
                </div>
                <div className="admin-controls">
                {COMMUNITIES.map((c) => (
                  <label key={c.id} className="check" title={`Puede usar las temáticas exclusivas de ${c.name}`}>
                    <input
                      type="checkbox"
                      checked={a.communities.includes(c.id)}
                      disabled={busy === a.id || !a.verified || a.admin}
                      onChange={(e) =>
                        void change(a, { communities: e.target.checked ? [...a.communities, c.id] : a.communities.filter((x) => x !== c.id) })
                      }
                    />
                    Comunidad {c.name}
                  </label>
                ))}
                <label className="admin-plan">
                  Plan
                  <select value={a.plan} disabled={busy === a.id || !a.verified} onChange={(e) => void change(a, { plan: e.target.value as PlanId })}>
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              </li>
            ))}
            {shown.length === 0 && <li className="muted small">No hay cuentas que coincidan.</li>}
          </ul>
        </>
      )}
    </Modal>
  );
}
