import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { roomMap } from "../../shared/maps.ts";
import type { ChatMessage, Question, Room, RoomSnapshot, Stage, StageMode, User, Venue } from "../../shared/types.ts";
import AvatarCanvas from "./AvatarCanvas.tsx";
import { useBroadcaster, useLiveViewer } from "./live.ts";
import { formatTime, minutesUntil, roomSchedule, socket, toEmbedUrl } from "./lib.ts";
import { EmoteButtons } from "./SayBar.tsx";
import Scene, { type SceneHandle } from "./Scene.tsx";

// pdf.js pesa bastante: se carga solo cuando hay diapositivas que mostrar.
const SlideViewer = lazy(() => import("./SlideViewer.tsx"));

type Tab = "chat" | "questions" | "people";
type Broadcaster = ReturnType<typeof useBroadcaster>;

export default function RoomView({
  me,
  venue,
  room,
  snapshot,
  users,
  usersVersion,
  now,
  speakerCode,
  onLeave,
  onClaim,
}: {
  me: User;
  venue: Venue;
  room: Room;
  snapshot: RoomSnapshot;
  users: Map<string, User>;
  usersVersion: number;
  now: number;
  speakerCode: string | null;
  onLeave: () => void;
  onClaim: (code: string) => Promise<void>;
}) {
  const map = useMemo(() => roomMap(venue.theme, room.color), [venue.theme, room.color]);
  const scene = useRef<SceneHandle>(null);
  const [phase, setPhase] = useState<"entering" | "seated">("entering");
  const [stage, setStage] = useState<Stage>(snapshot.stage);
  const [chat, setChat] = useState<ChatMessage[]>(snapshot.chat);
  const [questions, setQuestions] = useState<Question[]>(snapshot.questions);
  const [tab, setTab] = useState<Tab>("chat");
  const [pageCount, setPageCount] = useState(0);
  const isPresenter = me.speakerFor === room.id && stage.presenterId === me.id;
  const { current, next } = roomSchedule(venue, room.id, now);

  const remote = useLiveViewer(stage, isPresenter);
  const broadcaster = useBroadcaster(isPresenter, stage.live);

  // Al entrar, el personaje camina desde la puerta hasta su asiento (o al atril si presenta).
  useEffect(() => {
    const target =
      me.speakerFor === room.id && map.podium
        ? map.podium
        : snapshot.seat !== null
          ? map.seats[snapshot.seat]!
          : map.standing[Math.floor(Math.random() * map.standing.length)]!;
    const timer = setTimeout(() => {
      if (!scene.current?.walkTo(target, () => setTimeout(() => setPhase("seated"), 250))) setPhase("seated");
    }, 300);
    return () => clearTimeout(timer);
    // Solo al montar: la sala se vuelve a montar cada vez que se entra.
  }, []);

  useEffect(() => {
    const onChat = (m: ChatMessage) => {
      setChat((c) => [...c.slice(-199), m]);
      scene.current?.bubble(m.userId, m.text);
    };
    socket.on("chat", onChat);
    socket.on("questions", setQuestions);
    socket.on("stage", setStage);
    return () => {
      socket.off("chat", onChat);
      socket.off("questions", setQuestions);
      socket.off("stage", setStage);
    };
  }, []);

  // El expositor puede pasar diapositivas con las flechas del teclado.
  useEffect(() => {
    if (!isPresenter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (stage.mode !== "slides" || !stage.slidesUrl) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(stage.slide + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(stage.slide - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const goTo = (n: number) => {
    if (n >= 1 && (!pageCount || n <= pageCount)) socket.emit("setSlide", n);
  };

  const claim = async (code: string) => {
    await onClaim(code);
    if (map.podium) scene.current?.walkTo(map.podium);
  };

  void usersVersion;
  const attendees = [...users.values()].filter((u) => u.roomId === room.id);
  const presenter = stage.presenterId ? users.get(stage.presenterId) : null;
  const openQuestions = questions.filter((q) => !q.answered).length;

  return (
    <main className={`room ${phase}`} style={{ "--room": room.color } as React.CSSProperties}>
      <section className="room-main">
        <header className="room-head">
          <div>
            <p className="eyebrow">
              {room.name}
              {current && <span className="status live">En vivo</span>}
            </p>
            <h1>{current?.title ?? next?.title ?? room.topic}</h1>
            <p className="muted">
              {current
                ? `${current.speaker} · ${formatTime(current.start)} – ${formatTime(current.end)}`
                : next
                  ? `Empieza ${minutesUntil(next.start, now)} · ${next.speaker}`
                  : "No hay más charlas programadas en esta sala."}
            </p>
          </div>
          <button className="btn ghost" onClick={onLeave}>
            ← Salir al salón
          </button>
        </header>

        <div className="stage">
          <StageView stage={stage} remote={remote} broadcaster={broadcaster} isPresenter={isPresenter} room={room} hint={(current ?? next)?.description} onPageCount={setPageCount} />
        </div>

        <div className="stage-bar">
          <EmoteButtons />
          <span className="muted small stage-status">
            {presenter ? `Presenta: ${presenter.name}` : "El ponente aún no está en la sala"}
            {stage.live?.audio && " · 🎙 hablando"}
            {stage.mode === "slides" && stage.slidesUrl && pageCount > 0 && ` · Diapositiva ${stage.slide} de ${pageCount}`}
          </span>
          {isPresenter ? (
            <PresenterControls venueId={venue.id} roomId={room.id} speakerCode={speakerCode ?? ""} stage={stage} pageCount={pageCount} goTo={goTo} broadcaster={broadcaster} />
          ) : (
            <ClaimSpeaker onClaim={claim} />
          )}
        </div>

        <div className="audience">
          <Scene
            map={map}
            me={me}
            users={users}
            inScene={(u) => u.roomId === room.id}
            camera={phase === "entering" ? "follow" : "fit"}
            names="hover"
            screen={{ color: room.color, title: current?.title ?? room.name, live: Boolean(current) }}
            media={{ sponsors: venue.sponsors, title: venue.organizer }}
            locked={phase === "entering"}
            onDoor={onLeave}
            handle={scene}
            label={`Público de ${room.name}`}
          />
          {phase === "entering" && <p className="scene-hint">Buscando tu asiento…</p>}
        </div>
      </section>

      <aside className="room-side">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
            Chat
          </button>
          <button role="tab" aria-selected={tab === "questions"} onClick={() => setTab("questions")}>
            Preguntas {openQuestions > 0 && <span className="count">{openQuestions}</span>}
          </button>
          <button role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}>
            Asistentes <span className="count">{attendees.length}</span>
          </button>
        </div>
        {tab === "chat" && <ChatPanel messages={chat} meId={me.id} users={users} />}
        {tab === "questions" && <QuestionsPanel questions={questions} meId={me.id} isPresenter={isPresenter} />}
        {tab === "people" && (
          <ul className="people-list padded">
            {attendees.map((u) => (
              <li key={u.id}>
                <AvatarCanvas look={u.look} size={32} head />
                <div>
                  <p>
                    {u.name}
                    {u.id === me.id && <span className="muted"> (tú)</span>}
                    {u.id === stage.presenterId && <small className="badge">Ponente</small>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  );
}

function MediaPlayer({ stream, kind, muted = false }: { stream: MediaStream; kind: "video" | "audio"; muted?: boolean }) {
  const ref = useRef<HTMLMediaElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current!;
    el.srcObject = stream;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, [stream]);

  return (
    <>
      {kind === "video" ? (
        <video ref={ref as React.RefObject<HTMLVideoElement>} className="live-video" playsInline autoPlay muted={muted} />
      ) : (
        <audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay />
      )}
      {blocked && (
        <button className="btn primary unmute" onClick={() => ref.current?.play().then(() => setBlocked(false))}>
          🔊 Activar sonido
        </button>
      )}
    </>
  );
}

function StageView({
  stage,
  remote,
  broadcaster,
  isPresenter,
  room,
  hint,
  onPageCount,
}: {
  stage: Stage;
  remote: MediaStream | null;
  broadcaster: Broadcaster;
  isPresenter: boolean;
  room: Room;
  hint: string | undefined;
  onPageCount: (n: number) => void;
}) {
  const remoteHasVideo = Boolean(remote?.getVideoTracks().length);
  // La voz del ponente suena aunque en pantalla se vean las diapositivas.
  const audioOnly = !isPresenter && remote && stage.live?.audio && !(stage.mode === "live" && remoteHasVideo);

  let content: React.ReactNode;
  if (stage.mode === "live" && stage.live?.video) {
    content = isPresenter ? (
      broadcaster.preview ? <MediaPlayer stream={broadcaster.preview} kind="video" muted /> : null
    ) : remote && remoteHasVideo ? (
      <MediaPlayer stream={remote} kind="video" />
    ) : (
      <div className="stage-empty">
        <p className="stage-empty-title">Conectando con el ponente…</p>
      </div>
    );
  } else if (stage.mode === "stream" && stage.streamUrl) {
    content = (
      <iframe
        src={toEmbedUrl(stage.streamUrl)}
        title={`Transmisión de ${room.name}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  } else if (stage.slidesUrl) {
    content = (
      <Suspense fallback={<div className="slide-viewer" />}>
        <SlideViewer url={stage.slidesUrl} page={stage.slide} onPageCount={onPageCount} />
      </Suspense>
    );
  } else {
    content = (
      <div className="stage-empty">
        <p className="stage-empty-title">{isPresenter ? "Comparte tu presentación" : "La presentación empezará pronto"}</p>
        <p className="muted">
          {isPresenter
            ? "Comparte tu pantalla o tu cámara, activa el micrófono, sube un PDF o pega el enlace de una transmisión. Todos en la sala lo verán al instante."
            : hint ?? "Mientras tanto, saluda en el chat o deja una pregunta."}
        </p>
      </div>
    );
  }

  return (
    <>
      {content}
      {audioOnly && <MediaPlayer stream={remote} kind="audio" />}
    </>
  );
}

function ClaimSpeaker({ onClaim }: { onClaim: (code: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  if (!open) {
    return (
      <button className="link small" onClick={() => setOpen(true)}>
        ¿Eres el ponente?
      </button>
    );
  }
  return (
    <form
      className="stream-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await onClaim(code.trim());
        } catch (err) {
          setError(err instanceof Error ? err.message : "Código inválido");
        }
      }}
    >
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de ponente" aria-label="Código de ponente" maxLength={20} autoFocus />
      <button className="btn sm" disabled={!code.trim()}>
        Presentar
      </button>
      {error && <span className="error small">{error}</span>}
    </form>
  );
}

const MODE_LABEL: Record<StageMode, string> = { live: "En vivo", slides: "Diapositivas", stream: "Video" };

function PresenterControls({
  venueId,
  roomId,
  speakerCode,
  stage,
  pageCount,
  goTo,
  broadcaster,
}: {
  venueId: string;
  roomId: string;
  speakerCode: string;
  stage: Stage;
  pageCount: number;
  goTo: (n: number) => void;
  broadcaster: Broadcaster;
}) {
  const [streamInput, setStreamInput] = useState(stage.streamUrl ?? "");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { videoKind, micOn, startVideo, stopVideo, toggleMic, error } = broadcaster;

  const upload = async (file: File) => {
    setStatus("Subiendo…");
    try {
      const res = await fetch(`/api/venues/${venueId}/rooms/${roomId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "X-Speaker-Code": speakerCode, "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? "" : (data.error ?? "No se pudo subir el archivo"));
    } catch {
      setStatus("No se pudo subir el archivo");
    }
  };

  const modes = (["live", "slides", "stream"] as const).filter((m) =>
    m === "live" ? Boolean(stage.live?.video) : m === "slides" ? Boolean(stage.slidesUrl) : Boolean(stage.streamUrl),
  );

  return (
    <div className="presenter">
      <div className="presenter-row">
        <button className={`btn sm ${micOn ? "on" : ""}`} onClick={toggleMic} aria-pressed={micOn}>
          {micOn ? "🎙 Micrófono activo" : "🎙 Activar micrófono"}
        </button>
        <button className={`btn sm ${videoKind === "screen" ? "on" : ""}`} onClick={() => (videoKind === "screen" ? stopVideo() : startVideo("screen"))} aria-pressed={videoKind === "screen"}>
          {videoKind === "screen" ? "Dejar de compartir" : "🖥 Compartir pantalla"}
        </button>
        <button className={`btn sm ${videoKind === "camera" ? "on" : ""}`} onClick={() => (videoKind === "camera" ? stopVideo() : startVideo("camera"))} aria-pressed={videoKind === "camera"}>
          {videoKind === "camera" ? "Apagar cámara" : "📷 Cámara"}
        </button>
        {modes.length > 1 && (
          <div className="segmented">
            {modes.map((m) => (
              <button key={m} aria-pressed={stage.mode === m} onClick={() => socket.emit("setMode", m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="presenter-row">
        {stage.slidesUrl && stage.mode === "slides" && (
          <div className="slide-nav">
            <button className="btn sm" onClick={() => goTo(stage.slide - 1)} disabled={stage.slide <= 1} aria-label="Diapositiva anterior">
              ←
            </button>
            <button className="btn sm" onClick={() => goTo(stage.slide + 1)} disabled={pageCount > 0 && stage.slide >= pageCount} aria-label="Diapositiva siguiente">
              →
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          {stage.slidesUrl ? "Cambiar PDF" : "Subir PDF"}
        </button>
        <form
          className="stream-form"
          onSubmit={(e) => {
            e.preventDefault();
            socket.emit("setStream", streamInput.trim() || null);
          }}
        >
          <input value={streamInput} onChange={(e) => setStreamInput(e.target.value)} placeholder="Enlace de YouTube Live, Vimeo…" aria-label="Enlace de la transmisión" />
          <button className="btn sm">{stage.streamUrl ? "Actualizar" : "Transmitir"}</button>
          {stage.streamUrl && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setStreamInput("");
                socket.emit("setStream", null);
              }}
            >
              Quitar
            </button>
          )}
        </form>
      </div>
      {(status || error) && <span className="small error">{status || error}</span>}
    </div>
  );
}

function ChatPanel({ messages, meId, users }: { messages: ChatMessage[]; meId: string; users: Map<string, User> }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="panel">
      <ol className="chat-list" ref={listRef}>
        {messages.length === 0 && <li className="muted empty">Nadie ha escrito todavía. ¡Saluda!</li>}
        {messages.map((m) => {
          const look = users.get(m.userId)?.look;
          return (
            <li key={m.id} className={m.userId === meId ? "mine" : ""}>
              {look ? <AvatarCanvas look={look} size={28} head /> : <span className="avatar-gone" />}
              <div>
                <p className="chat-meta">
                  <strong>{m.name}</strong> <span className="muted">{formatTime(m.ts)}</span>
                </p>
                <p className="chat-text">{m.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          socket.emit("chat", text);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Escribe un mensaje…" aria-label="Mensaje" />
        <button className="btn primary sm" disabled={!text.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}

function QuestionsPanel({ questions, meId, isPresenter }: { questions: Question[]; meId: string; isPresenter: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="panel">
      <form
        className="composer top"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          socket.emit("ask", text);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Haz una pregunta al ponente…" aria-label="Pregunta" />
        <button className="btn primary sm" disabled={!text.trim()}>
          Preguntar
        </button>
      </form>
      <ol className="question-list">
        {questions.length === 0 && <li className="muted empty">Aún no hay preguntas. Vota las que más te interesen.</li>}
        {questions.map((q) => {
          const voted = q.votes.includes(meId);
          return (
            <li key={q.id} className={q.answered ? "answered" : ""}>
              <button className={`vote ${voted ? "voted" : ""}`} onClick={() => socket.emit("vote", q.id)} aria-pressed={voted} aria-label="Votar pregunta">
                ▲<span>{q.votes.length}</span>
              </button>
              <div>
                <p>{q.text}</p>
                <p className="muted small">
                  {q.name}
                  {q.answered && " · Respondida"}
                </p>
                {isPresenter && (
                  <button className="link small" onClick={() => socket.emit("markAnswered", q.id)}>
                    {q.answered ? "Marcar como pendiente" : "Marcar como respondida"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
