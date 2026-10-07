import { useEffect, useRef } from "react";
import type { Dir } from "../../shared/maps.ts";
import type { Look } from "../../shared/types.ts";
import { drawAvatar } from "./avatar.ts";

/** Personaje dibujado en un canvas pequeño. Con `head` solo muestra la cabeza y los hombros, para listas. */
export default function AvatarCanvas({ look, dir = "down", size = 120, head = false }: { look: Look; dir?: Dir; size?: number; head?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // El personaje mide unos 40 píxeles; en modo cabeza se acerca a la cara.
    const scale = head ? (size / 22) * dpr : (size / 48) * dpr;
    ctx.setTransform(scale, 0, 0, scale, (size * dpr) / 2, head ? scale * 39 : size * dpr - scale * 4);
    ctx.imageSmoothingEnabled = false;
    drawAvatar(ctx, look, 0, 0, { dir, walk: null, sitting: false });
  }, [look, dir, size, head]);

  return <canvas ref={ref} className={head ? "avatar-head" : "avatar-canvas"} style={{ width: size, height: size }} aria-hidden />;
}
