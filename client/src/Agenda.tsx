import { useEffect } from "react";
import type { EventInfo } from "../../shared/types.ts";
import { formatTime, talkStatus } from "./lib.ts";

const STATUS_LABEL = { live: "En vivo", upcoming: "Próxima", past: "Terminó" } as const;

export function AgendaGrid({
  event,
  now,
  currentRoomId = null,
  onGo,
}: {
  event: EventInfo;
  now: number;
  currentRoomId?: string | null;
  onGo?: (roomId: string) => void;
}) {
  return (
    <div className="agenda-grid">
      {event.rooms.map((room) => (
        <section key={room.id} className="agenda-col" style={{ "--room": room.color } as React.CSSProperties}>
          <header className="agenda-col-head">
            <h3>{room.name}</h3>
            <p>{room.topic}</p>
          </header>
          <ol className="agenda-talks">
            {event.talks
              .filter((t) => t.roomId === room.id)
              .sort((a, b) => a.start - b.start)
              .map((talk) => {
                const status = talkStatus(talk, now);
                return (
                  <li key={talk.id} className={`talk-card ${status}`}>
                    <div className="talk-meta">
                      <span>
                        {formatTime(talk.start)} – {formatTime(talk.end)}
                      </span>
                      <span className={`status ${status}`}>{STATUS_LABEL[status]}</span>
                    </div>
                    <h4>{talk.title}</h4>
                    <p className="talk-speaker">{talk.speaker}</p>
                    {status === "live" && onGo && room.id !== currentRoomId && (
                      <button className="btn sm" onClick={() => onGo(room.id)}>
                        Ir a la sala
                      </button>
                    )}
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export default function Agenda(props: {
  event: EventInfo;
  now: number;
  currentRoomId: string | null;
  onGo: (roomId: string) => void;
  onClose: () => void;
}) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Agenda" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Agenda</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <AgendaGrid {...props} />
      </div>
    </div>
  );
}
