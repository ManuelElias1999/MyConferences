import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ChatMessage, Question, Room, RoomSnapshot, Stage, User } from "../../shared/types.ts";
import type { Session } from "./App.tsx";
import { formatTime, initials, minutesUntil, roomSchedule, socket, toEmbedUrl } from "./lib.ts";

// pdf.js pesa bastante: se carga solo cuando hay diapositivas que mostrar.
const SlideViewer = lazy(() => import("./SlideViewer.tsx"));

type Tab = "chat" | "questions" | "people";

export default function RoomView({
  session,
  room,
  snapshot,
  users,
  usersVersion,
  now,
  onLeave,
  onSwitch,
}: {
  session: Session;
  room: Room;
  snapshot: RoomSnapshot;
  users: Map<string, User>;
  usersVersion: number;
  now: number;
  onLeave: () => void;
  onSwitch: (roomId: string) => void;
}) {
  const { me, event } = session;
  const [stage, setStage] = useState<Stage>(snapshot.stage);
  const [chat, setChat] = useState<ChatMessage[]>(snapshot.chat);
  const [questions, setQuestions] = useState<Question[]>(snapshot.questions);
  const [tab, setTab] = useState<Tab>("chat");
  const [pageCount, setPageCount] = useState(0);
  const isPresenter = me.speakerFor === room.id;
  const { current, next } = roomSchedule(event, room.id, now);

  useEffect(() => {
    const onChat = (m: ChatMessage) => setChat((c) => [...c.slice(-199), m]);
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

  void usersVersion;
  const attendees = [...users.values()].filter((u) => u.roomId === room.id);
  const presenter = stage.presenterId ? users.get(stage.presenterId) : null;
  const openQuestions = questions.filter((q) => !q.answered).length;

  return (
    <main className="room" style={{ "--room": room.color } as React.CSSProperties}>
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
          <div className="room-actions">
            <select
              value={room.id}
              onChange={(e) => onSwitch(e.target.value)}
              aria-label="Cambiar de sala"
            >
              {event.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="btn ghost" onClick={onLeave}>
              ← Salón principal
            </button>
          </div>
        </header>

        <div className="stage">
          {stage.mode === "stream" && stage.streamUrl ? (
            <iframe
              src={toEmbedUrl(stage.streamUrl)}
              title={`Transmisión de ${room.name}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : stage.slidesUrl ? (
            <Suspense fallback={<div className="slide-viewer" />}>
              <SlideViewer url={stage.slidesUrl} page={stage.slide} onPageCount={setPageCount} />
            </Suspense>
          ) : (
            <div className="stage-empty">
              <p className="stage-empty-title">{isPresenter ? "Comparte tu presentación" : "La presentación empezará pronto"}</p>
              <p className="muted">
                {isPresenter
                  ? "Sube un PDF o pega el enlace de tu transmisión en vivo. Todos en la sala lo verán al instante."
                  : (current ?? next)?.description ?? "Mientras tanto, saluda en el chat o deja una pregunta."}
              </p>
            </div>
          )}
        </div>

        <div className="stage-bar">
          <span className="muted small">
            {presenter ? `Presenta: ${presenter.name}` : "El expositor aún no está en la sala"}
            {stage.mode === "slides" && stage.slidesUrl && pageCount > 0 && ` · Diapositiva ${stage.slide} de ${pageCount}`}
          </span>
          {isPresenter && <PresenterControls roomId={room.id} speakerCode={session.speakerCode} stage={stage} pageCount={pageCount} goTo={goTo} />}
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
        {tab === "chat" && <ChatPanel messages={chat} meId={me.id} />}
        {tab === "questions" && <QuestionsPanel questions={questions} meId={me.id} isPresenter={isPresenter} />}
        {tab === "people" && (
          <ul className="people-list padded">
            {attendees.map((u) => (
              <li key={u.id}>
                <span className="avatar sm" style={{ background: u.color }}>
                  {initials(u.name)}
                </span>
                <div>
                  <p>
                    {u.name}
                    {u.id === me.id && <span className="muted"> (tú)</span>}
                    {u.id === stage.presenterId && <small className="badge">Expositor</small>}
                  </p>
                  {u.title && <p className="muted small">{u.title}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  );
}

function PresenterControls({
  roomId,
  speakerCode,
  stage,
  pageCount,
  goTo,
}: {
  roomId: string;
  speakerCode: string;
  stage: Stage;
  pageCount: number;
  goTo: (n: number) => void;
}) {
  const [streamInput, setStreamInput] = useState(stage.streamUrl ?? "");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setStatus("Subiendo…");
    try {
      const res = await fetch(`/api/rooms/${roomId}/slides`, {
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

  return (
    <div className="presenter">
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
      {stage.slidesUrl && stage.streamUrl && (
        <div className="segmented">
          <button aria-pressed={stage.mode === "slides"} onClick={() => socket.emit("setMode", "slides")}>
            Diapositivas
          </button>
          <button aria-pressed={stage.mode === "stream"} onClick={() => socket.emit("setMode", "stream")}>
            Video
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
        <input
          value={streamInput}
          onChange={(e) => setStreamInput(e.target.value)}
          placeholder="Enlace de YouTube Live, Vimeo…"
          aria-label="Enlace de la transmisión"
        />
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
      {status && <span className="small muted">{status}</span>}
    </div>
  );
}

function ChatPanel({ messages, meId }: { messages: ChatMessage[]; meId: string }) {
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
        {messages.map((m) => (
          <li key={m.id} className={m.userId === meId ? "mine" : ""}>
            <span className="avatar xs" style={{ background: m.color }}>
              {initials(m.name)}
            </span>
            <div>
              <p className="chat-meta">
                <strong>{m.name}</strong> <span className="muted">{formatTime(m.ts)}</span>
              </p>
              <p className="chat-text">{m.text}</p>
            </div>
          </li>
        ))}
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
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Haz una pregunta al expositor…" aria-label="Pregunta" />
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
