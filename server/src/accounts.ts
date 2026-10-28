// Cuentas guardadas en un archivo JSON. Alcanza para un evento; para algo más
// grande conviene una base de datos.

import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_LOOK, sanitizeLook } from "../../shared/look.ts";
import { COMMUNITIES, isPlan, type PlanId, type PlanUsage } from "../../shared/plans.ts";
import type { Account, AdminAccount, Look } from "../../shared/types.ts";
import { sendCode } from "./mail.ts";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const TOKEN_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;
const CODE_MS = 15 * 60_000;
const CODE_TRIES = 5;
const RESEND_MS = 30_000;

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  look: Look;
  company: { name: string } | null;
  passwordHash: string;
  createdAt: number;
  /** false hasta confirmar el correo. Las cuentas de antes de existir la confirmación no lo tienen y valen como confirmadas. */
  verified?: boolean;
  /** Código pendiente para confirmar el correo (guardado como hash). */
  code?: { hash: string; expires: number; tries: number; sentAt: number };
  /** Plan asignado por la administración. Sin él: Pro para la administración y Gratis para el resto. */
  plan?: PlanId;
  /** Plan que pidió desde la página de planes. */
  planRequest?: PlanId;
  /** Comunidades a las que la sumó la administración (habilitan sus temáticas exclusivas). */
  communities?: string[];
  /** Eventos con fecha que organizó (no se borran al cerrar el evento: cuentan para el mes). */
  eventLog?: PlanUsage["log"];
}

interface Store {
  secret: string;
  accounts: StoredAccount[];
}

export class AccountError extends Error {}

/**
 * Cuentas de administración: los correos de ADMIN_EMAILS (separados por coma) y los de
 * data/admins.txt (uno por línea). Se leen al arrancar el servidor.
 */
function loadAdmins(dataDir: string) {
  const file = path.join(dataDir, "admins.txt");
  const fromFile = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  return new Set([...(process.env.ADMIN_EMAILS ?? "").split(","), ...fromFile].map((e) => e.trim().toLowerCase()).filter((e) => e && !e.startsWith("#")));
}

export function createAccountStore(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "accounts.json");
  const store: Store = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Store)
    : { secret: randomBytes(32).toString("hex"), accounts: [] };
  const secret = process.env.SESSION_SECRET ?? store.secret;

  // Las escrituras se encadenan para que dos cambios seguidos no se pisen.
  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.then(async () => {
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(store, null, 2));
      await rename(tmp, file);
    });
    return writing;
  };
  if (!existsSync(file)) void persist();

  const failures = new Map<string, { count: number; until: number }>();

  const admins = loadAdmins(dataDir);
  if (!admins.size) console.log("[cuentas] No hay administración: agrega correos en ADMIN_EMAILS o en data/admins.txt para poder habilitar a quién crea eventos.");
  const byEmail = (email: string) => store.accounts.find((a) => a.email === email);
  const isAdmin = (a: StoredAccount) => admins.has(a.email);
  const toAccount = (a: StoredAccount): Account => ({
    id: a.id,
    email: a.email,
    name: a.name,
    look: a.look,
    company: a.company ?? null,
    verified: a.verified !== false,
    admin: isAdmin(a),
    plan: a.plan ?? (isAdmin(a) ? "pro" : "free"),
    planRequest: a.planRequest ?? null,
    // La administración puede usar todas las temáticas.
    communities: isAdmin(a) ? COMMUNITIES.map((c) => c.id) : (a.communities ?? []),
  });
  const byId = (id: string) => {
    const account = store.accounts.find((a) => a.id === id);
    if (!account) throw new AccountError("La cuenta ya no existe");
    return account;
  };

  /** Genera un código de 6 dígitos, guarda su hash y lo manda por correo. */
  async function issueCode(account: StoredAccount) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    account.code = { hash: sign(`code:${account.id}:${code}`), expires: Date.now() + CODE_MS, tries: 0, sentAt: Date.now() };
    await persist();
    await sendCode(account.email, account.name, code);
  }

  const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

  function issueToken(id: string) {
    const payload = `${id}.${Date.now() + TOKEN_DAYS * 86_400_000}`;
    return `${payload}.${sign(payload)}`;
  }

  async function hash(password: string) {
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, 64);
    return `${salt.toString("hex")}:${key.toString("hex")}`;
  }

  async function matches(password: string, stored: string) {
    const [salt, key] = stored.split(":");
    const expected = Buffer.from(key!, "hex");
    const actual = await scryptAsync(password, Buffer.from(salt!, "hex"), expected.length);
    return timingSafeEqual(expected, actual);
  }

  const normalizeEmail = (raw: unknown) => (typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 120) : "");
  const cleanName = (raw: unknown) => (typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, 24) : "");

  return {
    async register(input: { email?: unknown; password?: unknown; name?: unknown; company?: unknown }) {
      const email = normalizeEmail(input.email);
      const name = cleanName(input.name);
      const company = typeof input.company === "string" ? input.company.trim().replace(/\s+/g, " ").slice(0, 60) : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError("Escribe un correo válido");
      if (!name) throw new AccountError("Escribe el nombre de tu personaje");
      if (password.length < 8) throw new AccountError("La contraseña debe tener al menos 8 caracteres");
      if (byEmail(email)) throw new AccountError("Ya existe una cuenta con ese correo");
      const account: StoredAccount = {
        id: randomUUID(),
        email,
        name,
        look: DEFAULT_LOOK,
        company: company ? { name: company } : null,
        passwordHash: await hash(password),
        createdAt: Date.now(),
        verified: false,
      };
      store.accounts.push(account);
      await persist();
      // Para entrar hay que confirmar el correo con el código que le llega.
      await issueCode(account);
      return { account: toAccount(account), token: issueToken(account.id) };
    },

    async login(input: { email?: unknown; password?: unknown }) {
      const email = normalizeEmail(input.email);
      const password = typeof input.password === "string" ? input.password : "";
      const lock = failures.get(email);
      if (lock && lock.until > Date.now()) throw new AccountError("Demasiados intentos. Prueba de nuevo en unos minutos");
      const account = byEmail(email);
      if (!account || !(await matches(password, account.passwordHash))) {
        const count = (lock?.count ?? 0) + 1;
        failures.set(email, { count, until: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 });
        throw new AccountError("Correo o contraseña incorrectos");
      }
      failures.delete(email);
      return { account: toAccount(account), token: issueToken(account.id) };
    },

    /** Devuelve la cuenta del token, o null si no es válido o expiró. */
    verify(token: unknown): Account | null {
      if (typeof token !== "string") return null;
      const [id, exp, sig] = token.split(".");
      if (!id || !exp || !sig) return null;
      const expected = Buffer.from(sign(`${id}.${exp}`));
      const given = Buffer.from(sig);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
      if (Number(exp) < Date.now()) return null;
      const account = store.accounts.find((a) => a.id === id);
      return account ? toAccount(account) : null;
    },

    /** Confirma el correo con el código. */
    async verifyCode(id: string, raw: unknown) {
      const account = byId(id);
      if (account.verified !== false) return toAccount(account);
      const code = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
      const pending = account.code;
      if (!pending || pending.expires < Date.now()) throw new AccountError("El código venció. Pide uno nuevo");
      if (pending.tries >= CODE_TRIES) throw new AccountError("Demasiados intentos. Pide un código nuevo");
      const given = Buffer.from(sign(`code:${account.id}:${code}`));
      const expected = Buffer.from(pending.hash);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        pending.tries++;
        await persist();
        throw new AccountError("El código no es correcto");
      }
      account.verified = true;
      delete account.code;
      await persist();
      return toAccount(account);
    },

    /** Manda un código nuevo (como mucho uno cada 30 segundos). */
    async resendCode(id: string) {
      const account = byId(id);
      if (account.verified !== false) return;
      if (account.code && Date.now() - account.code.sentAt < RESEND_MS) throw new AccountError("Espera unos segundos antes de pedir otro código");
      await issueCode(account);
    },

    /** Todas las cuentas, para la administración. */
    list(): AdminAccount[] {
      return store.accounts
        .map((a) => {
          const acc = toAccount(a);
          return { id: a.id, email: a.email, name: a.name, company: a.company?.name ?? null, verified: acc.verified, admin: acc.admin, plan: acc.plan, planRequest: acc.planRequest, communities: acc.communities, createdAt: a.createdAt };
        })
        .sort((x, y) => y.createdAt - x.createdAt);
    },

    /** La administración asigna el plan (y con eso responde el pedido, si había). */
    async setPlan(id: string, plan: unknown) {
      if (!isPlan(plan)) throw new AccountError("Ese plan no existe");
      const account = byId(id);
      account.plan = plan;
      delete account.planRequest;
      await persist();
      return toAccount(account);
    },

    /** La administración suma o saca a la cuenta de las comunidades. */
    async setCommunities(id: string, list: unknown) {
      const account = byId(id);
      account.communities = (Array.isArray(list) ? list : []).filter((c): c is string => COMMUNITIES.some((x) => x.id === c));
      await persist();
      return toAccount(account);
    },

    /** Pedido de plan desde la página de planes (null lo cancela). */
    async requestPlan(id: string, plan: unknown) {
      const account = byId(id);
      if (plan === null) delete account.planRequest;
      else if (isPlan(plan)) account.planRequest = plan;
      else throw new AccountError("Ese plan no existe");
      await persist();
      return toAccount(account);
    },

    /** La cuenta por su id, o null (para leer el plan del dueño de un evento). */
    byIdOrNull(id: string): Account | null {
      const account = store.accounts.find((a) => a.id === id);
      return account ? toAccount(account) : null;
    },

    /** Eventos con fecha que ya organizó, para los límites del plan. */
    eventLog: (id: string) => byId(id).eventLog ?? [],

    /** Registra (o mueve de fecha) un evento con fecha; uno que pasa a permanente deja de contar. */
    async logEvent(id: string, entry: PlanUsage["log"][number] | { venueId: string; start: null }) {
      const account = byId(id);
      const log = (account.eventLog ?? []).filter((e) => e.venueId !== entry.venueId);
      if (entry.start !== null) log.push(entry as PlanUsage["log"][number]);
      account.eventLog = log;
      await persist();
    },

    async setCompany(id: string, company: unknown) {
      const account = store.accounts.find((a) => a.id === id);
      if (!account) throw new AccountError("La cuenta ya no existe");
      const name = typeof company === "string" ? company.trim().replace(/\s+/g, " ").slice(0, 60) : "";
      if (!name) throw new AccountError("Escribe el nombre de la empresa");
      account.company = { name };
      await persist();
      return toAccount(account);
    },

    async update(id: string, changes: { name: unknown; look: Look }) {
      const account = store.accounts.find((a) => a.id === id);
      if (!account) throw new AccountError("La cuenta ya no existe");
      const name = cleanName(changes.name);
      if (!name) throw new AccountError("Escribe el nombre de tu personaje");
      account.name = name;
      account.look = sanitizeLook(changes.look);
      await persist();
      return toAccount(account);
    },
  };
}
