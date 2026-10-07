import { useMemo, useRef, useState } from "react";
import { venueMap, type Door } from "../../shared/maps.ts";
import { THEMES } from "../../shared/themes.ts";
import type { Talk, User, Venue } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { formatTime, minutesUntil, roomSchedule } from "./lib.ts";
import Modal from "./Modal.tsx";
import SayBar from "./SayBar.tsx";
import Scene, { type SceneHandle } from "./Scene.tsx";
import type { DoorStatus } from "./world.ts";

const themeLabel = (id: string) => THEMES.find((t) => t.id === id)?.label ?? "";
const span = (t: Talk) => `${formatTime(t.start)}–${formatTime(t.end)}`;

export default function Hall({
  me,
  venue,
  users,
  usersVersion,
  now,
  onEnterRoom,
  onExit,
  onOpenAgenda,
}: {
  me: User;
  venue: Venue;
  users: Map<string, User>;
  usersVersion: number;
  now: number;
  onEnterRoom: (roomId: string) => void;
  onExit: () => void;
  onOpenAgenda: () => void;
}) {
  const map = useMemo(() => venueMap(venue.theme, venue.rooms), [venue]);
  const scene = useRef<SceneHandle>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [guiding, setGuiding] = useState<string | null>(null);

  void usersVersion;
  const everyone = [...users.values()];
  const doorById = new Map(map.doors.map((d) => [d.id, d]));
  const info = venue.rooms.map((room) => {
    const { current, next } = roomSchedule(venue, room.id, now);
    const talk = current ?? next;
    return { room, current, next, door: doorById.get(room.id), count: everyone.filter((u) => u.roomId === room.id).length, talk };
  });
  const doorStatus = new Map<string, DoorStatus>(
    info.map(({ room, current, talk, count }) => [room.id, { live: Boolean(current), count, title: talk?.title ?? "", time: talk ? span(talk) : "" }]),
  );
  const upcoming = venue.talks
    .filter((t) => t.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);
  const roomById = new Map(venue.rooms.map((r) => [r.id, r]));

  const guide = (door: Door) => {
    scene.current?.guide({ x: door.x, y: door.y });
    setGuiding(door.label);
    setDirectoryOpen(false);
  };
  const go = (door: Door | undefined, roomId: string) => {
    setDirectoryOpen(false);
    setGuiding(null);
    scene.current?.guide(null);
    if (!door || !scene.current?.walkTo({ x: door.x, y: door.y })) onEnterRoom(roomId);
  };

  return (
    <main className="hall">
      <div className="world">
        <Scene
          map={map}
          me={me}
          users={users}
          inScene={(u) => u.venueId === venue.id && !u.roomId}
          camera="follow"
          names="all"
          doorStatus={doorStatus}
          onDoor={(door) => onEnterRoom(door.id)}
          onExit={onExit}
          onDirectory={() => setDirectoryOpen(true)}
          media={{ sponsors: venue.sponsors, title: venue.name }}
          handle={scene}
          label={`Recinto de ${venue.name}`}
        />
        <p className="scene-hint">
          Recorre el evento: el auditorio está al fondo del pasillo central y hay salas a la izquierda y a la derecha. Usa los tótems <b>?</b> para
          saber cómo llegar.
        </p>
        {guiding && (
          <p className="guide-chip">
            Siguiendo el camino a <b>{guiding}</b>
            <button
              className="btn ghost sm"
              onClick={() => {
                scene.current?.guide(null);
                setGuiding(null);
              }}
            >
              Quitar
            </button>
          </p>
        )}
        <SayBar />
      </div>

      <aside className="side">
        <section>
          <p className="eyebrow">
            Evento {venue.id} · {themeLabel(venue.theme)}
          </p>
          <h2 className="side-event">{venue.name}</h2>
          <p className="muted small">Organiza {venue.organizer}</p>
          {venue.tagline && <p className="small side-tagline">{venue.tagline}</p>}
          <button className="btn primary sm side-directory" onClick={() => setDirectoryOpen(true)}>
            Cómo llegar a cada sala
          </button>
        </section>

        {venue.sponsors.length > 0 && (
          <section>
            <h3 className="side-title">Patrocinadores</h3>
            <ul className="sponsor-grid">
              {venue.sponsors.map((sp) => (
                <li key={sp.id}>
                  {sp.url ? (
                    <a href={sp.url} target="_blank" rel="noreferrer noopener" title={sp.name}>
                      <img src={sp.logoUrl} alt={sp.name} />
                    </a>
                  ) : (
                    <img src={sp.logoUrl} alt={sp.name} title={sp.name} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="side-title">Salas</h3>
          <ul className="room-list">
            {info.map(({ room, current, talk, door, count }) => (
              <li key={room.id} style={{ "--room": room.color } as React.CSSProperties}>
                <span className="room-dot" />
                <div>
                  <p className="room-name">
                    {room.name} {current && <span className="status live">En vivo</span>}
                  </p>
                  <p className="muted small">
                    {talk ? `${span(talk)} · ${talk.title}` : room.topic}
                    {count > 0 && ` · ${count} dentro`}
                  </p>
                  {door && <p className="muted small">{door.zone}</p>}
                </div>
                <button className="btn sm" onClick={() => go(door, room.id)}>
                  Ir
                </button>
              </li>
            ))}
          </ul>
        </section>

        {upcoming.length > 0 && (
          <section>
            <h3 className="side-title">A continuación</h3>
            <ul className="upcoming-list">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <span className="upcoming-time">{formatTime(t.start)}</span>
                  <div>
                    <p>{t.title}</p>
                    <p className="muted small">
                      {roomById.get(t.roomId)?.name} · {minutesUntil(t.start, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <button className="link" onClick={onOpenAgenda}>
              Ver agenda completa
            </button>
          </section>
        )}

        <section>
          <h3 className="side-title">En el evento ({everyone.length})</h3>
          <ul className="people-list">
            {everyone.map((u) => (
              <li key={u.id}>
                <AvatarCanvas look={u.look} size={32} head />
                <div>
                  <p>
                    {u.name}
                    {u.id === me.id && <span className="muted"> (tú)</span>}
                  </p>
                  <p className="muted small">{u.roomId ? roomById.get(u.roomId)?.name : "Recorriendo el evento"}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {directoryOpen && (
        <Modal title="Directorio de salas" onClose={() => setDirectoryOpen(false)}>
          <p className="muted small directory-lead">Elige una sala: te marcamos el camino en el suelo o te llevamos caminando.</p>
          <ul className="directory">
            {info.map(({ room, current, next, door, count }) => (
              <li key={room.id} className={room.main ? "main" : ""} style={{ "--room": room.color } as React.CSSProperties}>
                <div className="directory-room">
                  <p className="room-name">
                    {room.name} {current && <span className="status live">En vivo</span>}
                  </p>
                  <p className="muted small">
                    {door?.zone ?? ""}
                    {count > 0 && ` · ${count} dentro`}
                  </p>
                </div>
                <div className="directory-talks">
                  {current && (
                    <p>
                      <b>Ahora</b> {span(current)} · {current.title}
                      {current.speaker && <span className="muted"> — {current.speaker}</span>}
                    </p>
                  )}
                  {next && (
                    <p className="muted">
                      <b>Después</b> {span(next)} · {next.title}
                    </p>
                  )}
                  {!current && !next && <p className="muted">{room.topic}</p>}
                </div>
                <div className="directory-actions">
                  {door && (
                    <button className="btn sm" onClick={() => guide(door)}>
                      Mostrar camino
                    </button>
                  )}
                  <button className="btn primary sm" onClick={() => go(door, room.id)}>
                    Llevarme
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </main>
  );
}
