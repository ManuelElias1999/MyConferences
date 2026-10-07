import { useState } from "react";
import { EMOTES } from "../../shared/themes.ts";
import { socket } from "./lib.ts";

/** Reacciones rápidas: también salen con las teclas 1 a 5. */
export function EmoteButtons() {
  return (
    <div className="emotes" role="group" aria-label="Reacciones">
      {EMOTES.map((e, i) => (
        <button key={e} type="button" onClick={() => socket.emit("emote", e)} title={`Reaccionar (tecla ${i + 1})`}>
          {e}
        </button>
      ))}
    </div>
  );
}

/** Barra para hablar: el mensaje aparece en un globo sobre tu personaje. */
export default function SayBar() {
  const [text, setText] = useState("");
  return (
    <form
      className="say-bar"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        socket.emit("say", text);
        setText("");
      }}
    >
      <EmoteButtons />
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Di algo…" aria-label="Mensaje" />
      <button className="btn primary sm" disabled={!text.trim()}>
        Hablar
      </button>
    </form>
  );
}
