// Cuentas guardadas en un archivo JSON. Alcanza para un evento; para algo más
// grande conviene una base de datos.

import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_LOOK, sanitizeLook } from "../../shared/look.ts";
import type { Account, Look } from "../../shared/types.ts";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const TOKEN_DAYS = 30;
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60_000;

interface StoredAccount extends Account {
  passwordHash: string;
  createdAt: number;
}

interface Store {
  secret: string;
  accounts: StoredAccount[];
}

export class AccountError extends Error {}

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

  const byEmail = (email: string) => store.accounts.find((a) => a.email === email);
  const toAccount = ({ id, email, name, look }: StoredAccount): Account => ({ id, email, name, look });

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
    async register(input: { email?: unknown; password?: unknown; name?: unknown }) {
      const email = normalizeEmail(input.email);
      const name = cleanName(input.name);
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
        passwordHash: await hash(password),
        createdAt: Date.now(),
      };
      store.accounts.push(account);
      await persist();
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
