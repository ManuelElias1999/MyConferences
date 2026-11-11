// Voz de proximidad en el pasillo y charlas con micrófono, cámara y pantalla
// en mesas de equipo o por invitación. Cada integrante abre una conexión WebRTC con
// cada uno de los demás; el servidor solo pasa las señales, así que nadie
// fuera de la charla puede escucharla ni verla.
//
// Las charlas con video tienen tres canales en el mismo orden: voz, cámara
// y pantalla. Prender o apagar la cámara solo cambia lo que va por su canal,
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
  scope: string;
  candidates: RTCIceCandidateInit[];
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
  const activeCall = useRef<CallInfo | null>(null);
  const [hallVoice, setHallVoice] = useState(false);
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
  const callId = call?.id;
  const inCall = call !== null;

  useEffect(() => {
    setDeafened(inCall && !call?.proximity);
    return () => setDeafened(false);
  }, [inCall, Boolean(call?.proximity)]);

  /** Pone una pista en un canal de todas las conexiones. */
  const sendOn = useCallback((slot: Slot, track: MediaStreamTrack | null) => {
    tracks.current[slot] = track;
    for (const peer of peers.current.values()) void peer.slots?.[slot]?.sender.replaceTrack(track).catch(() => {});
  }, []);

  /** Micrófono: se pide una sola vez por charla (aunque llegue antes una oferta que la lista de integrantes). */
  const ensureLocal = useCallback(() => {
    if (local.current) return local.current;
    const pending = Promise.resolve()
      .then(() => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }))
      .then((s) => {
        if (local.current !== pending) {
          s.getTracks().forEach((track) => track.stop());
          return null;
        }
        const track = s.getAudioTracks()[0] ?? null;
        if (track) track.enabled = micOnRef.current;
        sendOn(0, track);
        return s;
      })
      .catch(() => {
        if (local.current === pending) setMicError("No pudimos usar tu micrófono: igual escuchas a los demás.");
        return null;
      });
    local.current = pending;
    return pending;
  }, [sendOn]);

  const releaseMedia = useCallback(() => {
    local.current = null;
    for (const track of tracks.current) track?.stop();
    tracks.current = [null, null, null];
  }, []);

  useEffect(() => releaseMedia, [releaseMedia]);

  useEffect(() => {
    void local.current?.then((s) => s?.getAudioTracks().forEach((t) => (t.enabled = micOn)));
  }, [micOn, inCall]);

  // Avisa a la charla si tienes la cámara o la pantalla prendida.
  useEffect(() => {
    if (callId && callId !== "hall" && activeCall.current?.id === callId) socket.emit("callMedia", callId, { cam: Boolean(camera), screen: Boolean(screen) });
  }, [callId, camera, screen]);

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

  const dropPeer = useCallback((id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setRemotes((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);

  const scopeFor = (info: CallInfo | null, id: string) =>
    info?.proximity ? info.proximity[id] : info?.members.some((member) => member.id === id) ? info.id : undefined;

  const updateCall = useCallback((info: CallInfo | null) => {
    if (activeCall.current?.id !== info?.id) {
      releaseMedia();
      setCamera(null);
      setScreen(null);
      setMicError("");
      if (info) void ensureLocal();
    }
    activeCall.current = info;
    for (const [id, peer] of peers.current) if (scopeFor(info, id) !== peer.scope) dropPeer(id);
    setCall(info);
  }, [dropPeer, ensureLocal, releaseMedia]);

  useEffect(() => {
    const onUpdated = (info: CallInfo | null) => updateCall(info);
    const onInvited = (inv: CallInvite) => setInvites((list) => [...list.filter((i) => i.callId !== inv.callId), inv]);
    const onCancelled = (callId: string) => setInvites((list) => list.filter((i) => i.callId !== callId));
    const onDeclined = ({ name }: { name: string }) => setNotice(`${name} no puede charlar ahora`);
    const onNotice = (text: string) => setNotice(text);
    const onDisconnect = () => {
      updateCall(null);
      setInvites([]);
      setHallVoice(false);
    };
    socket.on("disconnect", onDisconnect);
    socket.on("callUpdated", onUpdated);
    socket.on("callInvited", onInvited);
    socket.on("callCancelled", onCancelled);
    socket.on("callDeclined", onDeclined);
    socket.on("callNotice", onNotice);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("callUpdated", onUpdated);
      socket.off("callInvited", onInvited);
      socket.off("callCancelled", onCancelled);
      socket.off("callDeclined", onDeclined);
      socket.off("callNotice", onNotice);
    };
  }, [updateCall]);

  const peerFor = useCallback((id: string, scope: string): Peer => {
    const existing = peers.current.get(id);
    if (existing?.scope === scope) return existing;
    if (existing) dropPeer(id);
    const pc = new RTCPeerConnection(ICE);
    const peer: Peer = { pc, scope, run: serial(), slots: null, candidates: [] };
    peers.current.set(id, peer);
    pc.onicecandidate = (event) => {
      if (event.candidate && peers.current.get(id) === peer) {
        socket.emit("callSignal", id, scope, { kind: "ice", candidate: event.candidate.toJSON() });
      }
    };
    pc.ontrack = (event) => {
      const slot = pc.getTransceivers().indexOf(event.transceiver);
      if (peers.current.get(id) === peer && slot >= 0 && slot <= 2) setRemote(id, slot as Slot, event.track);
    };
    return peer;
  }, [dropPeer, setRemote]);

  const attach = (peer: Peer) => {
    peer.slots?.forEach((channel, index) => {
      channel.direction = "sendrecv";
      void channel.sender.replaceTrack(tracks.current[index] ?? null).catch(() => {});
    });
  };

  const memberKey = JSON.stringify(call?.members.filter((member) => member.id !== meId)
    .map((member) => [member.id, scopeFor(call, member.id)]) ?? []);
  useEffect(() => {
    if (!meId) return;
    for (const [id, scope] of JSON.parse(memberKey) as [string, string][]) {
      if (meId >= id || peers.current.has(id) || scopeFor(activeCall.current, id) !== scope) continue;
      const peer = peerFor(id, scope);
      peer.run(async () => {
        peer.slots = [peer.pc.addTransceiver("audio")];
        if (scope === activeCall.current?.id) {
          peer.slots.push(peer.pc.addTransceiver("video"), peer.pc.addTransceiver("video"));
        }
        attach(peer);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        if (peers.current.get(id) === peer) socket.emit("callSignal", id, scope, { kind: "offer", sdp: offer.sdp ?? "" });
      });
    }
  }, [memberKey, meId, peerFor]);

  useEffect(() => {
    const onSignal = (from: string, scope: string, signal: CallSignal) => {
      if (scopeFor(activeCall.current, from) !== scope) return;
      const peer = peerFor(from, scope);
      peer.run(async () => {
        if (peers.current.get(from) !== peer) return;
        if (signal.kind === "ice") {
          if (!peer.pc.remoteDescription) peer.candidates.push(signal.candidate);
          else await peer.pc.addIceCandidate(signal.candidate);
          return;
        }
        await peer.pc.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
        for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate).catch(() => {});
        if (signal.kind === "offer") {
          peer.slots = peer.pc.getTransceivers().slice(0, activeCall.current?.proximity ? 1 : 3);
          attach(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          if (peers.current.get(from) === peer) socket.emit("callSignal", from, scope, { kind: "answer", sdp: answer.sdp ?? "" });
        }
      });
    };
    socket.on("callSignal", onSignal);
    return () => {
      socket.off("callSignal", onSignal);
      for (const id of peers.current.keys()) dropPeer(id);
    };
  }, [peerFor, dropPeer]);

  const toggleCamera = useCallback(async () => {
    if (camera) {
      camera.getTracks().forEach((t) => t.stop());
      sendOn(1, null);
      setCamera(null);
      return;
    }
    const scope = activeCall.current?.id;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      if (scope !== activeCall.current?.id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
    const scope = activeCall.current?.id;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (scope !== activeCall.current?.id) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
    });
  }, []);

  const changeHallVoice = useCallback((enabled: boolean) => {
    setHallVoice(enabled);
    if (!enabled && activeCall.current?.proximity) updateCall(null);
    if (socket.connected) socket.emit("hallVoice", enabled);
  }, [updateCall]);

  const leave = () => {
    if (activeCall.current?.proximity) changeHallVoice(false);
    else {
      socket.emit("callLeave");
      updateCall(null);
    }
  };

  return {
    call,
    hallVoice,
    changeHallVoice,
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
