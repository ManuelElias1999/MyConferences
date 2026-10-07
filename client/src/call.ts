// Charlas por micrófono, cámara y pantalla: las privadas (por invitación) y
// las de las mesas de equipo. Cada integrante abre una conexión WebRTC con
// cada uno de los demás; el servidor solo pasa las señales, así que nadie
// fuera de la charla puede escucharla ni verla.
//
// Cada conexión tiene siempre tres canales en el mismo orden: voz, cámara y
// pantalla. Prender o apagar la cámara solo cambia lo que va por su canal,
// sin volver a negociar la conexión.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CallInfo, CallInvite, CallSignal } from "../../shared/types.ts";
import { socket } from "./lib.ts";

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

// Mientras estás en una charla, el resto del evento (el ponente, los videos)
// queda en silencio: solo escuchas a la gente de tu charla.
let deafened = false;
const listeners = new Set<() => void>();
function setDeafened(value: boolean) {
  if (deafened === value) return;
  deafened = value;
  for (const l of listeners) l();
}
export const useDeafened = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deafened,
  );

/** Cola por conexión: una respuesta no puede procesarse antes que la oferta. */
function serial() {
  let chain: Promise<unknown> = Promise.resolve();
  return (task: () => Promise<unknown>) => {
    chain = chain.then(() => Promise.race([task(), new Promise((r) => setTimeout(r, 5000))])).catch(() => {});
  };
}

type Slot = 0 | 1 | 2; // voz, cámara, pantalla

interface Peer {
  pc: RTCPeerConnection;
  run: (task: () => Promise<unknown>) => void;
  /** Los tres canales, en orden; null hasta que la conexión se arma. */
  slots: RTCRtpTransceiver[] | null;
}

/** Lo que llega de cada persona de la charla. */
export interface Remote {
  audio: MediaStream | null;
  cam: MediaStream | null;
  screen: MediaStream | null;
}

export function usePrivateCall(meId: string | null) {
  const [call, setCall] = useState<CallInfo | null>(null);
  const [invites, setInvites] = useState<CallInvite[]>([]);
  const [remotes, setRemotes] = useState<Map<string, Remote>>(new Map());
  const [micOn, setMicOn] = useState(true);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState("");
  const [notice, setNotice] = useState("");
  const peers = useRef(new Map<string, Peer>());
  const local = useRef<Promise<MediaStream | null> | null>(null);
  const tracks = useRef<(MediaStreamTrack | null)[]>([null, null, null]);
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;
  const inCall = call !== null;

  useEffect(() => {
    const onUpdated = (info: CallInfo | null) => setCall(info);
    const onInvited = (inv: CallInvite) => setInvites((list) => [...list.filter((i) => i.callId !== inv.callId), inv]);
    const onCancelled = (callId: string) => setInvites((list) => list.filter((i) => i.callId !== callId));
    const onDeclined = ({ name }: { name: string }) => setNotice(`${name} no puede charlar ahora`);
    const onNotice = (text: string) => setNotice(text);
    socket.on("callUpdated", onUpdated);
    socket.on("callInvited", onInvited);
    socket.on("callCancelled", onCancelled);
    socket.on("callDeclined", onDeclined);
    socket.on("callNotice", onNotice);
    return () => {
      socket.off("callUpdated", onUpdated);
      socket.off("callInvited", onInvited);
      socket.off("callCancelled", onCancelled);
      socket.off("callDeclined", onDeclined);
      socket.off("callNotice", onNotice);
    };
  }, []);

  useEffect(() => setDeafened(inCall), [inCall]);

  /** Pone una pista en un canal de todas las conexiones. */
  const sendOn = useCallback((slot: Slot, track: MediaStreamTrack | null) => {
    tracks.current[slot] = track;
    for (const peer of peers.current.values()) void peer.slots?.[slot]?.sender.replaceTrack(track).catch(() => {});
  }, []);

  /** Micrófono: se pide una sola vez por charla (aunque llegue antes una oferta que la lista de integrantes). */
  const ensureLocal = useCallback(() => {
    local.current ??= navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        const track = s.getAudioTracks()[0] ?? null;
        if (track) track.enabled = micOnRef.current;
        sendOn(0, track);
        return s;
      })
      .catch(() => {
        setMicError("No pudimos usar tu micrófono: igual escuchas a los demás.");
        return null;
      });
    return local.current;
  }, [sendOn]);

  // Al salir de la charla se suelta todo: micrófono, cámara y pantalla.
  useEffect(() => {
    if (!inCall) return;
    setMicError("");
    void ensureLocal();
    return () => {
      const pending = local.current;
      local.current = null;
      void pending?.then((s) => s?.getTracks().forEach((t) => t.stop()));
      for (const t of tracks.current) t?.stop();
      tracks.current = [null, null, null];
      setCamera(null);
      setScreen(null);
    };
  }, [inCall, ensureLocal]);

  useEffect(() => {
    void local.current?.then((s) => s?.getAudioTracks().forEach((t) => (t.enabled = micOn)));
  }, [micOn, inCall]);

  // Avisa a la charla si tienes la cámara o la pantalla prendida.
  useEffect(() => {
    if (inCall) socket.emit("callMedia", { cam: Boolean(camera), screen: Boolean(screen) });
  }, [inCall, camera, screen]);

  const setRemote = useCallback((id: string, slot: Slot, track: MediaStreamTrack) => {
    setRemotes((m) => {
      const r: Remote = { ...(m.get(id) ?? { audio: null, cam: null, screen: null }) };
      const stream = new MediaStream([track]);
      if (slot === 0) r.audio = stream;
      else if (slot === 1) r.cam = stream;
      else r.screen = stream;
      return new Map(m).set(id, r);
    });
  }, []);

  /** Conecta los canales con lo que estoy mandando ahora. */
  const attach = useCallback(
    async (peer: Peer) => {
      await ensureLocal();
      peer.slots!.forEach((t, i) => {
        t.direction = "sendrecv";
        void t.sender.replaceTrack(tracks.current[i] ?? null).catch(() => {});
      });
    },
    [ensureLocal],
  );

  const peerFor = useCallback(
    (id: string): Peer => {
      let peer = peers.current.get(id);
      if (peer) return peer;
      const pc = new RTCPeerConnection(ICE);
      peer = { pc, run: serial(), slots: null };
      peers.current.set(id, peer);
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit("callSignal", id, { kind: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const slot = pc.getTransceivers().indexOf(e.transceiver);
        if (slot >= 0 && slot <= 2) setRemote(id, slot as Slot, e.track);
      };
      return peer;
    },
    [setRemote],
  );

  const dropPeer = useCallback((id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setRemotes((m) => {
      if (!m.has(id)) return m;
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }, []);

  // Una conexión con cada integrante; la arma quien tenga el id menor para no cruzar ofertas.
  const memberKey = call?.members.map((m) => m.id).join(",") ?? "";
  useEffect(() => {
    if (!meId) return;
    const others = memberKey ? memberKey.split(",").filter((id) => id !== meId) : [];
    for (const id of [...peers.current.keys()]) if (!others.includes(id)) dropPeer(id);
    for (const id of others) {
      if (peers.current.has(id)) continue;
      const peer = peerFor(id);
      if (meId < id) {
        peer.run(async () => {
          peer.slots = [peer.pc.addTransceiver("audio"), peer.pc.addTransceiver("video"), peer.pc.addTransceiver("video")];
          await attach(peer);
          const offer = await peer.pc.createOffer();
          await peer.pc.setLocalDescription(offer);
          socket.emit("callSignal", id, { kind: "offer", sdp: offer.sdp ?? "" });
        });
      }
    }
  }, [memberKey, meId, peerFor, dropPeer, attach]);

  useEffect(() => {
    const onSignal = (from: string, sig: CallSignal) => {
      const peer = peerFor(from);
      peer.run(async () => {
        if (sig.kind === "offer") {
          await peer.pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
          peer.slots = peer.pc.getTransceivers().slice(0, 3);
          await attach(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          socket.emit("callSignal", from, { kind: "answer", sdp: answer.sdp ?? "" });
        } else if (sig.kind === "answer") {
          await peer.pc.setRemoteDescription({ type: "answer", sdp: sig.sdp });
        } else if (sig.kind === "ice") {
          await peer.pc.addIceCandidate(sig.candidate);
        }
      });
    };
    socket.on("callSignal", onSignal);
    return () => {
      socket.off("callSignal", onSignal);
    };
  }, [peerFor, attach]);

  // Al salir de la charla se cierran todas las conexiones.
  useEffect(() => {
    if (inCall) return;
    for (const id of [...peers.current.keys()]) dropPeer(id);
    setMicOn(true);
  }, [inCall, dropPeer]);

  const toggleCamera = useCallback(async () => {
    if (camera) {
      camera.getTracks().forEach((t) => t.stop());
      sendOn(1, null);
      setCamera(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      sendOn(1, stream.getVideoTracks()[0] ?? null);
      setCamera(stream);
    } catch {
      setNotice("No pudimos usar tu cámara");
    }
  }, [camera, sendOn]);

  const toggleScreen = useCallback(async () => {
    if (screen) {
      screen.getTracks().forEach((t) => t.stop());
      sendOn(2, null);
      setScreen(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0] ?? null;
      // Si se deja de compartir desde el navegador, también se apaga aquí.
      if (track)
        track.onended = () => {
          sendOn(2, null);
          setScreen(null);
        };
      sendOn(2, track);
      setScreen(stream);
    } catch {
      // Cancelar el selector de pantalla no es un error.
    }
  }, [screen, sendOn]);

  const invite = useCallback(
    (userId: string) =>
      new Promise<void>((resolve, reject) =>
        socket.emit("callInvite", userId, (res) => (res.ok ? resolve() : reject(new Error(res.error)))),
      ),
    [],
  );

  const respond = useCallback((callId: string, accept: boolean) => {
    setInvites((list) => list.filter((i) => i.callId !== callId));
    socket.emit("callRespond", callId, accept, (res) => {
      if (!res.ok) setNotice(res.error);
      else if (res.data) setCall(res.data);
    });
  }, []);

  const leave = useCallback(() => {
    socket.emit("callLeave");
    setCall(null);
  }, []);

  return {
    call,
    invites,
    remotes,
    micOn,
    setMicOn,
    camera,
    screen,
    toggleCamera,
    toggleScreen,
    micError,
    notice,
    clearNotice: () => setNotice(""),
    invite,
    respond,
    leave,
  };
}

export type PrivateCall = ReturnType<typeof usePrivateCall>;
