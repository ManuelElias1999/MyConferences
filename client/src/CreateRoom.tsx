import { useEffect, useRef, useState } from "react";
import { roomMap } from "../../shared/maps.ts";
import { ROOM_COLORS, THEMES, type ThemeId } from "../../shared/themes.ts";
import type { Room, Venue } from "../../shared/types.ts";
import { socket } from "./lib.ts";
import Modal from "./Modal.tsx";
import { furniDrawables, renderStatic, T } from "./world.ts";

/** Miniatura de cómo se verá la sala con ese estilo. */
function ThemePreview({ theme, color }: { theme: ThemeId; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const map = roomMap(theme, color);
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
  }, [theme, color]);
  return <canvas ref={ref} className="theme-preview" style={{ width: 180 }} aria-hidden />;
}

export default function CreateRoom({
  venue,
  onCreated,
  onClose,
}: {
  venue: Venue;
  onCreated: (result: { room: Room; speakerCode: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [theme, setTheme] = useState<ThemeId>("tech");
  const [color, setColor] = useState(THEMES[0]!.color);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    socket.emit("createRoom", { name, topic, theme, color }, (res) => {
      setBusy(false);
      if (!res.ok) return setError(res.error);
      onCreated(res.data);
    });
  };

  return (
    <Modal title={`Crear una sala en ${venue.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <label>
            Nombre de la sala
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus placeholder="Sala DevOps" />
          </label>
          <label>
            Tema de la charla
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} placeholder="Kubernetes sin miedo" />
          </label>
        </div>

        <fieldset className="themes">
          <legend>Estilo</legend>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card ${theme === t.id ? "selected" : ""}`}
              aria-pressed={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                setColor(t.color);
              }}
            >
              <ThemePreview theme={t.id} color={theme === t.id ? color : t.color} />
              <strong>{t.label}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="swatches">
          <legend>Color de la puerta y los detalles</legend>
          {ROOM_COLORS.map((c) => (
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

        <p className="muted small">La sala aparece al final del edificio: en un muro libre o en un piso nuevo. Te daremos un código para que presentes en ella.</p>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy || !name.trim()}>
            {busy ? "Creando…" : "Crear sala"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RoomCreated({ room, speakerCode, onGo, onClose }: { room: Room; speakerCode: string; onGo: () => void; onClose: () => void }) {
  return (
    <Modal title="¡Tu sala está lista!" onClose={onClose} narrow>
      <div className="form">
        <p>
          <strong>{room.name}</strong> ya aparece en el edificio con estilo {THEMES.find((t) => t.id === room.theme)?.label.toLowerCase()}.
        </p>
        <p className="muted">Este es tu código de ponente. Guárdalo: con él puedes presentar en la sala desde cualquier dispositivo.</p>
        <p className="code">{speakerCode}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Más tarde
          </button>
          <button className="btn primary" onClick={onGo}>
            Ir a mi sala
          </button>
        </div>
      </div>
    </Modal>
  );
}
