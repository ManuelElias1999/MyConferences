import { useEffect, useState } from "react";
import type { AdminAccount } from "../../shared/types.ts";
import { accountApi } from "./lib.ts";
import Modal from "./Modal.tsx";

/** Administración: todas las cuentas y quién puede crear eventos. */
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

  const toggle = async (a: AdminAccount) => {
    setBusy(a.id);
    setError("");
    try {
      const updated = await accountApi<AdminAccount>(`/admin/accounts/${a.id}`, { body: { canCreateEvents: !a.canCreateEvents } });
      setList((l) => l?.map((x) => (x.id === a.id ? updated : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar");
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (list ?? []).filter((a) => !q || a.email.includes(q) || a.name.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q));
  const creators = (list ?? []).filter((a) => a.canCreateEvents).length;

  return (
    <Modal title="Administración" onClose={onClose}>
      <p className="muted small">
        Para entrar, todos necesitan una cuenta con el correo confirmado. Crear eventos solo pueden las cuentas que habilites aquí (y la administración).
      </p>
      <input className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo u organización" aria-label="Buscar cuentas" />
      {error && <p className="error">{error}</p>}
      {!list && !error && <p className="muted">Cargando cuentas…</p>}
      {list && (
        <>
          <p className="muted small">
            {list.length} {list.length === 1 ? "cuenta" : "cuentas"} · {creators} pueden crear eventos
          </p>
          <ul className="admin-list">
            {shown.map((a) => (
              <li key={a.id}>
                <div>
                  <p>
                    <b>{a.name}</b> {a.admin && <span className="badge">Administración</span>} {!a.verified && <span className="badge warn">Sin confirmar</span>}
                  </p>
                  <p className="muted small">
                    {a.email}
                    {a.company && ` · ${a.company}`}
                  </p>
                </div>
                {a.admin ? (
                  <span className="muted small">Siempre puede crear eventos</span>
                ) : (
                  <label className="check">
                    <input type="checkbox" checked={a.canCreateEvents} disabled={busy === a.id || !a.verified} onChange={() => void toggle(a)} />
                    Puede crear eventos
                  </label>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="muted small">No hay cuentas que coincidan.</li>}
          </ul>
        </>
      )}
    </Modal>
  );
}
