import { useMemo, useRef, useState } from "react";
import { stairsEntry, venueFloors, type Door, type Tile } from "../../shared/maps.ts";
import { THEMES } from "../../shared/themes.ts";
import type { Sponsor, Talk, User, Venue } from "../../shared/types.ts";
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
  onStairs,
  onOpenAgenda,
  onUser,
}: {
  me: User;
  venue: Venue;
  users: Map<string, User>;
  usersVersion: number;
  now: number;
  onEnterRoom: (roomId: string) => void;
  onExit: () => void;
  onStairs: (floor: number) => void;
  onOpenAgenda: () => void;
  onUser: (userId: string) => void;
}) {
  // Stands: uno por patrocinador y, siempre, el del organizador (así todo evento tiene stands).
  const stands = useMemo<Sponsor[]>(
    () => [
      ...venue.sponsors,
      {
        id: "organizador",
        name: venue.organizer,
        logoUrl: venue.logoUrl ?? "",
        url: null,
        pitch: `¡Bienvenido a ${venue.name}! Somos ${venue.organizer}. ${venue.tagline ? `${venue.tagline} ` : ""}Pregúntanos por la agenda o por cualquier sala.`,
      },
    ],
    [venue],
  );
  const floors = useMemo(() => venueFloors(venue.theme, venue.rooms, stands), [venue, stands]);
  const [stand, setStand] = useState<number | null>(null);
  const standSponsor = stand !== null ? stands[stand] : undefined;
  const isOrganizer = standSponsor?.id === "organizador";
  const floor = Math.min(me.floor, floors.length - 1);
  const map = floors[floor]!;
  const scene = useRef<SceneHandle>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [guiding, setGuiding] = useState<string | null>(null);

  void usersVersion;
  const everyone = [...users.values()];
  const doorInfo = new Map<string, { door: Door; floor: number }>();
  floors.forEach((m, f) => m.doors.forEach((door) => doorInfo.set(door.id, { door, floor: f })));
  const info = venue.rooms.map((room) => {
    const { current, next } = roomSchedule(venue, room.id, now);
    const talk = current ?? next;
    const where = doorInfo.get(room.id);
    return { room, current, next, where, count: everyone.filter((u) => u.roomId === room.id).length, talk };
  });
  const doorStatus = new Map<string, DoorStatus>(
    info.map(({ room, current, talk, count }) => [room.id, { live: Boolean(current), count, title: talk?.title ?? "", time: talk ? span(talk) : "" }]),
  );
  const upcoming = venue.talks
    .filter((t) => t.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);
  const roomById = new Map(venue.rooms.map((r) => [r.id, r]));
  const placeOf = (roomId: string) => {
    const w = doorInfo.get(roomId);
    return w ? `${floors[w.floor]!.floorName} · ${w.door.zone}` : "";
  };

  /** Si la sala está en otro piso, el camino lleva primero a la escalera. */
  const targetFor = (where: { door: Door; floor: number }): Tile => {
    if (where.floor === floor) return { x: where.door.x, y: where.door.y };
    const st = map.stairs.find((s) => s.to === where.floor) ?? map.stairs[0];
    return st ? stairsEntry(st) : map.spawn;
  };
  const guide = (roomId: string) => {
    const where = doorInfo.get(roomId);
    if (!where) return;
    scene.current?.guide(targetFor(where));
    setGuiding(where.floor === floor ? where.door.label : `${where.door.label} (sube por la escalera)`);
    setDirectoryOpen(false);
  };
  const go = (roomId: string) => {
    setDirectoryOpen(false);
    setGuiding(null);
    scene.current?.guide(null);
    const where = doorInfo.get(roomId);
    if (!where || where.floor !== floor || !scene.current?.walkTo({ x: where.door.x, y: where.door.y })) onEnterRoom(roomId);
  };

  return (
    <main className="hall">
      <div className="world">
        <Scene
          key={`${venue.id}:${floor}`}
          map={map}
          me={me}
          users={users}
          inScene={(u) => u.venueId === venue.id && !u.roomId && u.floor === floor}
          camera="follow"
          names="all"
          doorStatus={doorStatus}
          onDoor={(door) => onEnterRoom(door.id)}
          onExit={onExit}
          onStairs={onStairs}
          onDirectory={() => setDirectoryOpen(true)}
          onNpc={(npc) => npc.sponsor !== undefined && setStand(npc.sponsor)}
          onUser={onUser}
          media={{ sponsors: venue.sponsors, title: venue.name, logoUrl: venue.logoUrl, stands }}
          handle={scene}
          label={`${venue.name}, ${map.floorName}`}
        />
        <p className="scene-hint">
          Recorre el evento: hay cafetería, zonas para charlar, juegos y un patio. Usa los tótems <b>?</b> o el minimapa para llegar a cada sala.
        </p>
        <span className="floor-badge">{map.floorName}</span>
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

        {floors.map((m, f) => (
          <section key={f}>
            <h3 className="side-title">
              {m.floorName}
              {f === floor && <span className="here">Estás aquí</span>}
            </h3>
            <ul className="room-list">
              {info
                .filter((i) => i.where?.floor === f)
                .map(({ room, current, talk, where, count }) => (
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
                      {where && <p className="muted small">{where.door.zone}</p>}
                    </div>
                    <button className="btn sm" onClick={() => go(room.id)}>
                      Ir
                    </button>
                  </li>
                ))}
              {!info.some((i) => i.where?.floor === f) && <li className="muted small">Espacios para charlar y descansar.</li>}
            </ul>
          </section>
        ))}

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
                  <p className="muted small">
                    {u.roomId ? roomById.get(u.roomId)?.name : floors[u.floor]?.floorName}
                    {u.inCall && " · 🎧 en charla"}
                  </p>
                </div>
                {u.id !== me.id && (
                  <button className="btn ghost sm people-call" onClick={() => onUser(u.id)} aria-label={`Charlar en privado con ${u.name}`} title="Charla privada">
                    🎙
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {standSponsor && (
        <Modal title={`Stand de ${standSponsor.name}`} onClose={() => setStand(null)}>
          <div className="stand-card">
            <div className="stand-logo">
              {standSponsor.logoUrl ? <img src={standSponsor.logoUrl} alt={standSponsor.name} /> : <p className="stand-name">{standSponsor.name}</p>}
            </div>
            <div className="stand-rep">
              {map.npcs.find((n) => n.sponsor === stand) && <AvatarCanvas look={map.npcs.find((n) => n.sponsor === stand)!.look} size={72} />}
              <p className="stand-quote">
                {standSponsor.pitch?.trim() || `¡Hola! Somos ${standSponsor.name} y patrocinamos ${venue.name}. Pregúntanos lo que quieras sobre lo que hacemos.`}
              </p>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setStand(null)}>
              Seguir recorriendo
            </button>
            {isOrganizer && (
              <button
                className="btn primary"
                onClick={() => {
                  setStand(null);
                  onOpenAgenda();
                }}
              >
                Ver la agenda
              </button>
            )}
            {standSponsor.url && (
              <a className="btn primary" href={standSponsor.url} target="_blank" rel="noreferrer noopener">
                Visitar su sitio
              </a>
            )}
          </div>
        </Modal>
      )}

      {directoryOpen && (
        <Modal title="Directorio de salas" onClose={() => setDirectoryOpen(false)}>
          <p className="muted small directory-lead">Elige una sala: te marcamos el camino en el suelo o te llevamos caminando.</p>
          <ul className="directory">
            {info.map(({ room, current, next, count }) => (
              <li key={room.id} className={room.main ? "main" : ""} style={{ "--room": room.color } as React.CSSProperties}>
                <div className="directory-room">
                  <p className="room-name">
                    {room.name} {current && <span className="status live">En vivo</span>}
                  </p>
                  <p className="muted small">
                    {placeOf(room.id)}
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
                  <button className="btn sm" onClick={() => guide(room.id)}>
                    Mostrar camino
                  </button>
                  <button className="btn primary sm" onClick={() => go(room.id)}>
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
