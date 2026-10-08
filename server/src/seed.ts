import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ThemeId } from "../../shared/themes.ts";
import type { Room, Sponsor, Talk, Venue } from "../../shared/types.ts";

const MIN = 60_000;

type Program = Record<string, [title: string, speaker: string, description: string][]>;

interface VenueSeed {
  id: string;
  name: string;
  tagline: string;
  private: boolean;
  theme: ThemeId;
  organizer: string;
  sponsors: Sponsor[];
  rooms: Room[];
  program: Program;
  capacity?: number;
}

/** Lo que cuenta el representante de cada patrocinador de ejemplo en su stand. */
const PITCH: Record<string, string> = {
  novapay: "Cobros en línea en 5 minutos, con tarjetas, transferencias y billeteras. Hoy te damos 3 meses sin comisión.",
  "orbit-cloud": "Servidores y bases de datos que escalan solos. Si te registras en el evento, tienes USD 300 de crédito.",
  devforge: "Integración continua y despliegues sin configurar nada. Pasa a ver la demo de pipelines en 30 segundos.",
  "pixel-bank": "La cuenta para startups: tarjetas virtuales, pagos internacionales y reportes automáticos para tu contador.",
  bytelabs: "Te prestamos GPUs durante el hackathon. Pasa por el stand y te damos acceso para tu equipo.",
  "nimbus-ai": "APIs de modelos de lenguaje con 1 millón de tokens gratis para los equipos del hackathon.",
  quanta: "Búsqueda vectorial lista en 3 líneas de código. Premio especial al mejor proyecto que la use.",
  ledgerx: "Contabilidad automática para startups. Buscamos talento: deja tu CV en el stand.",
  "pulse-api": "Monitoreo y alertas para tu API en tiempo real. Tenemos stickers y café.",
};

const logo = (id: string, name: string, url: string | null = null): Sponsor => ({ id, name, logoUrl: `/assets/logos/${id}.svg`, url, pitch: PITCH[id] ?? "" });

const seeds: VenueSeed[] = [
  {
    id: "101",
    name: process.env.EVENT_NAME ?? "MyConferences Tech Summit",
    tagline: "El salón abierto: entra a la sala que quieras y escucha en vivo.",
    private: false,
    theme: "tech",
    organizer: "MyConferences",
    sponsors: [logo("novapay", "NovaPay"), logo("orbit-cloud", "Orbit Cloud"), logo("devforge", "DevForge")],
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Keynotes y paneles", color: "#f59e0b", main: true },
      { id: "stellar", name: "Sala Stellar", topic: "Blockchain, pagos y Soroban", color: "#6366f1", main: false, theme: "stellar" },
      { id: "ia", name: "Sala IA", topic: "Inteligencia artificial aplicada", color: "#10b981", main: false },
      { id: "startups", name: "Escenario Startups", topic: "Pitches y emprendimiento", color: "#ec4899", main: false },
      { id: "web", name: "Sala Web", topic: "Frontend, backend y despliegue", color: "#0ea5e9", main: false },
      { id: "producto", name: "Sala Producto", topic: "Diseño, producto y comunidad", color: "#ef4444", main: false },
      { id: "devops", name: "Sala DevOps", topic: "Cloud, contenedores y CI/CD", color: "#14b8a6", main: false },
      { id: "seguridad", name: "Sala Seguridad", topic: "Ciberseguridad para equipos de producto", color: "#8b5cf6", main: false },
      { id: "datos", name: "Sala Datos", topic: "Datos, analítica y visualización", color: "#f97316", main: false },
      { id: "mobile", name: "Sala Mobile", topic: "Apps móviles y multiplataforma", color: "#ec4899", main: false },
      { id: "gaming", name: "Sala Gaming", topic: "Videojuegos y gráficos en tiempo real", color: "#6366f1", main: false },
    ],
    program: {
      auditorio: [
        ["Bienvenida al evento", "Equipo organizador", "Cómo moverte por el salón, la agenda del día y las reglas de convivencia."],
        ["Keynote: el futuro de los eventos online", "Laura Méndez", "Por qué los eventos virtuales necesitan sentirse como un lugar y no como una videollamada."],
        ["Panel: comunidades tech en Latinoamérica", "Varios invitados", "Organizadores de comunidades comparten qué funciona para crecer y sostenerlas."],
        ["Keynote: construir producto con IA", "Andrés Ríos", "Lecciones de llevar funcionalidades con IA de la demo a producción."],
        ["Cierre y premios", "Equipo organizador", "Resumen del día, ganadores del demo day y próximos eventos."],
      ],
      devops: [
        ["Kubernetes sin miedo", "Hugo Benítez", "Lo mínimo para desplegar y operar con confianza."],
        ["Pipelines que no fallan", "Elena Castro", "CI/CD rápido y confiable."],
        ["Observabilidad práctica", "Gabriel Núñez", "Logs, métricas y trazas que sirven."],
        ["Costos en la nube", "Ricardo Vega", "Cómo bajar la factura sin perder velocidad."],
        ["Incidentes y postmortems", "Mariana López", "Aprender de lo que falla."],
      ],
      seguridad: [
        ["Seguridad para devs", "Natalia Ortiz", "Los errores más comunes y cómo evitarlos."],
        ["Autenticación moderna", "Javier Molina", "Passkeys, OAuth y sesiones."],
        ["Secretos y credenciales", "Daniela Rojas", "Dónde guardarlos y cómo rotarlos."],
        ["Pentesting en vivo", "Equipo rojo", "Atacamos una app de ejemplo."],
        ["Privacidad por diseño", "Natalia Ortiz", "Datos mínimos y consentimiento."],
      ],
      datos: [
        ["Analítica de producto", "Carla Méndez", "Eventos, embudos y retención."],
        ["SQL que escala", "Javier Molina", "Consultas rápidas sobre muchos datos."],
        ["Dashboards que se usan", "Iván Torres", "Diseñar para decidir."],
        ["Pipelines de datos", "Lucía Fernández", "De la fuente al almacén sin dolor."],
        ["Datos y IA", "Sofía Herrera", "Preparar datos para modelos."],
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
    theme: "medieval",
    organizer: "Comunidad Stellar LatAm",
    sponsors: [logo("pixel-bank", "Pixel Bank"), logo("orbit-cloud", "Orbit Cloud"), logo("devforge", "DevForge")],
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Keynotes del día", color: "#9b2335", main: true },
      { id: "soroban", name: "Sala Soroban", topic: "Contratos inteligentes", color: "#6366f1", main: false },
      { id: "wallets", name: "Sala Wallets", topic: "Billeteras y experiencia de usuario", color: "#14b8a6", main: false },
      { id: "anchors", name: "Sala Anchors", topic: "Integraciones con bancos", color: "#f59e0b", main: false },
      { id: "mentorias", name: "Mentorías", topic: "Sesiones con el equipo core", color: "#ec4899", main: false },
      { id: "defi", name: "Sala DeFi", topic: "Finanzas descentralizadas", color: "#10b981", main: false },
      { id: "hackathon", name: "Hackathon", topic: "Equipos construyendo en vivo", color: "#ef4444", main: false },
      { id: "comunidad", name: "Comunidad", topic: "Embajadores y meetups", color: "#8b5cf6", main: false },
      { id: "demos", name: "Demos", topic: "Proyectos de la comunidad", color: "#0ea5e9", main: false },
    ],
    program: {
      auditorio: [
        ["Apertura: el estado de Stellar", "Equipo core", "Novedades de la red y hoja de ruta del año."],
        ["Keynote: pagos que funcionan", "Valentina Cruz", "Lo que aprendimos llevando pagos a producción en la región."],
        ["Panel: construir en comunidad", "Varios invitados", "Equipos de la región comparten cómo colaboran."],
        ["Keynote: el futuro de Soroban", "Diego Paredes", "Qué viene para los contratos inteligentes en Stellar."],
        ["Cierre", "Equipo organizador", "Resumen y próximos pasos."],
      ],
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
    theme: "minimal",
    organizer: "Andes Ventures",
    sponsors: [logo("novapay", "NovaPay"), logo("pixel-bank", "Pixel Bank"), logo("orbit-cloud", "Orbit Cloud")],
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Bienvenida y resultados", color: "#64748b", main: true },
      { id: "pitches", name: "Sala de Pitches", topic: "Presentaciones de startups", color: "#ec4899", main: false },
      { id: "reuniones", name: "Sala de Reuniones", topic: "Conversaciones con fundadores", color: "#0ea5e9", main: false },
      { id: "fintech", name: "Fintech", topic: "Startups de pagos y crédito", color: "#10b981", main: false },
      { id: "salud", name: "Salud", topic: "Startups de salud digital", color: "#ef4444", main: false },
      { id: "educacion", name: "Educación", topic: "Startups de educación", color: "#f59e0b", main: false },
      { id: "clima", name: "Clima", topic: "Startups de energía y clima", color: "#14b8a6", main: false },
      { id: "legal", name: "Legal", topic: "Asesoría legal para fundadores", color: "#8b5cf6", main: false },
      { id: "networking", name: "Networking", topic: "Conversaciones abiertas", color: "#0ea5e9", main: false },
    ],
    program: {
      auditorio: [
        ["Bienvenida a inversores", "Andes Ventures", "Cómo funciona la jornada y criterios de evaluación."],
        ["Tendencias de inversión en la región", "Ricardo Vega", "Dónde está el capital y qué busca."],
        ["Charla: escalar en LatAm", "Paula Ramírez", "Errores comunes al crecer en varios países."],
        ["Panel de inversores", "Varios invitados", "Preguntas abiertas a los fondos."],
        ["Resultados y cierre", "Jurado", "Anuncio de los equipos seleccionados."],
      ],
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
  {
    id: "404",
    name: "Stellar Hub LatAm",
    tagline: "Un día para construir sobre Stellar: pagos, Soroban y comunidad.",
    private: false,
    theme: "stellar",
    organizer: "Comunidad Stellar LatAm",
    sponsors: [logo("pixel-bank", "Pixel Bank"), logo("novapay", "NovaPay"), logo("orbit-cloud", "Orbit Cloud"), logo("devforge", "DevForge")],
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Keynotes de la red", color: "#f59e0b", main: true },
      { id: "soroban", name: "Sala Soroban", topic: "Contratos inteligentes", color: "#6366f1", main: false },
      { id: "pagos", name: "Sala Pagos", topic: "Pagos y remesas", color: "#10b981", main: false },
      { id: "anchors", name: "Sala Anchors", topic: "Rampas de entrada y salida", color: "#f59e0b", main: false },
      { id: "wallets", name: "Sala Wallets", topic: "Billeteras y passkeys", color: "#14b8a6", main: false },
      { id: "defi", name: "Sala DeFi", topic: "Liquidez y préstamos", color: "#ec4899", main: false },
      { id: "rwa", name: "Activos reales", topic: "Tokenización de activos", color: "#8b5cf6", main: false },
      { id: "hackathon", name: "Hackathon", topic: "Equipos construyendo en vivo", color: "#ef4444", main: false },
      { id: "comunidad", name: "Comunidad", topic: "Embajadores y meetups", color: "#0ea5e9", main: false },
    ],
    program: {
      auditorio: [
        ["Bienvenida al Hub", "Equipo organizador", "Cómo moverte por el hub, la agenda y las salas."],
        ["Keynote: pagos globales en segundos", "Valentina Cruz", "Por qué los pagos son el caso de uso que más crece en la región."],
        ["Panel: construir en Latinoamérica", "Varios invitados", "Equipos de la región cuentan qué funcionó y qué no."],
        ["Cierre y premios del hackathon", "Equipo organizador", "Ganadores y próximos pasos."],
      ],
      soroban: [
        ["Tu primer contrato en Soroban", "Diego Paredes", "De cero a un contrato desplegado en testnet."],
        ["Patrones de almacenamiento", "Ana Ruiz", "Instancia, persistente y temporal: cuándo usar cada uno."],
        ["Testing y auditoría", "Equipo de seguridad", "Pruebas, fuzzing y revisión de contratos."],
      ],
      pagos: [
        ["Remesas con stablecoins", "Martín Silva", "Cómo armar un flujo de remesas de punta a punta."],
        ["Conciliación sin dolor", "Ricardo Vega", "Registrar y conciliar pagos en tiempo real."],
      ],
      anchors: [
        ["SEP-24 en la práctica", "Natalia Ortiz", "Depósitos y retiros con un anchor."],
        ["Cumplimiento en la región", "Natalia Ortiz", "KYC y requisitos de cada país."],
      ],
      wallets: [
        ["Billeteras con passkeys", "Valentina Cruz", "Onboarding sin frases semilla."],
        ["Cuentas patrocinadas", "Iván Torres", "Que tus usuarios no paguen comisiones."],
      ],
      hackathon: [
        ["Arranque del hackathon", "Mentores", "Formación de equipos y reglas."],
        ["Demo day", "Equipos", "Cada equipo presenta lo que construyó."],
      ],
    },
  },
  {
    id: "505",
    name: "Hack Night LatAm",
    tagline: "48 horas para construir: mesas de equipo, mentorías y demo day.",
    private: false,
    theme: "hackathon",
    capacity: 200,
    organizer: "MyConferences",
    sponsors: [
      logo("nimbus-ai", "Nimbus AI"),
      logo("bytelabs", "ByteLabs"),
      logo("devforge", "DevForge"),
      logo("orbit-cloud", "Orbit Cloud"),
      logo("quanta", "Quanta"),
      logo("novapay", "NovaPay"),
      logo("ledgerx", "LedgerX"),
      logo("pulse-api", "Pulse API"),
    ],
    rooms: [
      { id: "auditorio", name: "Auditorio principal", topic: "Apertura, keynotes y premios", color: "#ff7a1a", main: true },
      { id: "demos", name: "Presentación de proyectos", topic: "Demo day de los equipos", color: "#ef4444", main: false },
      { id: "charlas", name: "Charlas técnicas", topic: "Herramientas para el hackathon", color: "#2f6bff", main: false },
      { id: "ia", name: "Taller de IA", topic: "Agentes y APIs de modelos", color: "#10b981", main: false },
      { id: "web3", name: "Sala Web3", topic: "Contratos y pagos", color: "#6366f1", main: false, theme: "stellar" },
      { id: "diseno", name: "Diseño y producto", topic: "Del problema al prototipo", color: "#ec4899", main: false },
      { id: "pitch", name: "Práctica de pitch", topic: "Cómo presentar en 3 minutos", color: "#f59e0b", main: false },
      { id: "apis", name: "Workshop de APIs", topic: "Integrar APIs de los patrocinadores", color: "#14b8a6", main: false },
      { id: "relampago", name: "Charlas relámpago", topic: "5 minutos por charla", color: "#8b5cf6", main: false },
    ],
    program: {
      auditorio: [
        ["Apertura y reglas del hackathon", "Equipo organizador", "Tiempos, premios, mesas de equipo y cómo pedir ayuda."],
        ["Keynote: construir rápido sin romper todo", "Laura Méndez", "Cómo priorizar en 48 horas."],
        ["Premios", "Jurado", "Los equipos ganadores y sus proyectos."],
      ],
      demos: [
        ["Demo day: ronda 1", "Equipos 1 a 6", "Cada equipo presenta su proyecto en 3 minutos."],
        ["Demo day: ronda 2", "Equipos 7 a 12", "Más proyectos, preguntas del jurado."],
      ],
      charlas: [
        ["Deploy en 10 minutos", "Martín Silva", "Llevar tu proyecto a producción sin sufrir."],
        ["Bases de datos para hackathons", "Ana Ruiz", "Qué usar cuando no hay tiempo."],
      ],
      ia: [["Tu primer agente", "Andrés Ríos", "Herramientas, memoria y límites."]],
      pitch: [["El pitch de 3 minutos", "Carla Méndez", "Problema, demo y pedido."]],
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
      theme: seed.theme,
      organizer: seed.organizer,
      logoUrl: seed.id === "101" ? "/assets/logos/myconferences.svg" : null,
      rooms: seed.rooms,
      talks: buildTalks(seed, now),
      sponsors: seed.sponsors,
      capacity: seed.capacity,
    } satisfies Venue,
    whitelist: seed.private ? (whitelists.get(seed.id) ?? new Set<string>()) : null,
  }));
}
