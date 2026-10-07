import type { Venue } from "../../shared/types.ts";
import { formatTime, talkStatus } from "./lib.ts";
import Modal from "./Modal.tsx";

const STATUS_LABEL = { live: "En vivo", upcoming: "Próxima", past: "Terminó" } as const;

export default function Agenda({
  venue,
  now,
  currentRoomId,
  onGo,
  onClose,
}: {
  venue: Venue;
  now: number;
  currentRoomId: string | null;
  onGo: (roomId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Agenda · Sala ${venue.id}`} onClose={onClose}>
      <div className="agenda-grid">
        {venue.rooms.map((room) => (
          <section key={room.id} className="agenda-col" style={{ "--room": room.color } as React.CSSProperties}>
            <header className="agenda-col-head">
              <h3>{room.name}</h3>
              <p>{room.topic}</p>
            </header>
            <ol className="agenda-talks">
              {venue.talks
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
                      {status === "live" && room.id !== currentRoomId && (
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
    </Modal>
  );
}
