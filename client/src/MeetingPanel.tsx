import { useState } from "react";
import { inZone, type SceneMap, type Tile } from "../../shared/maps.ts";
import type { User } from "../../shared/types.ts";
import { socket } from "./lib.ts";

/**
 * La reunión (por ejemplo, la de los martes en las oficinas Starmaker): cuánta
 * gente hay en la sala de reunión y en las salas chicas, un botón para ir y,
 * para el equipo organizador, repartir a todos al azar o traerlos de vuelta.
 */
export default function MeetingPanel({ map, me, people, onGo }: { map: SceneMap; me: User; people: User[]; onGo: (tile: Tile) => void }) {
  const gather = map.zones.find((z) => z.gather);
  const rooms = map.zones.filter((z) => z.breakout);
  const [count, setCount] = useState(Math.min(4, rooms.length));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!gather) return null;
  const at = (u: User) => ({ x: Math.round(u.x), y: Math.round(u.y) });
  const inGather = people.filter((u) => inZone(at(u), gather)).length;
  const inRooms = people.filter((u) => rooms.some((z) => inZone(at(u), z))).length;
  const staff = me.role === "staff";

  const run = (event: "breakout" | "gather") => {
    setBusy(true);
    setMessage("");
    const done = (res: { ok: true; data: { moved: number; rooms?: number } } | { ok: false; error: string }) => {
      setBusy(false);
      if (!res.ok) return setMessage(res.error);
      const { moved, rooms: used } = res.data;
      setMessage(event === "breakout" ? `Listo: ${moved} ${moved === 1 ? "persona" : "personas"} en ${used} ${used === 1 ? "sala" : "salas"}.` : `Listo: ${moved} de vuelta en ${gather.label}.`);
    };
    if (event === "breakout") socket.emit("breakout", count, done);
    else socket.emit("gather", done);
  };

  return (
    <section className="meeting-panel">
      <h3 className="side-title">Reunión</h3>
      <p className="small">
        En la <b>{gather.label}</b> todos se escuchan y pueden compartir pantalla. {rooms.length > 0 && `Para trabajar en grupos hay ${rooms.length} salas chicas.`}
      </p>
      <p className="muted small">
        {inGather} en la {gather.label}
        {rooms.length > 0 && ` · ${inRooms} en las salas`}
      </p>
      <button className="btn sm" onClick={() => onGo({ x: gather.x + Math.floor(gather.w / 2), y: gather.y + gather.h - 2 })}>
        Ir a la {gather.label}
      </button>
      {staff && rooms.length > 0 && (
        <div className="meeting-staff">
          <label className="small">
            Repartir en
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={busy}>
              {rooms.map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} {i ? "salas" : "sala"}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary sm" onClick={() => run("breakout")} disabled={busy}>
            🎲 Repartir al azar
          </button>
          <button className="btn sm" onClick={() => run("gather")} disabled={busy || inRooms === 0}>
            📣 Traer a todos de vuelta
          </button>
          <p className="muted small">Se reparte a quienes están en la {gather.label}; tú te quedas ahí y puedes pasar por cada sala.</p>
        </div>
      )}
      {message && <p className="small">{message}</p>}
    </section>
  );
}
