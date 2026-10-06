// Tipos compartidos entre el servidor y el cliente.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: string;
  name: string;
  topic: string;
  color: string;
  /** Zona de la sala dibujada en el mapa del salón. */
  area: Rect;
  /** Al pisar la puerta se entra a la sala. */
  door: Rect;
}

export interface Talk {
  id: string;
  roomId: string;
  title: string;
  speaker: string;
  description: string;
  /** Timestamps en milisegundos. */
  start: number;
  end: number;
}

export interface EventInfo {
  name: string;
  tagline: string;
  map: { width: number; height: number; spawn: { x: number; y: number } };
  rooms: Room[];
  talks: Talk[];
}

export interface User {
  id: string;
  name: string;
  title: string;
  color: string;
  /** Sala en la que está, o null si está en el salón principal. */
  roomId: string | null;
  /** Sala que puede presentar, si entró con código de expositor. */
  speakerFor: string | null;
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  ts: number;
}

export interface Question {
  id: string;
  userId: string;
  name: string;
  text: string;
  votes: string[];
  answered: boolean;
  ts: number;
}

export type StageMode = "slides" | "stream";

export interface Stage {
  mode: StageMode;
  slidesUrl: string | null;
  slidesName: string | null;
  slide: number;
  streamUrl: string | null;
  presenterId: string | null;
}

export interface RoomSnapshot {
  stage: Stage;
  chat: ChatMessage[];
  questions: Question[];
}

export interface JoinRequest {
  name: string;
  title: string;
  color: string;
  speakerCode?: string;
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  join: (req: JoinRequest, ack: Ack<{ user: User; event: EventInfo; users: User[] }>) => void;
  move: (pos: { x: number; y: number }) => void;
  enterRoom: (roomId: string, ack: Ack<RoomSnapshot>) => void;
  leaveRoom: (ack: Ack<{ x: number; y: number }>) => void;
  chat: (text: string) => void;
  ask: (text: string) => void;
  vote: (questionId: string) => void;
  markAnswered: (questionId: string) => void;
  setSlide: (slide: number) => void;
  setStream: (url: string | null) => void;
  setMode: (mode: StageMode) => void;
}

export interface ServerToClientEvents {
  userJoined: (user: User) => void;
  userLeft: (userId: string) => void;
  userUpdated: (user: User) => void;
  moved: (pos: { id: string; x: number; y: number }) => void;
  chat: (msg: ChatMessage) => void;
  questions: (questions: Question[]) => void;
  stage: (stage: Stage) => void;
}
