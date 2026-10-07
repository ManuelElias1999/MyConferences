import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Room, Talk, Venue } from "../../shared/types.ts";

const MIN = 60_000;

type Program = Record<string, [title: string, speaker: string, description: string][]>;

interface VenueSeed {
  id: string;
  name: string;
  tagline: string;
  private: boolean;
  rooms: Room[];
  program: Program;
}

const seeds: VenueSeed[] = [
  {
    id: "101",
    name: process.env.EVENT_NAME ?? "MyConferences Tech Summit",
    tagline: "El salón abierto: entra a la sala que quieras y escucha en vivo.",
    private: false,
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Keynotes y paneles", color: "#f59e0b", theme: "minimal", createdBy: null },
      { id: "stellar", name: "Sala Stellar", topic: "Blockchain, pagos y Soroban", color: "#6366f1", theme: "tech", createdBy: null },
      { id: "ia", name: "Sala IA", topic: "Inteligencia artificial aplicada", color: "#10b981", theme: "tech", createdBy: null },
      { id: "startups", name: "Escenario Startups", topic: "Pitches y emprendimiento", color: "#ec4899", theme: "rustic", createdBy: null },
      { id: "web", name: "Sala Web", topic: "Frontend, backend y despliegue", color: "#0ea5e9", theme: "medieval", createdBy: null },
      { id: "producto", name: "Sala Producto", topic: "Diseño, producto y comunidad", color: "#ef4444", theme: "garden", createdBy: null },
    ],
    program: {
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
      web: [
        ["React en 2026: lo que sí importa", "Elena Castro", "Server components, compiladores y qué dejar de optimizar a mano."],
        ["APIs que no se rompen", "Gabriel Núñez", "Versionado, contratos y pruebas que atrapan errores antes que tus usuarios."],
        ["Tiempo real con WebSockets", "Mariana López", "Presencia, salas y reconexión: lo que aprendimos construyendo este salón."],
        ["Desplegar sin miedo", "Hugo Benítez", "Previews, feature flags y cómo volver atrás en segundos."],
        ["Accesibilidad desde el día uno", "Daniela Rojas", "Teclado, contraste y lectores de pantalla sin rehacer tu app."],
      ],
      producto: [
        ["Descubrir qué construir", "Paula Ramírez", "Entrevistas, señales y cómo decir que no."],
        ["Diseño de sistemas visuales", "Iván Torres", "Tokens, componentes y cómo mantener la coherencia al crecer."],
        ["Métricas que guían, no que asustan", "Carla Méndez", "Elegir una métrica norte y las que la explican."],
        ["Construir comunidad alrededor de tu producto", "Sebastián Díaz", "Eventos, contenido y embajadores."],
        ["Mesa abierta: preguntas al equipo de producto", "Varios invitados", "Trae tus dudas y las resolvemos en vivo."],
      ],
    },
  },
  {
    id: "202",
    name: "Stellar Builders Day",
    tagline: "Jornada privada para equipos que construyen sobre Stellar.",
    private: true,
    rooms: [
      { id: "soroban", name: "Sala Soroban", topic: "Contratos inteligentes", color: "#6366f1", theme: "tech", createdBy: null },
      { id: "wallets", name: "Sala Wallets", topic: "Billeteras y experiencia de usuario", color: "#14b8a6", theme: "minimal", createdBy: null },
      { id: "anchors", name: "Sala Anchors", topic: "Integraciones con bancos", color: "#f59e0b", theme: "rustic", createdBy: null },
      { id: "mentorias", name: "Mentorías", topic: "Sesiones con el equipo core", color: "#ec4899", theme: "garden", createdBy: null },
    ],
    program: {
      soroban: [
        ["Arquitectura de contratos en Soroban", "Diego Paredes", "Patrones de almacenamiento, eventos y actualizaciones."],
        ["Auditoría en vivo", "Equipo de seguridad", "Revisamos contratos de los equipos asistentes."],
        ["Optimizar costos de ejecución", "Ana Ruiz", "Medir y bajar el costo de cada llamada."],
        ["Testing de contratos", "Diego Paredes", "Pruebas unitarias, fuzzing y snapshots."],
        ["Preguntas abiertas", "Equipo core", "Lo que quieras saber de Soroban."],
      ],
      wallets: [
        ["Onboarding sin fricción", "Valentina Cruz", "Passkeys, cuentas patrocinadas y recuperación."],
        ["Firmar transacciones desde el navegador", "Martín Silva", "Integrar billeteras en tu dApp."],
        ["Diseño de flujos de pago", "Iván Torres", "Errores comunes y cómo evitarlos."],
        ["Cuentas inteligentes", "Ana Ruiz", "Políticas, límites y multifirma."],
        ["Demo de equipos", "Equipos invitados", "Cada equipo muestra su billetera."],
      ],
      anchors: [
        ["SEP-24 y SEP-31 en la práctica", "Martín Silva", "Depósitos, retiros y pagos cross-border."],
        ["Cumplimiento y KYC", "Natalia Ortiz", "Qué piden los reguladores en la región."],
        ["Liquidez y conciliación", "Ricardo Vega", "Operar un anchor día a día."],
        ["Casos de éxito", "Varios anchors", "Equipos que ya están en producción."],
        ["Mesa de integración", "Equipo core", "Resolvemos dudas técnicas de tu integración."],
      ],
      mentorias: [
        ["Mentoría: arquitectura", "Equipo core", "Trae tu diagrama y lo revisamos juntos."],
        ["Mentoría: producto", "Paula Ramírez", "Del prototipo al primer usuario."],
        ["Mentoría: financiamiento", "Ricardo Vega", "Grants y rondas para equipos de Stellar."],
        ["Mentoría: go-to-market", "Carla Méndez", "Cómo conseguir tus primeros clientes."],
        ["Cierre", "Equipo organizador", "Próximos pasos y comunidad."],
      ],
    },
  },
  {
    id: "303",
    name: "Demo Day · Inversores",
    tagline: "Sesión privada de pitches para inversores invitados.",
    private: true,
    rooms: [
      { id: "pitches", name: "Sala de Pitches", topic: "Presentaciones de startups", color: "#ec4899", theme: "tech", createdBy: null },
      { id: "reuniones", name: "Sala de Reuniones", topic: "Conversaciones con fundadores", color: "#0ea5e9", theme: "minimal", createdBy: null },
    ],
    program: {
      pitches: [
        ["Bloque 1: fintech", "Cinco startups", "Cinco minutos por equipo y preguntas."],
        ["Bloque 2: salud", "Cuatro startups", "Cinco minutos por equipo y preguntas."],
        ["Bloque 3: educación", "Cuatro startups", "Cinco minutos por equipo y preguntas."],
        ["Bloque 4: clima", "Tres startups", "Cinco minutos por equipo y preguntas."],
        ["Votación y cierre", "Jurado", "Resultados y próximos pasos."],
      ],
      reuniones: [
        ["Reuniones 1:1", "Fundadores", "Agenda abierta para conversar con los equipos."],
        ["Reuniones 1:1", "Fundadores", "Agenda abierta para conversar con los equipos."],
        ["Reuniones 1:1", "Fundadores", "Agenda abierta para conversar con los equipos."],
        ["Reuniones 1:1", "Fundadores", "Agenda abierta para conversar con los equipos."],
        ["Reuniones 1:1", "Fundadores", "Agenda abierta para conversar con los equipos."],
      ],
    },
  },
];

/**
 * Genera la agenda alrededor de la hora actual para que siempre haya
 * charlas en curso y próximas al abrir la app.
 */
function buildTalks(seed: VenueSeed, now: number): Talk[] {
  const halfHour = 30 * MIN;
  const base = Math.floor(now / halfHour) * halfHour - 60 * MIN;
  return seed.rooms.flatMap((room) =>
    (seed.program[room.id] ?? []).map(([title, speaker, description], i) => {
      const start = base + i * 60 * MIN;
      return { id: `${seed.id}-${room.id}-${i + 1}`, roomId: room.id, title, speaker, description, start, end: start + 45 * MIN };
    }),
  );
}

/**
 * Listas de invitados de los salones privados. Se leen de data/whitelists.json
 * ({"202": ["ana@ejemplo.com"]}) y de VENUE_WHITELISTS="202:ana@ejemplo.com|luis@ejemplo.com;303:...".
 */
function loadWhitelists(dataDir: string) {
  const lists = new Map<string, Set<string>>();
  const add = (venueId: string, emails: string[]) => {
    const set = lists.get(venueId) ?? new Set<string>();
    for (const e of emails) if (e.trim()) set.add(e.trim().toLowerCase());
    lists.set(venueId, set);
  };
  const file = path.join(dataDir, "whitelists.json");
  if (existsSync(file)) {
    for (const [venueId, emails] of Object.entries(JSON.parse(readFileSync(file, "utf8")) as Record<string, string[]>)) add(venueId, emails);
  }
  for (const entry of (process.env.VENUE_WHITELISTS ?? "").split(";").filter(Boolean)) {
    const [venueId, emails] = entry.split(":");
    if (venueId && emails) add(venueId.trim(), emails.split("|"));
  }
  return lists;
}

export function createVenues(dataDir: string, now = Date.now()) {
  const whitelists = loadWhitelists(dataDir);
  return seeds.map((seed) => ({
    venue: {
      id: seed.id,
      name: seed.name,
      tagline: seed.tagline,
      private: seed.private,
      rooms: seed.rooms,
      talks: buildTalks(seed, now),
    } satisfies Venue,
    whitelist: seed.private ? (whitelists.get(seed.id) ?? new Set<string>()) : null,
  }));
}
