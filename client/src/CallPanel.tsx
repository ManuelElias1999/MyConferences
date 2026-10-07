import { useEffect, useRef, useState } from "react";
import type { User } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import type { PrivateCall } from "./call.ts";
import Modal from "./Modal.tsx";

/** Reproduce el audio de alguien de la charla. */
function Voice({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

/** Tarjeta de una persona del evento, con el botón para charlar en privado. */
export function UserCard({ user, call, onClose }: { user: User; call: PrivateCall; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alreadyIn = call.call?.members.some((m) => m.id === user.id) ?? false;
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await call.invite(user.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={user.name} onClose={onClose} narrow>
      <div className="user-card">
        <AvatarCanvas look={user.look} size={96} />
        <div>
          <p className="muted small">{user.registered ? "Asistente" : "Invitado"}{user.inCall && " · 🎧 en una charla privada"}</p>
          <p className="small">
            En una charla privada solo ustedes se escuchan por micrófono, y el resto del evento queda en silencio. Después puedes sumar a más personas.
          </p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary" onClick={start} disabled={busy || alreadyIn}>
          {alreadyIn ? "Ya está en tu charla" : call.call ? "🎙 Sumar a la charla" : "🎙 Invitar a charla privada"}
        </button>
      </div>
    </Modal>
  );
}

/** Video de alguien de la charla (o el propio, sin sonido). */
function VideoTile({ stream, label, wide = false, mine = false }: { stream: MediaStream; label: string; wide?: boolean; mine?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);
  return (
    <figure className={`call-tile ${wide ? "wide" : ""}`}>
      <video ref={ref} autoPlay playsInline muted className={mine ? "mirror" : ""} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** Invitaciones recibidas y el panel de la charla en curso (privada o de una mesa de equipo). */
export default function CallPanel({ me, call, people }: { me: User; call: PrivateCall; people: User[] }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const current = call.call;
  const memberIds = new Set(current?.members.map((m) => m.id));
  const candidates = people.filter((u) => u.id !== me.id && !memberIds.has(u.id));
  const zone = current?.zone ?? null;

  useEffect(() => {
    if (!current) setAdding(false);
  }, [current]);

  const add = async (userId: string) => {
    setError("");
    try {
      await call.invite(userId);
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar");
    }
  };

  // Pantallas compartidas primero (grandes), después las cámaras.
  const tiles: { key: string; stream: MediaStream; label: string; wide: boolean; mine: boolean }[] = [];
  if (current) {
    for (const m of current.members) {
      const mine = m.id === me.id;
      const media = current.media[m.id];
      const remote = call.remotes.get(m.id);
      const screen = mine ? call.screen : media?.screen ? remote?.screen : null;
      if (screen) tiles.push({ key: `${m.id}-s`, stream: screen, label: `🖥 ${m.name}`, wide: true, mine: false });
    }
    for (const m of current.members) {
      const mine = m.id === me.id;
      const media = current.media[m.id];
      const remote = call.remotes.get(m.id);
      const cam = mine ? call.camera : media?.cam ? remote?.cam : null;
      if (cam) tiles.push({ key: `${m.id}-c`, stream: cam, label: mine ? `${m.name} (tú)` : m.name, wide: false, mine });
    }
  }

  return (
    <>
      {call.invites.length > 0 && (
        <div className="call-invites" role="alert">
          {call.invites.map((inv) => (
            <div key={inv.callId} className="call-invite">
              <AvatarCanvas look={inv.from.look} size={44} head />
              <div>
                <p>
                  <b>{inv.from.name}</b> te invita a una charla privada
                </p>
                {inv.members.length > 1 && <p className="muted small">Con {inv.members.join(", ")}</p>}
              </div>
              <div className="call-invite-actions">
                <button className="btn primary sm" onClick={() => call.respond(inv.callId, true)}>
                  Aceptar
                </button>
                <button className="btn ghost sm" onClick={() => call.respond(inv.callId, false)}>
                  Ahora no
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <section className={`call-panel ${tiles.length ? "with-video" : ""}`} aria-label={zone ? `Conversación de ${zone}` : "Charla privada"}>
          <header>
            <h3>{zone ? `🧑‍💻 ${zone}` : "🎧 Charla privada"}</h3>
            <span className="muted small">
              {current.members.length} {current.members.length === 1 ? "persona" : "personas"}
            </span>
          </header>
          <p className="small call-lead">
            {zone
              ? current.members.length < 2
                ? "Estás aquí. Quien entre a este espacio se suma a la conversación."
                : "Solo se escucha y se ve a quienes están en este espacio."
              : current.members.length < 2
                ? "Esperando a que acepten la invitación…"
                : "Solo ustedes se escuchan. El resto del evento está en silencio."}
          </p>
          {tiles.length > 0 && (
            <div className="call-tiles">
              {tiles.map((t) => (
                <VideoTile key={t.key} stream={t.stream} label={t.label} wide={t.wide} mine={t.mine} />
              ))}
            </div>
          )}
          <ul className="call-members">
            {current.members.map((m) => (
              <li key={m.id}>
                <AvatarCanvas look={m.look} size={28} head />
                <span>
                  {m.name}
                  {m.id === me.id && <span className="muted"> (tú{!call.micOn && ", silenciado"})</span>}
                  {current.media[m.id]?.cam && " 📷"}
                  {current.media[m.id]?.screen && " 🖥"}
                </span>
                {m.id !== me.id && !call.remotes.get(m.id)?.audio && <span className="muted small call-status">conectando…</span>}
              </li>
            ))}
          </ul>
          {call.micError && <p className="error small">{call.micError}</p>}
          {error && <p className="error small">{error}</p>}
          {adding && !zone && (
            <div className="call-add">
              {candidates.length === 0 ? (
                <p className="muted small">No hay más personas en el evento para sumar.</p>
              ) : (
                <ul>
                  {candidates.map((u) => (
                    <li key={u.id}>
                      <button className="btn ghost sm" onClick={() => add(u.id)}>
                        ＋ {u.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="call-actions">
            <button className={`btn sm ${call.micOn ? "" : "primary"}`} onClick={() => call.setMicOn(!call.micOn)}>
              {call.micOn ? "🎙 Silenciar" : "🔇 Activar micrófono"}
            </button>
            <button className={`btn sm ${call.camera ? "primary" : ""}`} onClick={() => void call.toggleCamera()}>
              {call.camera ? "📷 Apagar cámara" : "📷 Cámara"}
            </button>
            <button className={`btn sm ${call.screen ? "primary" : ""}`} onClick={() => void call.toggleScreen()}>
              {call.screen ? "🖥 Dejar de compartir" : "🖥 Compartir"}
            </button>
            {!zone && (
              <button className="btn sm" onClick={() => setAdding((a) => !a)}>
                ＋ Añadir
              </button>
            )}
            <button className="btn sm danger" onClick={call.leave}>
              {zone ? "Salir de la conversación" : "Salir"}
            </button>
          </div>
          {[...call.remotes].map(([id, r]) => (r.audio ? <Voice key={id} stream={r.audio} /> : null))}
        </section>
      )}
    </>
  );
}
