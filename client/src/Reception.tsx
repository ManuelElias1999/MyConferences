import { useState } from "react";
import { RECEPTION_DESKS, receptionMap, type Npc } from "../../shared/maps.ts";
import { planOf } from "../../shared/plans.ts";
import type { Account, User, VenueCard } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { accountApi } from "./lib.ts";
import SayBar from "./SayBar.tsx";
import Scene from "./Scene.tsx";

const MAP = receptionMap();

type Desk = (typeof RECEPTION_DESKS)[number]["desk"];
const DESKS = Object.fromEntries(RECEPTION_DESKS.map((d) => [d.desk, d])) as Record<Desk, (typeof RECEPTION_DESKS)[number]>;

type Entry = { step: "ask" } | { step: "checking" } | { step: "error"; text: string } | { step: "ok"; text: string };

/** Lo que muestran las pantallas de la pared. */
const RECEPTION_SCREENS = { sponsors: [], title: "Bienvenidos a MyConferences" };

const HOUR = 3_600_000;

/** «hoy a las 18:30», «mañana a las 10:00», «el 5 nov a las 9:00». */
function when(ms: number, now: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(d) - day(new Date(now))) / (24 * HOUR));
  if (days === 0) return `hoy a las ${time}`;
  if (days === 1) return `mañana a las ${time}`;
  return `el ${d.toLocaleDateString("es", { day: "numeric", month: "short" })} a las ${time}`;
}

/** Estado de un evento para la tarjeta: abierto, lleno, cuándo abre o si ya terminó. */
function status(c: VenueCard, now: number) {
  if (c.schedule && now < c.schedule.start) return { text: `Abre ${when(c.schedule.start, now)}`, tone: "soon", open: false };
  if (c.schedule && now > c.schedule.end) return { text: "Ya terminó", tone: "closed", open: false };
  if (c.people >= c.limit) return { text: `Lleno · ${c.people}/${c.limit}`, tone: "full", open: false };
  return { text: `Abierto · ${c.people}/${c.limit} personas`, tone: "open", open: true };
}

const ORDER = { open: 0, soon: 1, full: 2, closed: 3 } as const;

const FAQ: [string, string][] = [
  ["¿Cómo me muevo?", "Con las flechas o haciendo clic donde quieras ir. Para mirar alrededor sin moverte, arrastra el mapa."],
  ["¿Cómo hablo con alguien?", "Acércate: te escuchan quienes están cerca. En una sala, una mesa o un rincón marcado, hablan todos los que están adentro. El micrófono se prende desde el panel de abajo."],
  ["¿Cómo entro a un evento?", "Con su número, que te pasa quien lo organiza. Díselo a Lucía, en Entradas (el puesto celeste del medio)."],
  ["¿Cómo comparto mi pantalla?", "En una conversación, con el botón de pantalla del panel de abajo. En una sala con tarima, solo desde la tarima: se sube por los escalones de los costados."],
  ["¿Cómo creo mi evento?", "Con Mateo, en Organizadores (el puesto naranja), o con «＋ Crear evento» arriba. Todas las cuentas empiezan con el plan Gratis."],
  ["No me anda el micrófono o la cámara", "Revisa que el navegador tenga permiso (el candado junto a la dirección de la página) y que ninguna otra aplicación los esté usando."],
];

export default function Reception({
  me,
  users,
  account,
  onRequestVenue,
  onCreateEvent,
  onMyEvents,
  onPlans,
}: {
  me: User;
  users: Map<string, User>;
  account: Account;
  /** Devuelve el nombre del salón si la recepcionista acepta, o lanza el motivo del rechazo. */
  onRequestVenue: (number: string) => Promise<string>;
  onCreateEvent: () => void;
  onMyEvents: () => void;
  onPlans: () => void;
}) {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [entry, setEntry] = useState<Entry>({ step: "ask" });
  const [number, setNumber] = useState("");
  const [cards, setCards] = useState<VenueCard[] | null>(null);

  const open = (npc: Npc) => {
    const d = npc.desk ?? "entry";
    setDesk(d);
    if (d === "entry") {
      setEntry({ step: "ask" });
      setCards(null);
      accountApi<VenueCard[]>("/venues").then(setCards, () => setCards([]));
    }
  };

  const ask = async (value: string) => {
    if (!value.trim()) return;
    setEntry({ step: "checking" });
    try {
      const name = await onRequestVenue(value.trim());
      setEntry({ step: "ok", text: `¡Todo en orden! Te acompaño a ${name}.` });
    } catch (err) {
      setEntry({ step: "error", text: err instanceof Error ? err.message : "No pude revisar ese evento." });
    }
  };

  const go = (action: () => void) => {
    setDesk(null);
    action();
  };

  const info = desk ? DESKS[desk] : null;
  const plan = planOf(account.plan);
  const now = Date.now();
  const shown = (cards ?? [])
    .map((c) => ({ c, s: status(c, now) }))
    .filter(({ c, s }) => c.mine || s.tone !== "closed")
    .sort((a, b) => Number(b.c.mine) - Number(a.c.mine) || ORDER[a.s.tone as keyof typeof ORDER] - ORDER[b.s.tone as keyof typeof ORDER]);

  return (
    <main className="world">
      <Scene
        key={me.id}
        map={MAP}
        me={me}
        users={users}
        inScene={(u) => !u.venueId}
        camera="follow"
        names="all"
        onNpc={open}
        media={RECEPTION_SCREENS}
        label="Recepción"
      />

      {info ? (
        <section className={`npc-dialog desk-${info.desk}`} style={{ "--desk": info.color } as React.CSSProperties} aria-live="polite">
          <div className="npc-portrait">
            <AvatarCanvas look={info.look} size={72} head />
          </div>
          <div className="npc-body">
            <p className="npc-name">
              {info.name} <span className="desk-chip">{info.role}</span>
            </p>

            {info.desk === "entry" && (
              <>
                {entry.step === "ask" && (
                  <>
                    <p>¡Hola, {me.name}! ¿A qué evento vienes? Dime su número o elígelo de la lista.</p>
                    <form
                      className="npc-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void ask(number);
                      }}
                    >
                      <input
                        value={number}
                        onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ej. 101"
                        aria-label="Número del evento"
                        autoFocus
                      />
                      <button className="btn primary" disabled={!number}>
                        Entrar
                      </button>
                    </form>
                    {cards === null && <p className="npc-hint">Buscando los eventos…</p>}
                    {cards !== null && shown.length === 0 && <p className="npc-hint">No hay eventos abiertos al público ahora. Si tienes un número, escríbelo arriba.</p>}
                    {shown.length > 0 && (
                      <ul className="venue-cards">
                        {shown.map(({ c, s }) => (
                          <li key={c.id}>
                            <button type="button" className={`venue-card tone-${s.tone}`} disabled={!s.open && !c.mine} onClick={() => void ask(c.id)}>
                              <span className="venue-number">{c.id}</span>
                              <span className="venue-info">
                                <strong>{c.name}</strong>
                                {c.tagline && <span className="muted small">{c.tagline}</span>}
                              </span>
                              <span className="venue-status">
                                {c.mine && <span className="badge">Tu evento</span>}
                                {c.private && !c.mine && <span className="badge">Invitado</span>}
                                <span className="status-dot" />
                                {s.text}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {entry.step === "checking" && <p>Déjame revisar la lista…</p>}
                {entry.step === "error" && (
                  <>
                    <p>{entry.text}</p>
                    <div className="npc-actions">
                      <button className="btn sm" onClick={() => setEntry({ step: "ask" })}>
                        Probar otro evento
                      </button>
                    </div>
                  </>
                )}
                {entry.step === "ok" && <p>{entry.text}</p>}
              </>
            )}

            {info.desk === "organizers" && (
              <>
                <p>¡Hola, {me.name}! Soy Mateo. Te ayudo a armar tu evento: eliges el lugar, la fecha y las salas, y te damos un número para compartir.</p>
                <p className="desk-plan">
                  Tu plan: <b>{plan.name}</b> · hasta {plan.people} personas a la vez ·{" "}
                  {plan.lifetimeEvents !== undefined ? "1 evento de prueba" : plan.eventsPerMonth === null ? "eventos sin límite" : `${plan.eventsPerMonth} eventos por mes`}
                </p>
                <div className="npc-actions">
                  <button className="btn primary" onClick={() => go(onCreateEvent)}>
                    ＋ Crear un evento
                  </button>
                  {account.company && (
                    <button className="btn" onClick={() => go(onMyEvents)}>
                      Mis eventos
                    </button>
                  )}
                  <button className="btn" onClick={() => go(onPlans)}>
                    Ver planes
                  </button>
                </div>
              </>
            )}

            {info.desk === "help" && (
              <>
                <p>¡Hola, {me.name}! Soy Sofía. ¿Qué quieres saber?</p>
                <div className="faq">
                  {FAQ.map(([q, a]) => (
                    <details key={q}>
                      <summary>{q}</summary>
                      <p>{a}</p>
                    </details>
                  ))}
                </div>
              </>
            )}
          </div>
          {!(info.desk === "entry" && (entry.step === "ok" || entry.step === "checking")) && (
            <button className="btn ghost sm npc-close" onClick={() => setDesk(null)} aria-label="Cerrar">
              ✕
            </button>
          )}
        </section>
      ) : (
        <p className="scene-hint">
          Camina con <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>←</kbd>
          <kbd>→</kbd> o haciendo clic. En la recepción te atienden en tres puestos: <b>Entradas</b> para entrar a tu evento, <b>Organizadores</b> para crear el tuyo y{" "}
          <b>Ayuda</b>.
        </p>
      )}

      <SayBar />
    </main>
  );
}
