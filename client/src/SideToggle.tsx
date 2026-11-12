import { useState } from "react";

const KEY = "side-hidden";

/** Panel de la derecha escondido o visible; se recuerda en este navegador. */
export function useSideHidden() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(KEY, h ? "0" : "1");
      } catch {
        // Sin almacenamiento, igual se esconde mientras dure la página.
      }
      return !h;
    });
  return [hidden, toggle] as const;
}

/** Pestaña en el borde del panel para esconderlo o mostrarlo. */
export default function SideToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button className="side-toggle" onClick={onToggle} aria-expanded={!hidden} aria-label={hidden ? "Mostrar el panel" : "Esconder el panel"}>
      <span className="side-toggle-icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="side-toggle-label">{hidden ? "Mostrar panel" : "Ocultar panel"}</span>
    </button>
  );
}
