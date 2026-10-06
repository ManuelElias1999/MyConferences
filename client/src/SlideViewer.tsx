import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Muestra una página de un PDF ajustada al espacio disponible. */
export default function SlideViewer({ url, page, onPageCount }: { url: string; page: number; onPageCount: (n: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError("");
    const task = pdfjs.getDocument({ url });
    task.promise.then(
      (d) => {
        if (cancelled) return;
        setDoc(d);
        onPageCount(d.numPages);
      },
      () => !cancelled && setError("No se pudo cargar la presentación."),
    );
    return () => {
      cancelled = true;
      task.destroy();
    };
    // onPageCount cambia en cada render del padre; solo importa la URL.
  }, [url]);

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(wrapRef.current!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !size.w || !size.h) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    const n = Math.min(Math.max(1, page), doc.numPages);
    doc.getPage(n).then((p) => {
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const scale = Math.min(size.w / base.width, size.h / base.height);
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      task = p.render({ canvas, viewport });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, size]);

  return (
    <div className="slide-viewer" ref={wrapRef}>
      {error ? <p className="muted">{error}</p> : !doc && <p className="muted">Cargando presentación…</p>}
      <canvas ref={canvasRef} hidden={!doc} />
    </div>
  );
}
