import type { EventInfo, Room, Talk } from "../../shared/types.ts";

const MIN = 60_000;

const rooms: Room[] = [
  {
    id: "auditorio",
    name: "Auditorio principal",
    topic: "Keynotes y paneles",
    color: "#f59e0b",
    area: { x: 40, y: 40, w: 400, h: 300 },
    door: { x: 200, y: 340, w: 80, h: 24 },
  },
  {
    id: "stellar",
    name: "Sala Stellar",
    topic: "Blockchain, pagos y Soroban",
    color: "#6366f1",
    area: { x: 500, y: 40, w: 400, h: 300 },
    door: { x: 660, y: 340, w: 80, h: 24 },
  },
  {
    id: "ia",
    name: "Sala IA",
    topic: "Inteligencia artificial aplicada",
    color: "#10b981",
    area: { x: 960, y: 40, w: 400, h: 300 },
    door: { x: 1120, y: 340, w: 80, h: 24 },
  },
  {
    id: "startups",
    name: "Escenario Startups",
    topic: "Pitches y emprendimiento",
    color: "#ec4899",
    area: { x: 40, y: 540, w: 400, h: 320 },
    door: { x: 200, y: 516, w: 80, h: 24 },
  },
];

const program: Record<string, [title: string, speaker: string, description: string][]> = {
  auditorio: [
    ["Bienvenida al evento", "Equipo organizador", "Cómo moverte por el salón, la agenda del día y las reglas de convivencia."],
    ["Keynote: el futuro de los eventos online", "Laura Méndez", "Por qué los eventos virtuales necesitan sentirse como un lugar y no como una videollamada."],
    ["Panel: comunidades tech en Latinoamérica", "Varios invitados", "Organizadores de comunidades comparten qué funciona para crecer y sostenerlas."],
    ["Keynote: construir producto con IA", "Andrés Ríos", "Lecciones de llevar funcionalidades con IA de la demo a producción."],
    ["Cierre y premios", "Equipo organizador", "Resumen del día, ganadores del demo day y próximos eventos."],
  ],
  stellar: [
    ["Introducción a Stellar", "Camila Torres", "Cuentas, activos, anchors y cómo se mueve el dinero en la red."],
    ["Smart contracts con Soroban paso a paso", "Diego Paredes", "Escribimos, probamos y desplegamos un contrato en testnet en vivo."],
    ["Pagos transfronterizos y remesas", "Valentina Cruz", "Casos reales de remesas en la región y la arquitectura detrás."],
    ["Anchors: on-ramps y off-ramps", "Martín Silva", "Cómo conectar Stellar con bancos y billeteras locales."],
    ["Taller: tu primera dApp en Stellar", "Camila Torres", "Frontend, wallet y contrato: una app completa en una hora."],
  ],
  ia: [
    ["LLMs en producción", "Sofía Herrera", "Latencia, costos, evaluación y monitoreo cuando los usuarios son reales."],
    ["Agentes de IA: patrones que funcionan", "Tomás Aguilar", "Herramientas, memoria y límites: cómo diseñar agentes confiables."],
    ["RAG sin dolor", "Lucía Fernández", "Indexar, recuperar y citar: errores comunes y cómo evitarlos."],
    ["Evaluar modelos con tus propios datos", "Javier Molina", "Construir un set de evaluación útil en una tarde."],
    ["IA, privacidad y regulación", "Natalia Ortiz", "Qué cambia para los equipos de producto con las nuevas regulaciones."],
  ],
  startups: [
    ["Ronda de pitches: fintech", "Cinco startups", "Cinco minutos por equipo y preguntas del jurado."],
    ["Cómo levantar tu primera ronda", "Ricardo Vega", "Qué miran los inversores en etapa pre-seed y seed."],
    ["Ronda de pitches: edtech y salud", "Cinco startups", "Cinco minutos por equipo y preguntas del jurado."],
    ["De idea a primeros clientes", "Paula Ramírez", "Validar rápido sin construir de más."],
    ["Demo day: finalistas", "Jurado y finalistas", "Los mejores pitches del día compiten por el premio."],
  ],
};

/**
 * Genera la agenda alrededor de la hora actual para que siempre haya
 * charlas en curso y próximas al abrir la app.
 */
function buildTalks(now: number): Talk[] {
  const halfHour = 30 * MIN;
  const base = Math.floor(now / halfHour) * halfHour - 60 * MIN;
  const talks: Talk[] = [];
  for (const room of rooms) {
    program[room.id].forEach(([title, speaker, description], i) => {
      const start = base + i * 60 * MIN;
      talks.push({
        id: `${room.id}-${i + 1}`,
        roomId: room.id,
        title,
        speaker,
        description,
        start,
        end: start + 45 * MIN,
      });
    });
  }
  return talks;
}

export function createEvent(now = Date.now()): EventInfo {
  return {
    name: process.env.EVENT_NAME ?? "MyConferences Tech Summit",
    tagline: "Un evento online que se recorre: elige tu sala, escucha y conversa.",
    map: { width: 1400, height: 900, spawn: { x: 700, y: 720 } },
    rooms,
    talks: buildTalks(now),
  };
}
