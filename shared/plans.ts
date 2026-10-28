// Planes de las cuentas: qué puede organizar cada una. Los usa el servidor para
// aplicar los límites y el cliente para mostrarlos (página de planes y panel).

import type { ThemeId } from "./themes.ts";

export type PlanId = "free" | "starter" | "community" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** US$ por mes; null = a cotizar. */
  price: number | null;
  /** Para quién es, en una línea. */
  pitch: string;
  /** Personas a la vez en cada evento. */
  people: number;
  /** Eventos con fecha que se pueden hacer en un mes (null = sin límite). */
  eventsPerMonth: number | null;
  /** Eventos en total, de una sola vez (solo el gratis). */
  lifetimeEvents?: number;
  /** Duración máxima de una charla o meetup, en horas. */
  talkHours: number;
  /** Duración máxima de una hackathon, en días (0 = no incluye hackathons). */
  hackathonDays: number;
  /** Hackathons por mes, dentro de los eventos del mes (null = sin máximo propio). */
  hackathonsPerMonth: number | null;
  /** Espacios permanentes (siempre abiertos, como las oficinas Starmaker). */
  permanent: number;
  /** Temáticas que puede usar (null = todas). */
  themes: ThemeId[] | null;
  privateEvents: boolean;
  /** Organizadores además del dueño, mentores y sponsors por evento (null = sin límite). */
  staff: number | null;
  mentors: number | null;
  sponsors: number | null;
  /** Logo propio en el lobby y las pantallas. */
  logo: boolean;
  /** Mapa diseñado a medida. */
  customMap: string;
  support: string;
}

const ALL_BUT_OFFICES: ThemeId[] = ["tech", "minimal", "rustic", "medieval", "garden", "stellar", "hackathon"];

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    pitch: "Para probar con una charla o un meetup.",
    people: 25,
    eventsPerMonth: null,
    lifetimeEvents: 1,
    talkHours: 12,
    hackathonDays: 0,
    hackathonsPerMonth: 0,
    permanent: 0,
    themes: ["tech", "minimal", "garden"],
    privateEvents: false,
    staff: 3,
    mentors: 0,
    sponsors: 0,
    logo: false,
    customMap: "—",
    support: "Guía de ayuda",
  },
  {
    id: "starter",
    name: "Inicial",
    price: 30,
    pitch: "Para quien organiza un par de eventos al mes.",
    people: 50,
    eventsPerMonth: 2,
    talkHours: 72,
    hackathonDays: 3,
    hackathonsPerMonth: null,
    permanent: 0,
    themes: ALL_BUT_OFFICES,
    privateEvents: true,
    staff: 5,
    mentors: 3,
    sponsors: 3,
    logo: false,
    customMap: "—",
    support: "Por correo",
  },
  {
    id: "community",
    name: "Comunidad",
    price: 75,
    pitch: "Para comunidades como Stellar: su oficina siempre abierta y sus eventos.",
    people: 100,
    eventsPerMonth: 4,
    talkHours: 72,
    hackathonDays: 7,
    hackathonsPerMonth: 2,
    permanent: 1,
    themes: null,
    privateEvents: true,
    staff: 13,
    mentors: 15,
    sponsors: 10,
    logo: true,
    customMap: "Aparte (US$150–300)",
    support: "Por correo y WhatsApp",
  },
  {
    id: "pro",
    name: "Pro",
    price: 200,
    pitch: "Para organizaciones con muchos eventos y varios espacios.",
    people: 200,
    eventsPerMonth: null,
    talkHours: 72,
    hackathonDays: 7,
    hackathonsPerMonth: null,
    permanent: 3,
    themes: null,
    privateEvents: true,
    staff: 25,
    mentors: null,
    sponsors: null,
    logo: true,
    customMap: "1 incluido por año",
    support: "Prioritario",
  },
  {
    id: "enterprise",
    name: "Evento Empresarial",
    price: null,
    pitch: "Un evento grande, de 200 a 1000 personas, con soporte en vivo.",
    people: 1000,
    eventsPerMonth: null,
    talkHours: 72,
    hackathonDays: 7,
    hackathonsPerMonth: null,
    permanent: 3,
    themes: null,
    privateEvents: true,
    staff: null,
    mentors: null,
    sponsors: null,
    logo: true,
    customMap: "Incluido + marca blanca",
    support: "En vivo durante el evento",
  },
];

/** Precio del Evento Empresarial según las personas a la vez (hasta 3 días; hasta 7, +30%). */
export const ENTERPRISE_PRICES = [
  { people: 200, price: 450 },
  { people: 300, price: 600 },
  { people: 500, price: 900 },
  { people: 750, price: 1200 },
  { people: 1000, price: 1500 },
];

export const isPlan = (value: unknown): value is PlanId => PLANS.some((p) => p.id === value);
export const planOf = (id: PlanId | null | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0]!;
export const themeAllowed = (plan: Plan, theme: ThemeId) => !plan.themes || plan.themes.includes(theme);
/** El primer plan que incluye esa temática, para decir «desde el plan …». */
export const firstPlanWithTheme = (theme: ThemeId) => PLANS.find((p) => themeAllowed(p, theme))!;

/** Cuántos eventos con fecha ya cuentan para el plan: los del mismo mes (o todos, en el gratis). */
export interface PlanUsage {
  /** Eventos con fecha registrados: su número, cuándo empiezan y si son hackathon. */
  log: { venueId: string; start: number; hackathon: boolean }[];
  /** Espacios permanentes que tiene ahora. */
  permanent: number;
}

const sameMonth = (a: number, b: number) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth();
};

/** Eventos y hackathons del mes de `at`, sin contar el evento que se está editando. */
export function monthUsage(usage: PlanUsage, at: number, except: string | null = null) {
  const inMonth = usage.log.filter((e) => e.venueId !== except && sameMonth(e.start, at));
  return { events: inMonth.length, hackathons: inMonth.filter((e) => e.hackathon).length };
}

const HOUR = 3_600_000;
const dur = (h: number) => (h % 24 === 0 ? `${h / 24} ${h === 24 ? "día" : "días"}` : `${h} horas`);

/**
 * Revisa que un evento entre en el plan. `editing` es el número del evento si ya existía.
 * Devuelve el motivo si no entra, o null.
 */
export function planProblem(
  plan: Plan,
  usage: PlanUsage,
  ev: { theme: ThemeId; private: boolean; staff: number; mentors: number; schedule: { start: number; end: number } | null; wasPermanent: boolean },
  editing: string | null,
): string | null {
  const upgrade = `Con el plan ${plan.name}`;
  if (!themeAllowed(plan, ev.theme)) return `${upgrade} no puedes usar esta temática: está desde el plan ${firstPlanWithTheme(ev.theme).name}.`;
  if (ev.private && !plan.privateEvents) return `${upgrade} los eventos son abiertos. Los privados, con lista de correos, están desde el plan Inicial.`;
  if (plan.staff !== null && ev.staff > plan.staff) return `${upgrade} puedes sumar hasta ${plan.staff} organizadores.`;
  if (plan.mentors !== null && ev.mentors > plan.mentors)
    return plan.mentors ? `${upgrade} puedes sumar hasta ${plan.mentors} mentores.` : `${upgrade} no se pueden sumar mentores: están desde el plan Inicial.`;

  const hackathon = ev.theme === "hackathon";
  if (!ev.schedule) {
    if (!plan.permanent) return `${upgrade} no hay espacios permanentes: están desde el plan Comunidad.`;
    if (!ev.wasPermanent && usage.permanent >= plan.permanent)
      return `${upgrade} puedes tener ${plan.permanent === 1 ? "1 espacio permanente" : `${plan.permanent} espacios permanentes`}, y ya ${plan.permanent === 1 ? "lo tienes" : "los tienes"}.`;
    return null;
  }

  if (hackathon && !plan.hackathonDays) return `${upgrade} solo hay charlas y meetups. Las hackathons están desde el plan Inicial.`;
  const hours = (ev.schedule.end - ev.schedule.start) / HOUR;
  const maxHours = hackathon ? plan.hackathonDays * 24 : plan.talkHours;
  if (hours > maxHours) return `${upgrade} ${hackathon ? "una hackathon" : "un evento"} dura como mucho ${dur(maxHours)}.`;

  const others = usage.log.filter((e) => e.venueId !== editing);
  if (plan.lifetimeEvents !== undefined && others.length >= plan.lifetimeEvents)
    return `${upgrade} tienes ${plan.lifetimeEvents} evento de prueba y ya lo usaste. Para hacer más, pasa al plan Inicial.`;
  const month = monthUsage(usage, ev.schedule.start, editing);
  if (plan.eventsPerMonth !== null && month.events >= plan.eventsPerMonth)
    return `${upgrade} puedes hacer ${plan.eventsPerMonth} eventos por mes, y ese mes ya tienes ${month.events}.`;
  if (hackathon && plan.hackathonsPerMonth !== null && month.hackathons >= plan.hackathonsPerMonth)
    return `${upgrade} puedes hacer hasta ${plan.hackathonsPerMonth} hackathons por mes (dentro de tus ${plan.eventsPerMonth} eventos).`;
  return null;
}
