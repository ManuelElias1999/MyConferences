import { useState } from "react";
import { socket } from "./lib.ts";

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
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Di algo…" aria-label="Mensaje" />
      <button className="btn primary sm" disabled={!text.trim()}>
        Hablar
      </button>
    </form>
  );
}
