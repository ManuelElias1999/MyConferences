import { useState } from "react";
import type { EventInfo } from "../../shared/types.ts";
import { AgendaGrid } from "./Agenda.tsx";
import { AVATAR_COLORS, initials, roomSchedule, type Profile } from "./lib.ts";

export default function Reception({
  event,
  now,
  initialProfile,
  busy,
  error,
  onJoin,
}: {
  event: EventInfo | null;
  now: number;
  initialProfile: Profile | null;
  busy: boolean;
  error: string;
  onJoin: (profile: Profile) => void;
}) {
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [title, setTitle] = useState(initialProfile?.title ?? "");
  const [color, setColor] = useState(initialProfile?.color ?? AVATAR_COLORS[0]!);
  const [speakerCode, setSpeakerCode] = useState(initialProfile?.speakerCode ?? "");
  const [showCode, setShowCode] = useState(Boolean(initialProfile?.speakerCode));

  const liveCount = event ? event.rooms.filter((r) => roomSchedule(event, r.id, now).current).length : 0;

  return (
    <main className="reception">
      <section className="reception-hero">
        <p className="eyebrow">Recepción</p>
        <h1>{event?.name ?? "Cargando evento…"}</h1>
        {event && <p className="lead">{event.tagline}</p>}
        {event && (
          <p className="live-now">
            <span className="dot" /> {liveCount} {liveCount === 1 ? "charla en vivo" : "charlas en vivo"} ahora
          </p>
        )}
      </section>

      <form
        className="card profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin({ name: name.trim(), title: title.trim(), color, speakerCode: showCode ? speakerCode.trim() : "" });
        }}
      >
        <h2>Crea tu credencial</h2>
        <div className="badge-preview">
          <span className="avatar lg" style={{ background: color }}>
            {initials(name) || "?"}
          </span>
          <div>
            <strong>{name || "Tu nombre"}</strong>
            <span>{title || "Rol u organización"}</span>
          </div>
        </div>

        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus placeholder="Ana Pérez" />
        </label>
        <label>
          <span>
            Rol u organización <span className="optional">(opcional)</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Desarrolladora en Acme" />
        </label>
        <fieldset className="colors">
          <legend>Color de tu avatar</legend>
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${c === color ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={c === color}
            />
          ))}
        </fieldset>

        {showCode ? (
          <label>
            Código de expositor
            <input
              value={speakerCode}
              onChange={(e) => setSpeakerCode(e.target.value)}
              maxLength={20}
              placeholder="Ej. A1B2C3"
              autoCapitalize="characters"
            />
          </label>
        ) : (
          <button type="button" className="link" onClick={() => setShowCode(true)}>
            ¿Vas a presentar? Ingresa tu código de expositor
          </button>
        )}

        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !event || !name.trim()}>
          {busy ? "Conectando…" : "Entrar al evento"}
        </button>
      </form>

      {event && (
        <section className="reception-agenda">
          <h2>Agenda de hoy</h2>
          <AgendaGrid event={event} now={now} />
        </section>
      )}
    </main>
  );
}
