import { useEffect, useRef, useState } from "react";
import { ROOMS_PER_FLOOR, maxRoomsFor, minRoomsFor, venueFloors } from "../../shared/maps.ts";
import { firstPlanWithTheme, monthUsage, planOf, themeAllowed, type Plan, type PlanUsage } from "../../shared/plans.ts";
import { ROOM_COLORS, THEMES, type ThemeId } from "../../shared/themes.ts";
import { HACKATHON_CAPACITIES, type Account, type CompanyEvent, type EventInput, type TalkInput } from "../../shared/types.ts";
import { accountApi, companyApi, loadToken } from "./lib.ts";
import Modal from "./Modal.tsx";
import { furniDrawables, renderStatic, T } from "./world.ts";

/** Miniatura del recinto completo del evento con ese estilo. */
function ThemePreview({ theme }: { theme: ThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sample = ["#ff5c39", "#2f6bff", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"].map((color, i) => ({
      id: `s${i}`,
      name: i ? `Sala ${i}` : "Auditorio",
      color,
      main: i === 0,
    }));
    const map = venueFloors(theme, sample)[0]!;
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

const blankRoom = (i: number): RoomDraft => ({ name: "", topic: "", color: ROOM_COLORS[i % ROOM_COLORS.length]!, talks: [] });

const HOUR = 3_600_000;

/** "2026-10-06T18:30" en hora local, para los campos de fecha y hora. */
function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const nextHour = () => Math.ceil(Date.now() / HOUR) * HOUR;

/** Duraciones que se pueden elegir según el plan: horas para charlas, días para hackathons. */
function durationOptions(plan: Plan, hackathon: boolean) {
  if (hackathon) return Array.from({ length: plan.hackathonDays }, (_, i) => (i + 1) * 24);
  return [1, 2, 3, 4, 6, 8, 12, 24, 48, 72].filter((h) => h <= plan.talkHours);
}
const durationLabel = (h: number) => (h % 24 === 0 ? `${h / 24} ${h === 24 ? "día" : "días"}` : `${h} ${h === 1 ? "hora" : "horas"}`);

/** Si el error es por el plan, junto al mensaje aparece el botón para ver los planes. */
const PlanError = ({ text, onPlans }: { text: string; onPlans: () => void }) => (
  <p className="error">
    {text}{" "}
    {text.startsWith("Con el plan") && (
      <button type="button" className="link small" onClick={onPlans}>
        Ver planes
      </button>
    )}
  </p>
);

/** Agenda de una sala: cada charla con título, ponente, inicio y duración. */
function TalksEditor({ talks, onChange }: { talks: TalkInput[]; onChange: (talks: TalkInput[]) => void }) {
  const set = (i: number, patch: Partial<TalkInput>) => onChange(talks.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="talks-editor">
      {talks.map((t, i) => (
        <div key={i} className="talk-row">
          <input value={t.title} onChange={(e) => set(i, { title: e.target.value })} maxLength={100} placeholder="Título de la charla" aria-label="Título de la charla" required />
          <input value={t.speaker} onChange={(e) => set(i, { speaker: e.target.value })} maxLength={60} placeholder="Ponente" aria-label="Ponente" />
          <input
            type="datetime-local"
            value={toLocalInput(t.start)}
            onChange={(e) => {
              const start = new Date(e.target.value).getTime();
              if (Number.isFinite(start)) set(i, { start, end: start + (t.end - t.start) });
            }}
            aria-label="Inicio"
            required
          />
          <select value={Math.round((t.end - t.start) / 60_000)} onChange={(e) => set(i, { end: t.start + Number(e.target.value) * 60_000 })} aria-label="Duración">
            {[15, 20, 30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <button type="button" className="btn ghost sm" onClick={() => onChange(talks.filter((_, j) => j !== i))} aria-label="Quitar charla">
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="link small"
        onClick={() => {
          const last = talks[talks.length - 1];
          const start = last ? last.end + 15 * 60_000 : nextHour();
          onChange([...talks, { title: "", speaker: "", start, end: start + 45 * 60_000 }]);
        }}
      >
        ＋ Agregar charla
      </button>
    </div>
  );
}

function EventEditor({
  initial,
  plan,
  onSaved,
  onDeleted,
  onVisit,
  onPlans,
  canVisit,
}: {
  initial: CompanyEvent | null;
  plan: Plan;
  onSaved: (ev: CompanyEvent) => void;
  onDeleted: (id: string) => void;
  onVisit: (id: string) => void;
  onPlans: () => void;
  canVisit: boolean;
}) {
  const v = initial?.venue;
  const [name, setName] = useState(v?.name ?? "");
  const [tagline, setTagline] = useState(v?.tagline ?? "");
  const [theme, setTheme] = useState<ThemeId>(v?.theme ?? "tech");
  const [capacity, setCapacity] = useState(v?.capacity ?? 100);
  const [isPrivate, setPrivate] = useState(v?.private ?? plan.privateEvents);
  // Cuándo: con fecha (inicio y duración) o espacio permanente. Los eventos de antes, sin fecha, se muestran como permanentes.
  const [permanent, setPermanent] = useState(v ? !v.schedule : false);
  const [start, setStart] = useState(v?.schedule?.start ?? nextHour());
  const [hours, setHours] = useState(v?.schedule ? Math.round((v.schedule.end - v.schedule.start) / HOUR) : 2);
  const options = durationOptions(plan, theme === "hackathon");
  const duration = options.includes(hours) ? hours : (options.filter((h) => h <= hours).at(-1) ?? options[0] ?? 1);
  const [whitelist, setWhitelist] = useState((initial?.whitelist ?? []).join("\n"));
  const [staff, setStaff] = useState((initial?.staff ?? []).join("\n"));
  const [mentors, setMentors] = useState((initial?.mentors ?? []).join("\n"));
  const draftsFrom = (ev: CompanyEvent): RoomDraft[] =>
    ev.venue.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      topic: r.topic,
      color: r.color,
      theme: r.theme ?? null,
      talks: ev.venue.talks.filter((t) => t.roomId === r.id).map(({ title, speaker, start, end }) => ({ title, speaker, start, end })),
    }));
  const [rooms, setRooms] = useState<RoomDraft[]>(
    initial
      ? draftsFrom(initial)
      : [
          { ...blankRoom(0), name: "Auditorio principal", topic: "Charlas principales" },
          ...Array.from({ length: ROOMS_PER_FLOOR }, (_, i) => ({ ...blankRoom(i + 1), name: `Sala ${i + 1}` })),
        ],
  );
  const [openAgenda, setOpenAgenda] = useState<number | null>(0);
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
      capacity: theme === "hackathon" ? capacity : undefined,
      schedule: permanent ? null : { start, end: start + duration * HOUR },
      private: isPrivate,
      whitelist: whitelist.split(/[\s,;]+/).filter(Boolean),
      staff: staff.split(/[\s,;]+/).filter(Boolean),
      mentors: mentors.split(/[\s,;]+/).filter(Boolean),
      rooms,
    };
    try {
      const ev = await companyApi<CompanyEvent>(v ? `/events/${v.id}` : "/events", { method: v ? "PUT" : "POST", body });
      onSaved(ev);
      setRooms(draftsFrom(ev));
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
          {THEMES.map((t) => {
            const allowed = themeAllowed(plan, t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-card ${theme === t.id ? "selected" : ""} ${allowed ? "" : "locked"}`}
                aria-pressed={theme === t.id}
                disabled={!allowed && theme !== t.id}
                onClick={() => {
                  setTheme(t.id);
                  // Si la temática admite menos salas (por ejemplo, las oficinas Starmaker), se quitan las que sobran del final.
                  setRooms((rs) => rs.slice(0, maxRoomsFor(t.id)));
                  if (t.id === "hackathon") setHours(Math.min(72, plan.hackathonDays * 24));
                }}
              >
                <ThemePreview theme={t.id} />
                <strong>{t.label}</strong>
                <span>{t.description}</span>
                {!allowed && <span className="theme-limit">🔒 Desde el plan {firstPlanWithTheme(t.id).name}</span>}
              </button>
            );
          })}
        </fieldset>

        <fieldset className="schedule">
          <legend>Cuándo</legend>
          <label className="check">
            <input type="radio" name="when" checked={!permanent} onChange={() => setPermanent(false)} />
            Con fecha: abre y cierra a una hora
          </label>
          <label className={`check ${plan.permanent ? "" : "locked"}`}>
            <input type="radio" name="when" checked={permanent} disabled={!plan.permanent && !permanent} onChange={() => setPermanent(true)} />
            Espacio permanente: siempre abierto, como unas oficinas {!plan.permanent && <span className="muted small">🔒 Desde el plan Comunidad</span>}
          </label>
          {!permanent && (
            <div className="form-row">
              <label>
                Empieza
                <input
                  type="datetime-local"
                  value={toLocalInput(start)}
                  onChange={(e) => {
                    const ms = new Date(e.target.value).getTime();
                    if (Number.isFinite(ms)) setStart(ms);
                  }}
                  required
                />
              </label>
              <label>
                Dura
                <select value={duration} onChange={(e) => setHours(Number(e.target.value))}>
                  {options.map((h) => (
                    <option key={h} value={h}>
                      {durationLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <p className="muted small">
            {permanent
              ? "Se entra cuando quieras y no cuenta entre los eventos del mes."
              : `Antes de que abra y después de que cierre, la recepcionista no deja pasar (tu equipo sí, para prepararlo). ${theme === "hackathon" ? `Con tu plan una hackathon dura hasta ${durationLabel(plan.hackathonDays * 24)}.` : `Con tu plan un evento dura hasta ${durationLabel(plan.talkHours)}.`}`}
          </p>
        </fieldset>

        {theme === "hackathon" && (
          <fieldset className="capacity">
            <legend>Participantes del hackathon</legend>
            <p className="muted small">
              Cada sala de equipos tiene lugar para 100 personas, en mesas de 6, 4 y 2. Según el cupo se habilitan más salas; las demás quedan cerradas. A la vez entran hasta {plan.people} personas, según tu plan.
            </p>
            <div className="capacity-options">
              {HACKATHON_CAPACITIES.map((c) => (
                <label key={c} className={`chip ${capacity === c ? "selected" : ""}`}>
                  <input type="radio" name="capacity" checked={capacity === c} onChange={() => setCapacity(c)} />
                  {c} · {c / 100} {c === 100 ? "sala" : "salas"}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="access">
          <legend>Acceso</legend>
          <label className={`check ${plan.privateEvents ? "" : "locked"}`}>
            <input type="radio" name="access" checked={isPrivate} disabled={!plan.privateEvents && !isPrivate} onChange={() => setPrivate(true)} />
            Privado: solo entran los correos de la lista {!plan.privateEvents && <span className="muted small">🔒 Desde el plan Inicial</span>}
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

        <fieldset className="team">
          <legend>Equipo del evento</legend>
          <p className="muted small">
            Entran aunque el evento sea privado. Los organizadores llevan ⭐ y pueden usar la sala de organizadores; los mentores llevan 🧭 y la gente los
            encuentra en la sala de mentores. Tú ya eres organizador.
          </p>
          <label>
            Organizadores <span className="muted small">(correos{plan.staff !== null && `, hasta ${plan.staff}`})</span>
            <textarea value={staff} onChange={(e) => setStaff(e.target.value)} rows={2} placeholder="equipo@empresa.com" />
          </label>
          {plan.mentors === 0 ? (
            <p className="muted small">🔒 Los mentores están desde el plan Inicial.</p>
          ) : (
            <label>
              Mentores <span className="muted small">(correos{plan.mentors !== null && `, hasta ${plan.mentors}`})</span>
              <textarea value={mentors} onChange={(e) => setMentors(e.target.value)} rows={2} placeholder="mentora@empresa.com" />
            </label>
          )}
        </fieldset>

        <fieldset className="rooms-editor">
          <legend>Salas y agenda</legend>
          <p className="muted small">
            {theme === "hackathon"
              ? `Un hackathon tiene el auditorio principal y ${maxRoomsFor(theme) - 1} salas de charla: 4 en la planta baja y 4 arriba, cada una lejos de las demás.`
              : theme === "starmaker"
                ? "Las oficinas Starmaker son de un solo piso y tienen una sola sala: la principal (por ejemplo, «Sala Stellar»), que es su sala de reunión, derecho desde la entrada. Ahí todos hablan y comparten pantalla, y el equipo organizador puede repartir a la gente al azar en 8 salas chiquitas. Su agenda es la de la reunión."
                : `Mínimo ${minRoomsFor(theme) - 1} salas más el auditorio principal, y hasta ${maxRoomsFor(theme) - 1}. Las primeras ${ROOMS_PER_FLOOR} van en la planta baja; las siguientes, en el piso de arriba.`} Cada sala tiene una forma distinta: aula, teatro en abanico, anfiteatro en U o sala ancha, y puede tener su propia temática (por ejemplo, una sala Stellar).
          </p>
          {rooms.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className={`room-block ${i === 0 ? "main" : ""}`} style={{ "--room": r.color } as React.CSSProperties}>
              <div className="room-row">
                <span className="room-dot" />
                {i === 0 && <span className="main-tag">Auditorio</span>}
                <input value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} maxLength={40} placeholder="Nombre de la sala" aria-label="Nombre de la sala" required />
                <input value={r.topic} onChange={(e) => setRoom(i, { topic: e.target.value })} maxLength={80} placeholder="Tema" aria-label="Tema de la sala" />
                <select value={r.color} onChange={(e) => setRoom(i, { color: e.target.value })} aria-label="Color de la sala" style={{ color: r.color }}>
                  {ROOM_COLORS.map((c) => (
                    <option key={c} value={c} style={{ color: c }}>
                      ■ {c}
                    </option>
                  ))}
                </select>
                <select value={r.theme ?? ""} onChange={(e) => setRoom(i, { theme: (e.target.value || null) as ThemeId | null })} aria-label="Temática de la sala" title="Temática de la sala">
                  <option value="">Temática del evento</option>
                  {THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {r.id && initial?.speakerCodes[r.id] && (
                  <span className="code-chip" title="Código de ponente">
                    🎤 {initial.speakerCodes[r.id]}
                  </span>
                )}
                <button type="button" className="btn ghost sm" onClick={() => setOpenAgenda(openAgenda === i ? null : i)} aria-expanded={openAgenda === i}>
                  Agenda ({r.talks.length})
                </button>
                {i > 0 && rooms.length > minRoomsFor(theme) && (
                  <button type="button" className="btn ghost sm" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))} aria-label="Quitar sala">
                    ✕
                  </button>
                )}
              </div>
              {openAgenda === i && <TalksEditor talks={r.talks} onChange={(talks) => setRoom(i, { talks })} />}
            </div>
          ))}
          {rooms.length > maxRoomsFor(theme) && (
            <p className="error small">Con esta temática quita salas hasta dejar la principal y {maxRoomsFor(theme) - 1} más.</p>
          )}
          {rooms.length < maxRoomsFor(theme) && (
            <button type="button" className="link" onClick={() => setRooms((rs) => [...rs, { ...blankRoom(rs.length), name: `Sala ${rs.length}` }])}>
              ＋ Agregar sala
            </button>
          )}
          <p className="muted small">Cada sala tiene su código de ponente: compártelo con quien va a presentar.</p>
        </fieldset>

        {error && <PlanError text={error} onPlans={onPlans} />}
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

      {v ? (
        <>
          <EventLogo event={initial!} plan={plan} onChange={onSaved} onPlans={onPlans} />
          <Sponsors event={initial!} plan={plan} onChange={onSaved} onPlans={onPlans} />
        </>
      ) : (
        <p className="muted small">Después de crear el evento podrás subir su logo y los de tus patrocinadores.</p>
      )}
    </div>
  );
}

/** Logo del evento: se muestra en la pantalla gigante del lobby. */
function EventLogo({ event, plan, onChange, onPlans }: { event: CompanyEvent; plan: Plan; onChange: (ev: CompanyEvent) => void; onPlans: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!plan.logo)
    return (
      <section className="sponsors-editor">
        <h3>Logo del evento</h3>
        <p className="muted small">
          🔒 En la pantalla gigante del lobby se muestra el nombre del evento. El logo propio está desde el plan Comunidad.{" "}
          <button type="button" className="link small" onClick={onPlans}>
            Ver planes
          </button>
        </p>
      </section>
    );
  return (
    <section className="sponsors-editor">
      <h3>Logo del evento</h3>
      <p className="muted small">Aparece en la pantalla gigante del lobby. Si no subes uno, se muestra el nombre del evento.</p>
      <div className="logo-row">
        {event.venue.logoUrl ? <img className="event-logo" src={event.venue.logoUrl} alt="Logo del evento" /> : <span className="event-logo empty">{event.venue.name}</span>}
        <label className="btn sm">
          {busy ? "Subiendo…" : event.venue.logoUrl ? "Cambiar logo" : "Subir logo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                onChange(await companyApi<CompanyEvent>(`/events/${event.venue.id}/logo`, { method: "POST", file }));
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo subir el logo");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Sponsors({ event, plan, onChange, onPlans }: { event: CompanyEvent; plan: Plan; onChange: (ev: CompanyEvent) => void; onPlans: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pitch, setPitch] = useState("");
  const [reps, setReps] = useState("");
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
        headers: { "X-Sponsor-Name": encodeURIComponent(name), "X-Sponsor-Url": encodeURIComponent(url), "X-Sponsor-Pitch": encodeURIComponent(pitch), "X-Sponsor-Reps": encodeURIComponent(reps) },
      });
      onChange(ev);
      setName("");
      setUrl("");
      setPitch("");
      setReps("");
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

  const max = Math.min(plan.sponsors ?? 12, 12);
  if (!max)
    return (
      <section className="sponsors-editor">
        <h3>Patrocinadores</h3>
        <p className="muted small">
          🔒 Los sponsors, con su stand en el lugar, están desde el plan Inicial (hasta 3).{" "}
          <button type="button" className="link small" onClick={onPlans}>
            Ver planes
          </button>
        </p>
      </section>
    );
  const full = event.venue.sponsors.length >= max;
  return (
    <section className="sponsors-editor">
      <h3>
        Patrocinadores <span className="muted small">({event.venue.sponsors.length} de {max})</span>
      </h3>
      <p className="muted small">
        Sus logos rotan en las pantallas del lugar y de cada sala. Además, cada patrocinador tiene un <b>stand</b> en el recinto con alguien que cuenta lo que hacen.
      </p>
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
      {full ? (
        <p className="muted small">
          Llegaste al máximo de sponsors de tu plan.{" "}
          {plan.sponsors !== null && (
            <button type="button" className="link small" onClick={onPlans}>
              Ver planes
            </button>
          )}
        </p>
      ) : (
      <form className="sponsor-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Nombre (ej. Stellar)" aria-label="Nombre del patrocinador" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Sitio web (opcional)" aria-label="Sitio web del patrocinador" />
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="Qué cuenta su representante en el stand (opcional)"
          aria-label="Qué cuenta el representante del stand"
        />
        <input
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="Quiénes atienden el stand: hasta 2 correos (si no, atienden dos muñecos)"
          aria-label="Correos de quienes atienden el stand"
        />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Logo" required />
        <button className="btn" disabled={busy || !file || !name.trim()}>
          {busy ? "Subiendo…" : "Agregar logo"}
        </button>
      </form>
      )}
      {error && <PlanError text={error} onPlans={onPlans} />}
    </section>
  );
}

export default function CompanyPanel({
  account,
  canVisit,
  startNew = false,
  onVisit,
  onPlans,
  onClose,
}: {
  account: Account;
  canVisit: boolean;
  /** Abrir directo en «Nuevo evento». */
  startNew?: boolean;
  onVisit: (id: string) => void;
  onPlans: () => void;
  onClose: () => void;
}) {
  const plan = planOf(account.plan);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const refreshUsage = () => void accountApi<PlanUsage>("/plan/usage").then(setUsage, () => {});
  useEffect(refreshUsage, [account.plan]);
  const [events, setEvents] = useState<CompanyEvent[] | null>(null);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    companyApi<CompanyEvent[]>("/events").then(
      (list) => {
        setEvents(list);
        setSelected(startNew ? "new" : (list[0]?.venue.id ?? "new"));
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
    refreshUsage();
  };
  const current = events?.find((e) => e.venue.id === selected) ?? null;
  const themeLabel = (id: string) => THEMES.find((t) => t.id === id)?.label;

  return (
    <div className="company-panel" role="dialog" aria-modal="true" aria-label="Panel de empresa">
      <header className="company-head">
        <div>
          <p className="eyebrow">Panel de empresa</p>
          <h1>{account.company?.name}</h1>
          <p className="plan-line">
            Plan <b>{plan.name}</b> · hasta {plan.people} personas a la vez
            {usage && ` · ${usageText(plan, usage)}`}{" "}
            <button className="link small" onClick={onPlans}>
              Ver planes
            </button>
          </p>
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
                {themeLabel(e.venue.theme)} · {e.venue.schedule ? formatWhen(e.venue.schedule.start) : "Siempre abierto"} · {e.venue.private ? "Privado" : "Abierto"}
              </span>
            </button>
          ))}
        </aside>
        {selected && (
          <EventEditor
            key={selected}
            initial={selected === "new" ? null : current}
            plan={plan}
            onPlans={onPlans}
            onSaved={upsert}
            onDeleted={(id) => {
              setEvents((list) => (list ?? []).filter((e) => e.venue.id !== id));
              setSelected("new");
              refreshUsage();
            }}
            onVisit={onVisit}
            canVisit={canVisit}
          />
        )}
      </div>
    </div>
  );
}

const formatWhen = (ms: number) => new Date(ms).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** «1 de 2 eventos este mes», «Evento de prueba usado». */
function usageText(plan: Plan, usage: PlanUsage) {
  if (plan.lifetimeEvents !== undefined) return usage.log.length >= plan.lifetimeEvents ? "evento de prueba usado" : "1 evento de prueba disponible";
  const parts: string[] = [];
  if (plan.eventsPerMonth !== null) parts.push(`${monthUsage(usage, Date.now()).events} de ${plan.eventsPerMonth} eventos este mes`);
  if (plan.permanent) parts.push(`${usage.permanent} de ${plan.permanent} ${plan.permanent === 1 ? "espacio permanente" : "espacios permanentes"}`);
  return parts.join(" · ");
}

/** Convierte una cuenta personal en cuenta de empresa para poder organizar eventos. */
export function CompanyUpgrade({ onDone, onClose }: { onDone: (account: Account) => void; onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Crea tu evento" onClose={onClose} narrow>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/company/upgrade", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadToken() ?? ""}` },
              body: JSON.stringify({ company }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar la cuenta");
            onDone(data.account as Account);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Algo salió mal");
            setBusy(false);
          }
        }}
      >
        <p className="muted">Para organizar eventos tu cuenta pasa a ser de empresa. Puedes seguir entrando a eventos como siempre.</p>
        <label>
          Nombre de la empresa
          <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={60} required autoFocus placeholder="Acme Tech" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !company.trim()}>
          {busy ? "Un momento…" : "Continuar"}
        </button>
      </form>
    </Modal>
  );
}
