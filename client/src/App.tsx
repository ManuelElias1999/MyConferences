import { useCallback, useEffect, useRef, useState } from "react";
import { planOf } from "../../shared/plans.ts";
import type { Account, RoomSnapshot, User, Venue, VenueSummary } from "../../shared/types.ts";
import Agenda from "./Agenda.tsx";
import CompanyPanel, { CompanyUpgrade } from "./CompanyPanel.tsx";
import AdminPanel from "./AdminPanel.tsx";
import Plans from "./Plans.tsx";
import Gate from "./Gate.tsx";
import AvatarCanvas from "./AvatarCanvas.tsx";
import AvatarEditor from "./AvatarEditor.tsx";
import { usePrivateCall } from "./call.ts";
import CallPanel, { UserCard } from "./CallPanel.tsx";
import Hall from "./Hall.tsx";
import { loadToken, saveToken, socket } from "./lib.ts";
import Reception from "./Reception.tsx";
import RoomView from "./RoomView.tsx";

type Place =
  | { kind: "reception" }
  /** `visit` cambia cada vez que se entra al salón: así el plano toma la posición que da el servidor. */
  | { kind: "hall"; venue: Venue; visit: number }
  | { kind: "room"; venue: Venue; roomId: string; snapshot: RoomSnapshot; visit: number };

const FADE_MS = 350;

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [place, setPlace] = useState<Place>({ kind: "reception" });
  const [connected, setConnected] = useState(socket.connected);
  const [fading, setFading] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [editor, setEditor] = useState<{ welcome: boolean } | null>(null);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [panelNew, setPanelNew] = useState(false);
  const [notice, setNotice] = useState("");
  const call = usePrivateCall(me?.id ?? null);
  // En una sala con tarima, la pantalla que comparte quien está arriba se ve en la pantalla grande del plano.
  const stageScreen = (() => {
    const c = call.call;
    if (!c?.stage) return null;
    for (const id of c.stage.presenters) {
      if (id === me?.id && call.screen) return call.screen;
      const remote = c.media[id]?.screen ? call.remotes.get(id)?.screen : null;
      if (remote) return remote;
    }
    return null;
  })();
  /** Persona a la que le hiciste clic (para invitarla a charlar). */
  const [cardUser, setCardUser] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Las posiciones cambian muchas veces por segundo: viven en un ref que los mapas
  // leen en cada frame, y `usersVersion` solo cambia cuando alguien entra, sale o cambia de lugar.
  const usersRef = useRef(new Map<string, User>());
  const [usersVersion, setUsersVersion] = useState(0);
  const bump = () => setUsersVersion((v) => v + 1);
  const replaceUsers = (list: User[]) => {
    usersRef.current = new Map(list.map((u) => [u.id, u]));
    bump();
  };

  const placeRef = useRef(place);
  placeRef.current = place;
  const meRef = useRef(me);
  meRef.current = me;
  const speakerCode = useRef<{ room: string; code: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!call.notice) return;
    setNotice(call.notice);
    call.clearNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.notice]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  const transition = useCallback((change: () => void) => {
    setFading(true);
    setTimeout(() => {
      change();
      setFading(false);
    }, FADE_MS);
  }, []);

  const goToHall = (venue: Venue, user: User, users: User[]) => {
    setMe(user);
    replaceUsers(users);
    setPlace({ kind: "hall", venue, visit: Date.now() });
  };

  const enterRoom = useCallback(
    (roomId: string, venue: Venue, instant = false) => {
      socket.emit("enterRoom", roomId, (res) => {
        if (!res.ok) return;
        const go = () => {
          setMe(res.data.user);
          setPlace({ kind: "room", venue, roomId, snapshot: res.data, visit: Date.now() });
        };
        const code = speakerCode.current;
        if (code?.room === `${venue.id}/${roomId}` && !res.data.user.speakerFor) {
          // Tras una reconexión se vuelve a reclamar el atril.
          socket.emit("claimSpeaker", code.code, (claim) => {
            if (claim.ok) {
              // El aviso del cambio de ponente pudo llegar antes de montar la sala: se aplica aquí.
              res.data.user = claim.data.user;
              res.data.stage = { ...res.data.stage, presenterId: claim.data.user.id, live: null };
              res.data.seat = null;
            }
            if (instant) go();
            else transition(go);
          });
          return;
        }
        if (instant) go();
        else transition(go);
      });
    },
    [transition],
  );

  // ----- Conexión -----

  // Pide al servidor el estado de la recepción (también después de iniciar sesión o confirmar el correo).
  const helloRef = useRef<() => void>(() => {});
  useEffect(() => {
    const hello = () => {
      const token = loadToken();
      socket.emit("hello", { token }, (res) => {
        if (!res.ok) return;
        if (token && !res.data.account) saveToken(null);
        setMe(res.data.user);
        setAccount(res.data.account);
        setVenues(res.data.venues);
        replaceUsers(res.data.users);
        // Tras una reconexión el servidor no recuerda dónde estábamos: volvemos solos.
        const prev = placeRef.current;
        if (prev.kind === "reception") return;
        socket.emit("requestVenue", prev.venue.id, (venueRes) => {
          if (!venueRes.ok) return setPlace({ kind: "reception" });
          goToHall(venueRes.data.venue, venueRes.data.user, venueRes.data.users);
          if (prev.kind === "room") enterRoom(prev.roomId, venueRes.data.venue, true);
        });
      });
    };
    helloRef.current = hello;
    // La administración cambió algo de tu cuenta (por ejemplo, te asignó otro plan).
    const onAccount = (acc: Account) => setAccount(acc);
    socket.on("accountUpdated", onAccount);
    const onConnect = () => {
      setConnected(true);
      hello();
    };
    const onDisconnect = () => setConnected(false);
    const onUpsert = (u: User) => {
      usersRef.current.set(u.id, u);
      if (u.id === meRef.current?.id) setMe(u);
      bump();
    };
    const onLeft = (id: string) => {
      usersRef.current.delete(id);
      bump();
    };
    // Alguien creó una sala: se actualiza el edificio sin mover a nadie.
    const onVenue = (venue: Venue) => {
      setPlace((p) => (p.kind !== "reception" && p.venue.id === venue.id ? { ...p, venue } : p));
    };
    // La empresa cerró el evento: todos vuelven a recepción.
    const onEvicted = ({ user, users, reason }: { user: User; users: User[]; reason: string }) => {
      speakerCode.current = null;
      setMe(user);
      replaceUsers(users);
      setPlace({ kind: "reception" });
      setNotice(reason);
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
    socket.on("userJoined", onUpsert);
    socket.on("userUpdated", onUpsert);
    socket.on("userLeft", onLeft);
    socket.on("moved", onMoved);
    socket.on("venueUpdated", onVenue);
    socket.on("evicted", onEvicted);
    // El socket pudo conectarse antes de registrar los listeners.
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("userJoined", onUpsert);
      socket.off("userUpdated", onUpsert);
      socket.off("userLeft", onLeft);
      socket.off("moved", onMoved);
      socket.off("venueUpdated", onVenue);
      socket.off("evicted", onEvicted);
      socket.off("accountUpdated", onAccount);
    };
  }, [enterRoom]);

  // ----- Navegación -----

  const requestVenue = (number: string) =>
    new Promise<string>((resolve, reject) => {
      socket.emit("requestVenue", number, (res) => {
        if (!res.ok) return reject(new Error(res.error));
        resolve(res.data.venue.name);
        // Se deja leer la respuesta de la recepcionista antes de cambiar de lugar.
        setTimeout(() => transition(() => goToHall(res.data.venue, res.data.user, res.data.users)), 1100);
      });
    });

  const leaveRoom = () => {
    socket.emit("leaveRoom", (res) => {
      const p = placeRef.current;
      if (!res.ok || p.kind !== "room") return;
      transition(() => {
        setMe(res.data.user);
        setPlace({ kind: "hall", venue: p.venue, visit: Date.now() });
      });
    });
  };

  const leaveVenue = () => {
    socket.emit("leaveVenue", (res) => {
      if (!res.ok) return;
      speakerCode.current = null;
      transition(() => {
        setMe(res.data.user);
        replaceUsers(res.data.users);
        setPlace({ kind: "reception" });
      });
    });
  };


  const changeFloor = (floor: number) => {
    socket.emit("changeFloor", floor, (res) => {
      if (res.ok) transition(() => setMe(res.data.user));
    });
  };

  const claimSpeaker = (code: string) =>
    new Promise<void>((resolve, reject) => {
      socket.emit("claimSpeaker", code, (res) => {
        const p = placeRef.current;
        if (!res.ok) return reject(new Error(res.error));
        if (p.kind === "room") speakerCode.current = { room: `${p.venue.id}/${p.roomId}`, code: code.toUpperCase() };
        setMe(res.data.user);
        resolve();
      });
    });

  // ----- Cuenta -----

  /** Quien acaba de crear su cuenta elige su personaje apenas confirma el correo. */
  const justRegistered = useRef(false);

  /** Avisa al servidor con qué cuenta estás; si está confirmada, entras a la recepción. */
  const signInWith = (token: string) => {
    saveToken(token);
    socket.emit("setAccount", token, (res) => {
      if (!res.ok) return;
      setMe(res.data.user);
      setAccount(res.data.account);
      if (!res.data.account?.verified) return;
      helloRef.current();
      if (justRegistered.current) {
        justRegistered.current = false;
        setEditor({ welcome: true });
      }
    });
  };
  const onAuthDone = ({ token }: { token: string }, created: boolean) => {
    if (created) justRegistered.current = true;
    signInWith(token);
  };
  const onVerified = () => {
    const token = loadToken();
    if (token) signInWith(token);
  };

  /** «Crear evento»: si la cuenta no tiene nombre de organización, primero lo pide. Los límites dependen del plan. */
  const startCreateEvent = () => {
    if (!account) return;
    setPanelNew(true);
    if (account.company) return setPanelOpen(true);
    setUpgrading(true);
  };

  const logout = () => {
    socket.emit("setAccount", null, (res) => {
      if (!res.ok) return;
      saveToken(null);
      setMe(res.data.user);
      setAccount(null);
    });
  };

  // Sin una cuenta con el correo confirmado no se entra: primero la puerta de entrada.
  if (me && (!account || !account.verified)) {
    return <Gate account={account} onAuthDone={onAuthDone} onVerified={onVerified} onLogout={logout} />;
  }

  if (!me) {
    return (
      <div className="splash">
        <span className="brand-mark" aria-hidden />
        <p>{connected ? "Entrando a la recepción…" : "Conectando con el servidor…"}</p>
      </div>
    );
  }

  const venue = place.kind === "reception" ? null : place.venue;
  const people = [...usersRef.current.values()].filter((u) => venue && u.venueId === venue.id);
  const card = cardUser ? usersRef.current.get(cardUser) : undefined;
  const room = place.kind === "room" ? place.venue.rooms.find((r) => r.id === place.roomId) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span>MyConferences</span>
        </div>
        <nav className="crumbs" aria-label="Dónde estás">
          <span>Recepción</span>
          {venue && (
            <span>
              {venue.name}
            </span>
          )}
          {room && <span>{room.name}</span>}
        </nav>
        <div className="topbar-actions">
          {venue && (
            <>
              {venue.talks.length > 0 && (
                <button className="btn ghost sm" onClick={() => setAgendaOpen(true)}>
                  Agenda
                </button>
              )}
              <button className="btn ghost sm" onClick={leaveVenue}>
                Volver a recepción
              </button>
            </>
          )}
        </div>
        <div className="me">
          <AvatarCanvas look={me.look} size={34} head />
          <span className="me-name">
            {me.name}
            {me.speakerFor && me.speakerFor === room?.id && <small className="badge">Ponente</small>}
          </span>
          {account && (
            <button className="btn ghost sm" onClick={() => setPlansOpen(true)} title="Ver los planes">
              Plan {planOf(account.plan).name}
            </button>
          )}
          {account && (
            <button className="btn primary sm" onClick={startCreateEvent}>
              ＋ Crear evento
            </button>
          )}
          {account?.company && (
            <button
              className="btn sm"
              onClick={() => {
                setPanelNew(false);
                setPanelOpen(true);
              }}
            >
              Mis eventos
            </button>
          )}
          {account?.admin && (
            <button className="btn sm" onClick={() => setAdminOpen(true)}>
              Administración
            </button>
          )}
          {account && (
            <button className="btn sm" onClick={() => setEditor({ welcome: false })}>
              Mi personaje
            </button>
          )}
          {place.kind === "reception" && account && (
            <button className="btn ghost sm" onClick={logout}>
              Cerrar sesión
            </button>
          )}
        </div>
      </header>

      {!connected && <div className="banner">Conexión perdida. Reconectando…</div>}

      {place.kind === "reception" && (
        <Reception me={me} users={usersRef.current} venues={venues} onRequestVenue={requestVenue} />
      )}
      {place.kind === "hall" && (
        <Hall
          key={`${place.venue.id}:${place.visit}`}
          me={me}
          venue={place.venue}
          users={usersRef.current}
          usersVersion={usersVersion}
          now={now}
          onEnterRoom={(roomId) => enterRoom(roomId, place.venue)}
          onExit={leaveVenue}
          onStairs={changeFloor}
          onOpenAgenda={() => setAgendaOpen(true)}
          onUser={setCardUser}
          stageScreen={stageScreen}
        />
      )}
      {place.kind === "room" && room && (
        <RoomView
          key={place.visit}
          me={me}
          venue={place.venue}
          room={room}
          snapshot={place.snapshot}
          users={usersRef.current}
          usersVersion={usersVersion}
          now={now}
          speakerCode={speakerCode.current?.code ?? null}
          onLeave={leaveRoom}
          onClaim={claimSpeaker}
          onUser={setCardUser}
        />
      )}

      <div className={`fade ${fading ? "on" : ""}`} aria-hidden />

      {agendaOpen && venue && (
        <Agenda
          venue={venue}
          now={now}
          currentRoomId={me.roomId}
          onClose={() => setAgendaOpen(false)}
          onGo={(roomId) => {
            setAgendaOpen(false);
            enterRoom(roomId, venue);
          }}
        />
      )}
      {panelOpen && account?.company && (
        <CompanyPanel
          account={account}
          canVisit={place.kind === "reception"}
          startNew={panelNew}
          onPlans={() => setPlansOpen(true)}
          onClose={() => setPanelOpen(false)}
          onVisit={(id) => {
            setPanelOpen(false);
            requestVenue(id).catch((err: Error) => setNotice(err.message));
          }}
        />
      )}
      {venue && <CallPanel me={me} call={call} people={people} />}
      {card && venue && card.venueId === venue.id && <UserCard user={card} call={call} onClose={() => setCardUser(null)} />}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button className="btn ghost sm" onClick={() => setNotice("")} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
      {upgrading && account && (
        <CompanyUpgrade
          onClose={() => setUpgrading(false)}
          onDone={(acc) => {
            setAccount(acc);
            setUpgrading(false);
            setPanelOpen(true);
          }}
        />
      )}
      {adminOpen && account?.admin && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {plansOpen && account && <Plans account={account} onChange={setAccount} onClose={() => setPlansOpen(false)} />}
      {editor && account && (
        <AvatarEditor
          account={account}
          welcome={editor.welcome}
          onSaved={(acc) => {
            setAccount(acc);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
