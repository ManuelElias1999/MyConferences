import { useState } from "react";
import { RECEPTIONIST_LOOK } from "../../shared/look.ts";
import { receptionMap } from "../../shared/maps.ts";
import type { User, VenueSummary } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import SayBar from "./SayBar.tsx";
import Scene from "./Scene.tsx";

const MAP = receptionMap();

type Dialog = { step: "ask" } | { step: "checking" } | { step: "error"; text: string; needsLogin: boolean } | { step: "ok"; text: string };

/** Lo que muestran las pantallas junto al mostrador. */
const RECEPTION_SCREENS = { sponsors: [], title: "Bienvenidos a MyConferences" };

export default function Reception({
  me,
  users,
  venues,
  onRequestVenue,
  onLogin,
}: {
  me: User;
  users: Map<string, User>;
  venues: VenueSummary[];
  /** Devuelve el nombre del salón si la recepcionista acepta, o lanza el motivo del rechazo. */
  onRequestVenue: (number: string) => Promise<string>;
  onLogin: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [number, setNumber] = useState("");

  const ask = async (value: string) => {
    if (!value.trim()) return;
    setDialog({ step: "checking" });
    try {
      const name = await onRequestVenue(value.trim());
      setDialog({ step: "ok", text: `¡Todo en orden! Te acompaño a ${name}.` });
    } catch (err) {
      const text = err instanceof Error ? err.message : "No pude revisar esa sala.";
      setDialog({ step: "error", text, needsLogin: !me.registered && /privado/.test(text) });
    }
  };

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
        onNpc={() => setDialog({ step: "ask" })}
        media={RECEPTION_SCREENS}
        label="Recepción"
      />

      {dialog ? (
        <section className="npc-dialog" aria-live="polite">
          <div className="npc-portrait">
            <AvatarCanvas look={RECEPTIONIST_LOOK} size={72} head />
          </div>
          <div className="npc-body">
            <p className="npc-name">Recepcionista</p>
            {dialog.step === "ask" && (
              <>
                <p>¡Hola, {me.name}! ¿Cuál es el número de tu evento?</p>
                <form
                  className="npc-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(number);
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
                    Ir
                  </button>
                </form>
                {venues.length > 0 && (
                  <p className="npc-hint">
                    Eventos abiertos hoy:{" "}
                    {venues.map((v) => (
                      <button key={v.id} type="button" className="chip" onClick={() => ask(v.id)}>
                        {v.id} · {v.name}
                      </button>
                    ))}
                  </p>
                )}
                {!me.registered && <p className="npc-hint">Los eventos privados revisan tu correo: inicia sesión antes de pedirlos.</p>}
              </>
            )}
            {dialog.step === "checking" && <p>Déjame revisar la lista…</p>}
            {dialog.step === "error" && (
              <>
                <p>{dialog.text}</p>
                <div className="npc-actions">
                  {dialog.needsLogin && (
                    <button className="btn primary sm" onClick={onLogin}>
                      Iniciar sesión
                    </button>
                  )}
                  <button className="btn sm" onClick={() => setDialog({ step: "ask" })}>
                    Probar otro número
                  </button>
                </div>
              </>
            )}
            {dialog.step === "ok" && <p>{dialog.text}</p>}
          </div>
          {dialog.step !== "ok" && dialog.step !== "checking" && (
            <button className="btn ghost sm npc-close" onClick={() => setDialog(null)} aria-label="Cerrar">
              ✕
            </button>
          )}
        </section>
      ) : (
        <p className="scene-hint">
          Camina con <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>←</kbd>
          <kbd>→</kbd> o haciendo clic. Acércate a la recepcionista para entrar a tu evento.
        </p>
      )}

      <SayBar />
    </main>
  );
}
