import { io, type Socket } from "socket.io-client";
import type { Account, ClientToServerEvents, ServerToClientEvents, Talk, Venue } from "../../shared/types.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: true });

const TOKEN_KEY = "myconferences.token";

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin almacenamiento disponible: la sesión solo dura lo que dure la pestaña.
  }
}

export async function authRequest(kind: "login" | "register", body: Record<string, string>) {
  const res = await fetch(`/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo conectar con el servidor");
  return data as { account: Account; token: string };
}

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

export type TalkStatus = "live" | "upcoming" | "past";

export const talkStatus = (talk: Talk, now: number): TalkStatus =>
  now < talk.start ? "upcoming" : now >= talk.end ? "past" : "live";

export function roomSchedule(venue: Venue, roomId: string, now: number) {
  const talks = venue.talks.filter((t) => t.roomId === roomId).sort((a, b) => a.start - b.start);
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
