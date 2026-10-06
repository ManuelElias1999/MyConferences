import { useCallback, useEffect, useRef, useState } from "react";
import type { EventInfo, RoomSnapshot, User } from "../../shared/types.ts";
import Agenda from "./Agenda.tsx";
import Hall from "./Hall.tsx";
import Reception from "./Reception.tsx";
import RoomView from "./RoomView.tsx";
import { initials, loadProfile, saveProfile, socket, type Profile } from "./lib.ts";

export interface Session {
  me: User;
  event: EventInfo;
  speakerCode: string;
}

export default function App() {
  const [publicEvent, setPublicEvent] = useState<EventInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<{ roomId: string; data: RoomSnapshot } | null>(null);
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Las posiciones cambian muchas veces por segundo: viven en un ref que el mapa
  // lee en cada frame, y `usersVersion` solo cambia cuando alguien entra, sale o cambia de sala.
  const usersRef = useRef(new Map<string, User>());
  const [usersVersion, setUsersVersion] = useState(0);
  const bump = () => setUsersVersion((v) => v + 1);

  const profileRef = useRef<Profile | null>(null);
  const roomRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/event")
      .then((r) => r.json())
      .then(setPublicEvent)
      .catch(() => setJoinError("No se pudo cargar el evento. ¿Está corriendo el servidor?"));
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const enterRoom = useCallback((roomId: string) => {
    socket.emit("enterRoom", roomId, (res) => {
      if (!res.ok) return;
      roomRef.current = roomId;
      setSnapshot({ roomId, data: res.data });
      setSession((s) => (s ? { ...s, me: { ...s.me, roomId } } : s));
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit("leaveRoom", (res) => {
      if (!res.ok) return;
      roomRef.current = null;
      setSnapshot(null);
      setSession((s) => (s ? { ...s, me: { ...s.me, roomId: null, x: res.data.x, y: res.data.y } } : s));
    });
  }, []);

  const join = useCallback(
    (profile: Profile, rejoinRoom: string | null = null) => {
      setJoining(true);
      setJoinError("");
      socket.emit(
        "join",
        { name: profile.name, title: profile.title, color: profile.color, speakerCode: profile.speakerCode || undefined },
        (res) => {
          setJoining(false);
          if (!res.ok) return setJoinError(res.error);
          profileRef.current = profile;
          saveProfile(profile);
          usersRef.current = new Map(res.data.users.map((u) => [u.id, u]));
          bump();
          setPublicEvent(res.data.event);
          setSession({ me: res.data.user, event: res.data.event, speakerCode: profile.speakerCode });
          if (rejoinRoom) enterRoom(rejoinRoom);
        },
      );
    },
    [enterRoom],
  );

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Tras una reconexión el servidor no nos conoce: volvemos a entrar a donde estábamos.
      if (profileRef.current) join(profileRef.current, roomRef.current);
    };
    const onDisconnect = () => setConnected(false);
    const onJoined = (u: User) => {
      usersRef.current.set(u.id, u);
      bump();
    };
    const onLeft = (id: string) => {
      usersRef.current.delete(id);
      bump();
    };
    const onMoved = ({ id, x, y }: { id: string; x: number; y: number }) => {
      const u = usersRef.current.get(id);
      if (u) {
        u.x = x;
        u.y = y;
      }
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("userJoined", onJoined);
    socket.on("userUpdated", onJoined);
    socket.on("userLeft", onLeft);
    socket.on("moved", onMoved);
    // El socket pudo conectarse antes de registrar los listeners.
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("userJoined", onJoined);
      socket.off("userUpdated", onJoined);
      socket.off("userLeft", onLeft);
      socket.off("moved", onMoved);
    };
  }, [join]);

  const leaveEvent = () => {
    saveProfile(null);
    location.reload();
  };

  if (!session) {
    return (
      <Reception
        event={publicEvent}
        now={now}
        initialProfile={loadProfile()}
        busy={joining || !connected}
        error={joinError}
        onJoin={(p) => join(p)}
      />
    );
  }

  const { me, event } = session;
  const room = event.rooms.find((r) => r.id === me.roomId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => room && leaveRoom()} title="Volver al salón">
          <span className="brand-mark" aria-hidden />
          <span>{event.name}</span>
        </button>
        <nav className="topbar-nav">
          <span className="crumb">{room ? room.name : "Salón principal"}</span>
          <button className="btn ghost" onClick={() => setAgendaOpen(true)}>
            Agenda
          </button>
        </nav>
        <div className="me">
          <span className="avatar sm" style={{ background: me.color }}>
            {initials(me.name)}
          </span>
          <span className="me-name">
            {me.name}
            {me.speakerFor && <small className="badge">Expositor</small>}
          </span>
          <button className="btn ghost sm" onClick={leaveEvent}>
            Salir
          </button>
        </div>
      </header>

      {!connected && <div className="banner">Conexión perdida. Reconectando…</div>}

      {room && snapshot?.roomId === room.id ? (
        <RoomView
          key={room.id}
          session={session}
          room={room}
          snapshot={snapshot.data}
          users={usersRef.current}
          usersVersion={usersVersion}
          now={now}
          onLeave={leaveRoom}
          onSwitch={enterRoom}
        />
      ) : (
        <Hall
          session={session}
          users={usersRef.current}
          usersVersion={usersVersion}
          now={now}
          onEnterRoom={enterRoom}
          onOpenAgenda={() => setAgendaOpen(true)}
        />
      )}

      {agendaOpen && (
        <Agenda
          event={event}
          now={now}
          currentRoomId={me.roomId}
          onClose={() => setAgendaOpen(false)}
          onGo={(roomId) => {
            setAgendaOpen(false);
            enterRoom(roomId);
          }}
        />
      )}
    </div>
  );
}
