import { useEffect, useRef, useState } from "react";
import { venueFloors } from "../../shared/maps.ts";
import { ROOM_COLORS, THEMES, type ThemeId } from "../../shared/themes.ts";
import type { Account, CompanyEvent, EventInput } from "../../shared/types.ts";
import { companyApi } from "./lib.ts";
import { furniDrawables, renderStatic, T } from "./world.ts";

/** Miniatura del lugar del evento con ese estilo. */
function ThemePreview({ theme }: { theme: ThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const map = venueFloors(theme, [
      { id: "a", name: "A", color: "#5b5bf0" },
      { id: "b", name: "B", color: "#06c38d" },
      { id: "c", name: "C", color: "#f59e0b" },
      { id: "d", name: "D", color: "#ec4899" },
    ])[0]!;
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const width = 180;
    const scale = width / (map.w * T);
    canvas.width = width * dpr;
    canvas.height = map.h * T * scale * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.drawImage(renderStatic(map, 1), 0, 0);
    for (const item of furniDrawables(map).sort((a, b) => a.key - b.key)) item.draw(ctx, 0);
  }, [theme]);
  return <canvas ref={ref} className="theme-preview" style={{ width: 180 }} aria-hidden />;
}

type RoomDraft = EventInput["rooms"][number];

const blankRoom = (i: number): RoomDraft => ({ name: "", topic: "", color: ROOM_COLORS[i % ROOM_COLORS.length]! });

function EventEditor({
  initial,
  onSaved,
  onDeleted,
  onVisit,
  canVisit,
}: {
  initial: CompanyEvent | null;
  onSaved: (ev: CompanyEvent) => void;
  onDeleted: (id: string) => void;
  onVisit: (id: string) => void;
  canVisit: boolean;
}) {
  const v = initial?.venue;
  const [name, setName] = useState(v?.name ?? "");
  const [tagline, setTagline] = useState(v?.tagline ?? "");
  const [theme, setTheme] = useState<ThemeId>(v?.theme ?? "tech");
  const [isPrivate, setPrivate] = useState(v?.private ?? true);
  const [whitelist, setWhitelist] = useState((initial?.whitelist ?? []).join("\n"));
  const [rooms, setRooms] = useState<RoomDraft[]>(v?.rooms.map((r) => ({ ...r })) ?? [{ ...blankRoom(0), name: "Sala principal" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const body: EventInput = {
      name,
      tagline,
      theme,
      private: isPrivate,
      whitelist: whitelist.split(/[\s,;]+/).filter(Boolean),
      rooms,
    };
    try {
      const ev = await companyApi<CompanyEvent>(v ? `/events/${v.id}` : "/events", { method: v ? "PUT" : "POST", body });
      onSaved(ev);
      setRooms(ev.venue.rooms.map((r) => ({ ...r })));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!v || !confirm(`¿Cerrar «${v.name}»? Quien esté dentro volverá a recepción y el número dejará de funcionar.`)) return;
    try {
      await companyApi(`/events/${v.id}`, { method: "DELETE" });
      onDeleted(v.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el evento");
    }
  };

  const setRoom = (i: number, patch: Partial<RoomDraft>) => setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="editor-col">
      {v && (
        <div className="share">
          <div>
            <p className="eyebrow">Número del evento</p>
            <p className="share-number">{v.id}</p>
            <p className="muted small">Tus invitados se lo dicen a la recepcionista para entrar.</p>
          </div>
          <button className="btn primary" onClick={() => onVisit(v.id)} disabled={!canVisit} title={canVisit ? "" : "Vuelve a recepción para visitarlo"}>
            Visitar mi evento
          </button>
        </div>
      )}

      <form className="form" onSubmit={save}>
        <div className="form-row">
          <label>
            Nombre del evento
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="DevDays 2026" />
          </label>
          <label>
            Descripción corta
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} placeholder="Un día de charlas sobre IA y cloud" />
          </label>
        </div>

        <fieldset className="themes">
          <legend>Estilo del lugar</legend>
          {THEMES.map((t) => (
            <button key={t.id} type="button" className={`theme-card ${theme === t.id ? "selected" : ""}`} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
              <ThemePreview theme={t.id} />
              <strong>{t.label}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="access">
          <legend>Acceso</legend>
          <label className="check">
            <input type="radio" name="access" checked={isPrivate} onChange={() => setPrivate(true)} />
            Privado: solo entran los correos de la lista
          </label>
          <label className="check">
            <input type="radio" name="access" checked={!isPrivate} onChange={() => setPrivate(false)} />
            Abierto: cualquiera con el número puede entrar
          </label>
          {isPrivate && (
            <label>
              Correos invitados <span className="muted small">(uno por línea o separados por comas)</span>
              <textarea value={whitelist} onChange={(e) => setWhitelist(e.target.value)} rows={4} placeholder={"ana@empresa.com\nluis@empresa.com"} />
            </label>
          )}
        </fieldset>

        <fieldset className="rooms-editor">
          <legend>Salas de charla</legend>
          {rooms.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="room-row" style={{ "--room": r.color } as React.CSSProperties}>
              <span className="room-dot" />
              <input value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} maxLength={40} placeholder="Nombre de la sala" aria-label="Nombre de la sala" required />
              <input value={r.topic} onChange={(e) => setRoom(i, { topic: e.target.value })} maxLength={80} placeholder="Tema" aria-label="Tema de la sala" />
              <select value={r.color} onChange={(e) => setRoom(i, { color: e.target.value })} aria-label="Color de la sala" style={{ color: r.color }}>
                {ROOM_COLORS.map((c) => (
                  <option key={c} value={c} style={{ color: c }}>
                    ■ {c}
                  </option>
                ))}
              </select>
              {r.id && initial?.speakerCodes[r.id] && (
                <span className="code-chip" title="Código de ponente">
                  🎤 {initial.speakerCodes[r.id]}
                </span>
              )}
              <button type="button" className="btn ghost sm" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))} disabled={rooms.length === 1} aria-label="Quitar sala">
                ✕
              </button>
            </div>
          ))}
          {rooms.length < 12 && (
            <button type="button" className="link" onClick={() => setRooms((rs) => [...rs, blankRoom(rs.length)])}>
              ＋ Agregar sala
            </button>
          )}
          <p className="muted small">Cada sala tiene su código de ponente: compártelo con quien va a presentar.</p>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          {v && (
            <button type="button" className="btn ghost danger" onClick={remove}>
              Cerrar evento
            </button>
          )}
          {saved && <span className="saved">Guardado ✓</span>}
          <button className="btn primary" disabled={busy || !name.trim()}>
            {busy ? "Guardando…" : v ? "Guardar cambios" : "Crear evento"}
          </button>
        </div>
      </form>

      {v ? <Sponsors event={initial!} onChange={onSaved} /> : <p className="muted small">Después de crear el evento podrás subir los logos de tus patrocinadores.</p>}
    </div>
  );
}

function Sponsors({ event, onChange }: { event: CompanyEvent; onChange: (ev: CompanyEvent) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = event.venue.id;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const ev = await companyApi<CompanyEvent>(`/events/${id}/sponsors`, {
        method: "POST",
        file,
        headers: { "X-Sponsor-Name": encodeURIComponent(name), "X-Sponsor-Url": encodeURIComponent(url) },
      });
      onChange(ev);
      setName("");
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (sponsorId: string) => {
    try {
      onChange(await companyApi<CompanyEvent>(`/events/${id}/sponsors/${sponsorId}`, { method: "DELETE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar");
    }
  };

  return (
    <section className="sponsors-editor">
      <h3>Patrocinadores</h3>
      <p className="muted small">Sus logos rotan en la pantalla grande del lugar, en los tótems y en las pantallas de cada sala.</p>
      {event.venue.sponsors.length > 0 && (
        <ul className="sponsor-grid editable">
          {event.venue.sponsors.map((s) => (
            <li key={s.id}>
              <img src={s.logoUrl} alt={s.name} />
              <span>{s.name}</span>
              <button className="btn ghost sm" onClick={() => remove(s.id)} aria-label={`Quitar ${s.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="sponsor-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Nombre (ej. Stellar)" aria-label="Nombre del patrocinador" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Sitio web (opcional)" aria-label="Sitio web del patrocinador" />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Logo" required />
        <button className="btn" disabled={busy || !file || !name.trim()}>
          {busy ? "Subiendo…" : "Agregar logo"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default function CompanyPanel({
  account,
  canVisit,
  onVisit,
  onClose,
}: {
  account: Account;
  canVisit: boolean;
  onVisit: (id: string) => void;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<CompanyEvent[] | null>(null);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    companyApi<CompanyEvent[]>("/events").then(
      (list) => {
        setEvents(list);
        setSelected(list[0]?.venue.id ?? "new");
      },
      (err) => setError(err.message),
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const upsert = (ev: CompanyEvent) => {
    setEvents((list) => {
      const rest = (list ?? []).filter((e) => e.venue.id !== ev.venue.id);
      return [...rest, ev].sort((a, b) => a.venue.name.localeCompare(b.venue.name));
    });
    setSelected(ev.venue.id);
  };
  const current = events?.find((e) => e.venue.id === selected) ?? null;
  const themeLabel = (id: string) => THEMES.find((t) => t.id === id)?.label;

  return (
    <div className="company-panel" role="dialog" aria-modal="true" aria-label="Panel de empresa">
      <header className="company-head">
        <div>
          <p className="eyebrow">Panel de empresa</p>
          <h1>{account.company?.name}</h1>
        </div>
        <button className="btn ghost" onClick={onClose}>
          Volver al mundo ✕
        </button>
      </header>
      <div className="company-body">
        <aside className="event-list">
          <button className={`event-card new ${selected === "new" ? "selected" : ""}`} onClick={() => setSelected("new")}>
            ＋ Nuevo evento
          </button>
          {events === null && !error && <p className="muted small">Cargando…</p>}
          {error && <p className="error">{error}</p>}
          {events?.map((e) => (
            <button key={e.venue.id} className={`event-card ${selected === e.venue.id ? "selected" : ""}`} onClick={() => setSelected(e.venue.id)}>
              <span className="event-number">{e.venue.id}</span>
              <strong>{e.venue.name}</strong>
              <span className="muted small">
                {themeLabel(e.venue.theme)} · {e.venue.rooms.length} {e.venue.rooms.length === 1 ? "sala" : "salas"} · {e.venue.private ? "Privado" : "Abierto"}
              </span>
            </button>
          ))}
        </aside>
        {selected && (
          <EventEditor
            key={selected}
            initial={selected === "new" ? null : current}
            onSaved={upsert}
            onDeleted={(id) => {
              setEvents((list) => (list ?? []).filter((e) => e.venue.id !== id));
              setSelected("new");
            }}
            onVisit={onVisit}
            canVisit={canVisit}
          />
        )}
      </div>
    </div>
  );
}
