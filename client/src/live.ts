// Transmisión en vivo del expositor por WebRTC: el expositor abre una conexión
// directa con cada asistente de la sala y el servidor solo pasa los mensajes de señalización.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveInfo, RtcSignal, Stage } from "../../shared/types.ts";
import { socket } from "./lib.ts";

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

/**
 * Procesa las señales en orden: una respuesta no puede llegar antes que la oferta que contesta.
 * Cada paso tiene un tiempo máximo porque, si se cierra una conexión a mitad de una
 * operación, su promesa nunca se resuelve y trabaría todas las señales siguientes.
 */
function serial() {
  let chain: Promise<unknown> = Promise.resolve();
  return (task: () => Promise<unknown>) => {
    chain = chain
      .then(() => Promise.race([task(), new Promise((resolve) => setTimeout(resolve, 5000))]))
      .catch(() => {});
  };
}

/** Lado del asistente: recibe audio y video del expositor. */
export function useLiveViewer(stage: Stage, isPresenter: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [attempt, setAttempt] = useState(0);
  const session = stage.live?.session ?? null;
  const presenter = stage.presenterId;

  useEffect(() => {
    if (isPresenter || session === null || !presenter) return;
    const pc = new RTCPeerConnection(ICE);
    const tracks: MediaStreamTrack[] = [];
    const run = serial();
    pc.ontrack = (e) => {
      tracks.push(e.track);
      setStream(new MediaStream(tracks));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("rtc", presenter, { kind: "ice", session, candidate: e.candidate.toJSON() });
    };
    // Si la conexión falla o no termina de armarse, se vuelve a pedir desde cero.
    const retry = () => setAttempt((a) => a + 1);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") retry();
    };
    const timer = setTimeout(() => pc.connectionState !== "connected" && retry(), 10_000);
    const onSignal = (from: string, sig: RtcSignal) => {
      if (from !== presenter || sig.session !== session) return;
      run(async () => {
        if (sig.kind === "offer") {
          await pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("rtc", presenter, { kind: "answer", session, sdp: answer.sdp ?? "" });
        } else if (sig.kind === "ice") {
          await pc.addIceCandidate(sig.candidate);
        }
      });
    };
    socket.on("rtc", onSignal);
    socket.emit("rtc", presenter, { kind: "request", session });
    return () => {
      clearTimeout(timer);
      socket.off("rtc", onSignal);
      pc.close();
      setStream(null);
    };
  }, [isPresenter, session, presenter, attempt]);

  return stream;
}

/** Lado del expositor: captura pantalla, cámara y micrófono y los envía a cada asistente. */
export function useBroadcaster(isPresenter: boolean, live: LiveInfo | null) {
  const [video, setVideo] = useState<{ track: MediaStreamTrack; kind: "screen" | "camera" } | null>(null);
  const [mic, setMic] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState("");
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const tracks = useRef<MediaStreamTrack[]>([]);
  tracks.current = [video?.track, mic].filter((t): t is MediaStreamTrack => Boolean(t));

  const closePeers = () => {
    for (const pc of peers.current.values()) pc.close();
    peers.current.clear();
  };

  // Cada asistente pide su conexión; se le ofrece lo que se esté transmitiendo en ese momento.
  useEffect(() => {
    if (!isPresenter) return;
    const runs = new Map<string, ReturnType<typeof serial>>();
    const onSignal = (from: string, sig: RtcSignal) => {
      const run = runs.get(from) ?? serial();
      runs.set(from, run);
      run(async () => {
        if (sig.kind === "request") {
          peers.current.get(from)?.close();
          if (!tracks.current.length) return;
          const pc = new RTCPeerConnection(ICE);
          peers.current.set(from, pc);
          const stream = new MediaStream(tracks.current);
          for (const t of tracks.current) pc.addTrack(t, stream);
          pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit("rtc", from, { kind: "ice", session: sig.session, candidate: e.candidate.toJSON() });
          };
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
              if (peers.current.get(from) === pc) peers.current.delete(from);
            }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("rtc", from, { kind: "offer", session: sig.session, sdp: offer.sdp ?? "" });
        } else if (sig.kind === "answer") {
          await peers.current.get(from)?.setRemoteDescription({ type: "answer", sdp: sig.sdp });
        } else if (sig.kind === "ice") {
          await peers.current.get(from)?.addIceCandidate(sig.candidate);
        }
      });
    };
    socket.on("rtc", onSignal);
    return () => {
      socket.off("rtc", onSignal);
    };
  }, [isPresenter]);

  // Cuando cambia lo que se transmite, se cierran las conexiones y el servidor
  // anuncia una sesión nueva para que todos se reconecten.
  const videoKind = video?.kind ?? null;
  const micOn = Boolean(mic);
  useEffect(() => {
    if (!isPresenter) return;
    closePeers();
    socket.emit("setLive", videoKind || micOn ? { video: videoKind, audio: micOn } : null);
  }, [isPresenter, videoKind, micOn, video?.track]);

  // Al dejar de presentar (o salir de la sala) se apaga todo.
  useEffect(() => {
    if (isPresenter) return;
    video?.track.stop();
    mic?.stop();
    setVideo(null);
    setMic(null);
  }, [isPresenter]);

  useEffect(
    () => () => {
      for (const t of tracks.current) t.stop();
      closePeers();
    },
    [],
  );

  const startVideo = useCallback(async (kind: "screen" | "camera") => {
    setError("");
    try {
      const media =
        kind === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
          : await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      const track = media.getVideoTracks()[0]!;
      // Si el navegador deja de compartir (botón "Dejar de compartir"), se refleja aquí.
      track.onended = () => setVideo((v) => (v?.track === track ? null : v));
      setVideo((v) => {
        v?.track.stop();
        return { track, kind };
      });
    } catch {
      setError(kind === "screen" ? "No se pudo compartir la pantalla." : "No se pudo abrir la cámara.");
    }
  }, []);

  const stopVideo = useCallback(() => {
    setVideo((v) => {
      v?.track.stop();
      return null;
    });
  }, []);

  const toggleMic = useCallback(async () => {
    setError("");
    if (mic) {
      mic.stop();
      setMic(null);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      setMic(media.getAudioTracks()[0]!);
    } catch {
      setError("No se pudo abrir el micrófono.");
    }
  }, [mic]);

  const preview = useMemo(() => (video ? new MediaStream([video.track]) : null), [video]);
  return { videoKind, micOn, preview, error, startVideo, stopVideo, toggleMic, live };
}
