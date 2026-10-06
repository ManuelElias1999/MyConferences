import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, EventInfo, ServerToClientEvents, Talk } from "../../shared/types.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: true });

export const AVATAR_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#ef4444", "#8b5cf6", "#14b8a6"];

export interface Profile {
  name: string;
  title: string;
  color: string;
  speakerCode: string;
}

const PROFILE_KEY = "myconferences.profile";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Sin almacenamiento disponible: el perfil solo vive en esta pestaña.
  }
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

export type TalkStatus = "live" | "upcoming" | "past";

export const talkStatus = (talk: Talk, now: number): TalkStatus =>
  now < talk.start ? "upcoming" : now >= talk.end ? "past" : "live";

export function roomSchedule(event: EventInfo, roomId: string, now: number) {
  const talks = event.talks.filter((t) => t.roomId === roomId).sort((a, b) => a.start - b.start);
  return {
    current: talks.find((t) => talkStatus(t, now) === "live") ?? null,
    next: talks.find((t) => t.start > now) ?? null,
    talks,
  };
}

export function minutesUntil(ts: number, now: number) {
  const mins = Math.max(0, Math.round((ts - now) / 60_000));
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  return `en ${h} h ${mins % 60 ? `${mins % 60} min` : ""}`.trim();
}

/** Convierte enlaces de YouTube o Vimeo a su versión incrustable. */
export function toEmbedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (host === "youtube.com") {
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1] ?? null;
    }
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    if (host === "vimeo.com") {
      const vimeoId = url.pathname.match(/^\/(\d+)/)?.[1];
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
    }
    return url.toString();
  } catch {
    return raw;
  }
}
