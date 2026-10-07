// Tipos compartidos entre el servidor y el cliente.

import type { ThemeId } from "./themes.ts";

export type HairStyle = "short" | "long" | "spiky" | "bun" | "cap" | "bald";

/** Apariencia del personaje. Los colores salen de las paletas de shared/look.ts. */
export interface Look {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  shirt: string;
  pants: string;
  shoes: string;
}

/** Datos de la cuenta que ve su dueño. El correo nunca se envía a otros usuarios. */
export interface Account {
  id: string;
  email: string;
  name: string;
  look: Look;
  /** Si es una cuenta de empresa, puede organizar eventos. */
  company: { name: string } | null;
}

export interface Room {
  id: string;
  name: string;
  topic: string;
  color: string;
  /** El auditorio principal: todo evento tiene uno, es más grande y tiene entrada propia. */
  main: boolean;
  /** Temática propia de la sala (su puerta y su interior); si no tiene, usa la del evento. */
  theme?: ThemeId | null;
}

/** Patrocinador de un evento: su logo rota en las pantallas del lugar. */
export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  url: string | null;
  /** Lo que cuenta su representante en el stand. */
  pitch: string;
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

/** Lo que se muestra en recepción antes de entrar: los eventos privados no aparecen. */
export interface VenueSummary {
  id: string;
  name: string;
  tagline: string;
}

/** Un evento (se elige por su número en recepción): su lugar, salas, agenda y patrocinadores. */
export interface Venue extends VenueSummary {
  private: boolean;
  /** Estilo de todo el lugar del evento: pasillos y salas. */
  theme: ThemeId;
  /** Empresa que organiza el evento. */
  organizer: string;
  /** Logo del evento para la pantalla grande del lobby (o null para mostrar el nombre). */
  logoUrl: string | null;
  rooms: Room[];
  talks: Talk[];
  sponsors: Sponsor[];
}

/** Lo que la empresa ve y edita de su evento en el panel. */
export interface CompanyEvent {
  venue: Venue;
  whitelist: string[];
  speakerCodes: Record<string, string>;
}

/** Lo que la empresa envía al crear o editar un evento. */
export interface EventInput {
  name: string;
  tagline: string;
  theme: ThemeId;
  private: boolean;
  whitelist: string[];
  /** La primera es el auditorio principal. Salas existentes llevan su id; las nuevas, no. */
  rooms: { id?: string; name: string; topic: string; color: string; theme?: ThemeId | null; talks: TalkInput[] }[];
}

/** Charla de la agenda tal como la carga la empresa. */
export interface TalkInput {
  title: string;
  speaker: string;
  /** Timestamps en milisegundos. */
  start: number;
  end: number;
}

export interface User {
  id: string;
  name: string;
  look: Look;
  /** true si entró con una cuenta; false si es invitado. */
  registered: boolean;
  /** Salón en el que está, o null si está en recepción. */
  venueId: string | null;
  /** Sala del salón en la que está, o null si está caminando por el salón. */
  roomId: string | null;
  /** Piso del recinto en el que camina (0 es la planta baja). */
  floor: number;
  /** Sala que puede presentar, si dio el código de expositor. */
  speakerFor: string | null;
  /** Está en una charla privada por micrófono (los demás no la escuchan). */
  inCall: boolean;
  /** Posición en baldosas del mapa en el que está. */
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
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

export type StageMode = "slides" | "stream" | "live";

/** Transmisión en vivo del expositor por WebRTC. */
export interface LiveInfo {
  video: "screen" | "camera" | null;
  audio: boolean;
  /** Cambia cada vez que el expositor cambia lo que transmite; los asistentes se reconectan. */
  session: number;
}

export interface Stage {
  mode: StageMode;
  slidesUrl: string | null;
  slidesName: string | null;
  slide: number;
  streamUrl: string | null;
  presenterId: string | null;
  live: LiveInfo | null;
}

export interface RoomSnapshot {
  stage: Stage;
  chat: ChatMessage[];
  questions: Question[];
  /** Asiento asignado, o null si la sala está llena y te quedas de pie. */
  seat: number | null;
}

export interface Bubble {
  userId: string;
  text: string;
}

export type RtcSignal =
  | { kind: "request"; session: number }
  | { kind: "offer"; session: number; sdp: string }
  | { kind: "answer"; session: number; sdp: string }
  | { kind: "ice"; session: number; candidate: RTCIceCandidateInit };

/** Charla privada por micrófono entre algunas personas del evento. */
export interface CallInfo {
  id: string;
  members: User[];
}

export interface CallInvite {
  callId: string;
  from: User;
  /** Nombres de quienes ya están en la charla. */
  members: string[];
}

export type CallSignal = { kind: "offer" | "answer"; sdp: string } | { kind: "ice"; candidate: RTCIceCandidateInit };

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface Welcome {
  user: User;
  account: Account | null;
  users: User[];
  venues: VenueSummary[];
}

export interface ClientToServerEvents {
  hello: (req: { token: string | null }, ack: Ack<Welcome>) => void;
  /** Inicia o cierra sesión sin perder la posición. */
  setAccount: (token: string | null, ack: Ack<{ user: User; account: Account | null }>) => void;
  setLook: (req: { name: string; look: Look }, ack: Ack<{ user: User; account: Account }>) => void;
  move: (pos: { x: number; y: number }) => void;
  say: (text: string) => void;
  /** Pedirle a la recepcionista un salón por su número. */
  requestVenue: (number: string, ack: Ack<{ venue: Venue; user: User; users: User[] }>) => void;
  leaveVenue: (ack: Ack<{ user: User; users: User[] }>) => void;
  enterRoom: (roomId: string, ack: Ack<RoomSnapshot & { user: User }>) => void;
  leaveRoom: (ack: Ack<{ user: User }>) => void;
  /** Subir o bajar por la escalera. */
  changeFloor: (floor: number, ack: Ack<{ user: User }>) => void;
  /** Reacción rápida (👋 👏 ❤️ 😂 🎉) sobre el personaje. */
  emote: (emoji: string) => void;
  claimSpeaker: (code: string, ack: Ack<{ user: User }>) => void;
  chat: (text: string) => void;
  ask: (text: string) => void;
  vote: (questionId: string) => void;
  markAnswered: (questionId: string) => void;
  setSlide: (slide: number) => void;
  setStream: (url: string | null) => void;
  setMode: (mode: StageMode) => void;
  setLive: (live: { video: LiveInfo["video"]; audio: boolean } | null) => void;
  rtc: (to: string, signal: RtcSignal) => void;
  /** Invitar a alguien a tu charla privada (si no tienes una, se crea). */
  callInvite: (userId: string, ack: Ack<null>) => void;
  callRespond: (callId: string, accept: boolean, ack: Ack<CallInfo | null>) => void;
  callLeave: () => void;
  callSignal: (to: string, signal: CallSignal) => void;
}

export interface ServerToClientEvents {
  userJoined: (user: User) => void;
  userLeft: (userId: string) => void;
  userUpdated: (user: User) => void;
  /** La empresa editó su evento: llega con salas y patrocinadores actualizados. */
  venueUpdated: (venue: Venue) => void;
  /** El evento se cerró: quien estaba dentro vuelve a recepción. */
  evicted: (data: { user: User; users: User[]; reason: string }) => void;
  emote: (data: { userId: string; emoji: string }) => void;
  moved: (pos: { id: string; x: number; y: number }) => void;
  bubble: (bubble: Bubble) => void;
  chat: (msg: ChatMessage) => void;
  questions: (questions: Question[]) => void;
  stage: (stage: Stage) => void;
  rtc: (from: string, signal: RtcSignal) => void;
  callInvited: (invite: CallInvite) => void;
  /** Quiénes están en tu charla; null si ya no estás en ninguna. */
  callUpdated: (call: CallInfo | null) => void;
  callDeclined: (data: { name: string }) => void;
  /** La invitación ya no vale (la charla terminó). */
  callCancelled: (callId: string) => void;
  callSignal: (from: string, signal: CallSignal) => void;
}
