import { useState } from "react";
import { HAIR_COLORS, HAIR_STYLES, PANTS, SHIRTS, SHOES, SKINS } from "../../shared/look.ts";
import type { Dir } from "../../shared/maps.ts";
import type { Account, Look } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { socket } from "./lib.ts";
import Modal from "./Modal.tsx";

const TURN: Dir[] = ["down", "left", "up", "right"];

function Swatches({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="swatches">
      <legend>{label}</legend>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${c === value ? "selected" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`${label} ${c}`}
          aria-pressed={c === value}
        />
      ))}
    </fieldset>
  );
}

export default function AvatarEditor({
  account,
  welcome,
  onSaved,
  onClose,
}: {
  account: Account;
  welcome: boolean;
  onSaved: (account: Account) => void;
  onClose: () => void;
}) {
  const [look, setLook] = useState<Look>(account.look);
  const [name, setName] = useState(account.name);
  const [dir, setDir] = useState<Dir>("down");
  const turn = (by: number) => setDir((d) => TURN[(TURN.indexOf(d) + by + TURN.length) % TURN.length]!);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Look>(key: K) => (value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));

  const save = () => {
    setBusy(true);
    setError("");
    socket.emit("setLook", { name, look }, (res) => {
      setBusy(false);
      if (!res.ok) return setError(res.error);
      onSaved(res.data.account);
    });
  };

  return (
    <Modal title={welcome ? "Crea tu personaje" : "Mi personaje"} onClose={onClose}>
      <div className="editor">
        <div className="editor-preview">
          <AvatarCanvas look={look} dir={dir} size={200} />
          <div className="editor-rotate">
            <button className="btn sm" onClick={() => turn(-1)} aria-label="Girar a la izquierda">
              ↺
            </button>
            <button className="btn sm" onClick={() => turn(1)} aria-label="Girar a la derecha">
              ↻
            </button>
          </div>
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          </label>
        </div>
        <div className="editor-options">
          <fieldset className="styles">
            <legend>Peinado</legend>
            {HAIR_STYLES.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`chip ${look.hair === h.id ? "selected" : ""}`}
                onClick={() => set("hair")(h.id)}
                aria-pressed={look.hair === h.id}
              >
                {h.label}
              </button>
            ))}
          </fieldset>
          <Swatches label={look.hair === "cap" ? "Color de la gorra" : "Color de pelo"} options={HAIR_COLORS} value={look.hairColor} onChange={set("hairColor")} />
          <Swatches label="Piel" options={SKINS} value={look.skin} onChange={set("skin")} />
          <Swatches label="Polera" options={SHIRTS} value={look.shirt} onChange={set("shirt")} />
          <Swatches label="Pantalón" options={PANTS} value={look.pants} onChange={set("pants")} />
          <Swatches label="Zapatos" options={SHOES} value={look.shoes} onChange={set("shoes")} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          {welcome ? "Más tarde" : "Cancelar"}
        </button>
        <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>
          {busy ? "Guardando…" : "Guardar personaje"}
        </button>
      </div>
    </Modal>
  );
}
