// Estilos de sala que se pueden elegir al crearla.

export type ThemeId = "tech" | "minimal" | "rustic" | "medieval" | "garden";

export const THEMES: { id: ThemeId; label: string; description: string; color: string }[] = [
  { id: "tech", label: "Tecnológica", description: "Paneles con luces LED, racks de servidores y pantallas.", color: "#3b82f6" },
  { id: "minimal", label: "Minimalista", description: "Paredes blancas, madera clara y plantas.", color: "#64748b" },
  { id: "rustic", label: "Rústica", description: "Troncos, chimenea, barriles y faroles.", color: "#b45309" },
  { id: "medieval", label: "Medieval", description: "Piedra, estandartes, antorchas y armaduras.", color: "#9b2335" },
  { id: "garden", label: "Jardín", description: "Pasto, árboles, flores y una fuente.", color: "#16a34a" },
];

export const isTheme = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value);

/** Colores que se pueden elegir para la sala (puerta, placa y detalles). */
export const ROOM_COLORS = ["#3b82f6", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#8b5cf6", "#b45309", "#64748b"];
