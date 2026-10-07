// Charla privada por micrófono: cada integrante abre una conexión WebRTC de
// audio con cada uno de los demás. El servidor solo pasa las señales, así que
// nadie fuera de la charla puede escucharla.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CallInfo, CallInvite, CallSignal } from "../../shared/types.ts";
import { socket } from "./lib.ts";

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

// Mientras estás en una charla privada, el resto del evento (el ponente, los
// videos) queda en silencio: solo escuchas a la gente de tu charla.
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

interface Peer {
  pc: RTCPeerConnection;
  run: (task: () => Promise<unknown>) => void;
}

export function usePrivateCall(meId: string | null) {
  const [call, setCall] = useState<CallInfo | null>(null);
  const [invites, setInvites] = useState<CallInvite[]>([]);
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());
  const [micOn, setMicOn] = useState(true);
  const [micError, setMicError] = useState("");
  const [notice, setNotice] = useState("");
  const peers = useRef(new Map<string, Peer>());
  const local = useRef<Promise<MediaStream | null> | null>(null);
  const inCall = call !== null;

  useEffect(() => {
    const onUpdated = (info: CallInfo | null) => setCall(info);
    const onInvited = (inv: CallInvite) => setInvites((list) => [...list.filter((i) => i.callId !== inv.callId), inv]);
    const onCancelled = (callId: string) => setInvites((list) => list.filter((i) => i.callId !== callId));
    const onDeclined = ({ name }: { name: string }) => setNotice(`${name} no puede charlar ahora`);
    socket.on("callUpdated", onUpdated);
    socket.on("callInvited", onInvited);
    socket.on("callCancelled", onCancelled);
    socket.on("callDeclined", onDeclined);
    return () => {
      socket.off("callUpdated", onUpdated);
      socket.off("callInvited", onInvited);
      socket.off("callCancelled", onCancelled);
      socket.off("callDeclined", onDeclined);
    };
  }, []);

  useEffect(() => setDeafened(inCall), [inCall]);

  /** Micrófono: se pide una sola vez por charla (aunque llegue antes una oferta que la lista de integrantes). */
  const ensureLocal = useCallback(() => {
    local.current ??= navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => {
      setMicError("No pudimos usar tu micrófono: igual escuchas a los demás.");
      return null;
    });
    return local.current;
  }, []);

  // Se suelta al salir de la charla.
  useEffect(() => {
    if (!inCall) return;
    setMicError("");
    void ensureLocal();
    return () => {
      const pending = local.current;
      local.current = null;
      void pending?.then((s) => s?.getTracks().forEach((t) => t.stop()));
    };
  }, [inCall, ensureLocal]);

  useEffect(() => {
    void local.current?.then((s) => s?.getAudioTracks().forEach((t) => (t.enabled = micOn)));
  }, [micOn, inCall]);

  const peerFor = useCallback((id: string): Peer => {
    let peer = peers.current.get(id);
    if (peer) return peer;
    const pc = new RTCPeerConnection(ICE);
    const run = serial();
    peer = { pc, run };
    peers.current.set(id, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("callSignal", id, { kind: "ice", candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      setStreams((m) => new Map(m).set(id, stream));
    };
    run(async () => {
      const stream = await ensureLocal();
      const track = stream?.getAudioTracks()[0];
      if (track) pc.addTrack(track, stream!);
      else pc.addTransceiver("audio", { direction: "recvonly" });
    });
    return peer;
  }, [ensureLocal]);

  const dropPeer = useCallback((id: string) => {
    peers.current.get(id)?.pc.close();
    peers.current.delete(id);
    setStreams((m) => {
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
          const offer = await peer.pc.createOffer();
          await peer.pc.setLocalDescription(offer);
          socket.emit("callSignal", id, { kind: "offer", sdp: offer.sdp ?? "" });
        });
      }
    }
  }, [memberKey, meId, peerFor, dropPeer]);

  useEffect(() => {
    const onSignal = (from: string, sig: CallSignal) => {
      const peer = peerFor(from);
      peer.run(async () => {
        if (sig.kind === "offer") {
          await peer.pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
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
  }, [peerFor]);

  // Al salir de la charla se cierran todas las conexiones.
  useEffect(() => {
    if (inCall) return;
    for (const id of [...peers.current.keys()]) dropPeer(id);
    setMicOn(true);
  }, [inCall, dropPeer]);

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

  return { call, invites, streams, micOn, setMicOn, micError, notice, clearNotice: () => setNotice(""), invite, respond, leave };
}

export type PrivateCall = ReturnType<typeof usePrivateCall>;
