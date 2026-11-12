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
    <button className="side-toggle" onClick={onToggle} aria-expanded={!hidden} title={hidden ? "Mostrar el panel" : "Esconder el panel"}>
      {hidden ? "‹" : "›"}
      <span>{hidden ? "Panel" : "Ocultar"}</span>
    </button>
  );
}
