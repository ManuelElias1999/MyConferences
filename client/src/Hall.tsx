import { useMemo, useRef } from "react";
import { floorName, venueFloors } from "../../shared/maps.ts";
import { THEMES } from "../../shared/themes.ts";
import type { User, Venue } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { formatTime, minutesUntil, roomSchedule } from "./lib.ts";
import SayBar from "./SayBar.tsx";
import Scene, { type SceneHandle } from "./Scene.tsx";
import type { DoorStatus } from "./world.ts";

const themeLabel = (id: string) => THEMES.find((t) => t.id === id)?.label ?? "";

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
}) {
  const floors = useMemo(() => venueFloors(venue.theme, venue.rooms), [venue]);
  const floor = Math.min(me.floor, floors.length - 1);
  const map = floors[floor]!;
  const scene = useRef<SceneHandle>(null);

  void usersVersion;
  const everyone = [...users.values()];
  const doorStatus = new Map<string, DoorStatus>(
    venue.rooms.map((r) => [
      r.id,
      {
        live: Boolean(roomSchedule(venue, r.id, now).current),
        count: everyone.filter((u) => u.roomId === r.id).length,
        label: themeLabel(venue.theme),
      },
    ]),
  );
  const upcoming = venue.talks
    .filter((t) => t.start > now)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);
  const roomById = new Map(venue.rooms.map((r) => [r.id, r]));
  const floorOf = new Map(floors.flatMap((m, i) => m.doors.map((d) => [d.id, i] as const)));

  // Si la sala está en este piso el personaje camina hasta su puerta; si no, entra directo.
  const goTo = (roomId: string) => {
    const door = map.doors.find((d) => d.id === roomId);
    if (!door || !scene.current?.walkTo({ x: door.x, y: door.y })) onEnterRoom(roomId);
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
          media={{ sponsors: venue.sponsors, title: venue.name }}
          handle={scene}
          label={`${venue.name}, ${floorName(floor)}`}
        />
        <p className="scene-hint">
          Cruza una puerta para entrar a esa sala. Reacciona con las teclas <kbd>1</kbd>–<kbd>5</kbd>.
        </p>
        {floors.length > 1 && <span className="floor-badge">{floorName(floor)}</span>}
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

        {floors.map((m, i) => (
          <section key={i}>
            <h3 className="side-title">
              {floors.length > 1 ? `Salas · ${floorName(i)}` : "Salas"}
              {floors.length > 1 && i === floor && <span className="here">Estás aquí</span>}
            </h3>
            <ul className="room-list">
              {m.doors.map((d) => {
                const room = roomById.get(d.id)!;
                const s = doorStatus.get(d.id)!;
                const { current } = roomSchedule(venue, d.id, now);
                return (
                  <li key={d.id} style={{ "--room": room.color } as React.CSSProperties}>
                    <span className="room-dot" />
                    <div>
                      <p className="room-name">
                        {room.name} {s.live && <span className="status live">En vivo</span>}
                      </p>
                      <p className="muted small">
                        {current ? current.title : room.topic}
                        {s.count > 0 && ` · ${s.count} dentro`}
                      </p>
                    </div>
                    <button className="btn sm" onClick={() => goTo(d.id)}>
                      Ir
                    </button>
                  </li>
                );
              })}
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
                    {u.roomId ? roomById.get(u.roomId)?.name : floorName(u.floor)}
                    {u.roomId && floorOf.has(u.roomId) && ` · ${floorName(floorOf.get(u.roomId)!)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </main>
  );
}
