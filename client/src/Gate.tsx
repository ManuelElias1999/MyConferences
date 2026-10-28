import { useState } from "react";
import type { Account } from "../../shared/types.ts";
import { accountApi, authRequest } from "./lib.ts";

/**
 * La puerta de entrada: para entrar a MyConferences hace falta una cuenta con el
 * correo confirmado. Primero se inicia sesión o se crea la cuenta; después se
 * escribe el código que llegó por correo.
 */
export default function Gate({
  account,
  onAuthDone,
  onVerified,
  onLogout,
}: {
  account: Account | null;
  onAuthDone: (result: { account: Account; token: string }, created: boolean) => void;
  onVerified: (account: Account) => void;
  onLogout: () => void;
}) {
  return (
    <main className="gate">
      <div className="gate-card">
        <div className="brand gate-brand">
          <span className="brand-mark" aria-hidden />
          <span>MyConferences</span>
        </div>
        {account ? <VerifyForm account={account} onVerified={onVerified} onLogout={onLogout} /> : <AuthForm onDone={onAuthDone} />}
      </div>
    </main>
  );
}

function AuthForm({ onDone }: { onDone: (result: { account: Account; token: string }, created: boolean) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await authRequest(mode, registering ? { name, email, password } : { email, password }), registering);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1 className="gate-title">{registering ? "Crea tu cuenta" : "Inicia sesión"}</h1>
      <p className="muted">
        {registering
          ? "Para entrar a los eventos necesitas una cuenta con tu correo. Te mandaremos un código para confirmarlo."
          : "Entra con tu correo para ir a la recepción y a tus eventos."}
      </p>
      {registering && (
        <label>
          Nombre del personaje
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoFocus placeholder="Ana" />
        </label>
      )}
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!registering} autoComplete="email" placeholder="ana@ejemplo.com" />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={registering ? 8 : undefined}
          autoComplete={registering ? "new-password" : "current-password"}
          placeholder={registering ? "Al menos 8 caracteres" : ""}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Un momento…" : registering ? "Crear cuenta" : "Entrar"}
      </button>
      <button
        type="button"
        className="link"
        onClick={() => {
          setMode(registering ? "login" : "register");
          setError("");
        }}
      >
        {registering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Créala"}
      </button>
    </form>
  );
}

function VerifyForm({ account, onVerified, onLogout }: { account: Account; onVerified: (account: Account) => void; onLogout: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await accountApi<{ account: Account }>("/verify", { body: { code } });
      onVerified(res.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
      setBusy(false);
    }
  };
  const resend = async () => {
    setError("");
    setInfo("");
    try {
      await accountApi("/verify/resend", { body: {} });
      setInfo("Te mandamos un código nuevo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1 className="gate-title">Confirma tu correo</h1>
      <p className="muted">
        Te mandamos un código de 6 números a <b>{account.email}</b>. Escríbelo aquí para entrar. Si no lo ves, revisa el correo no deseado.
      </p>
      <label>
        Código
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          placeholder="123456"
          className="code-input"
        />
      </label>
      {error && <p className="error">{error}</p>}
      {info && <p className="small">{info}</p>}
      <button className="btn primary" disabled={busy || code.length < 6}>
        {busy ? "Un momento…" : "Confirmar y entrar"}
      </button>
      <div className="gate-links">
        <button type="button" className="link" onClick={resend}>
          Mandar otro código
        </button>
        <button type="button" className="link" onClick={onLogout}>
          Usar otra cuenta
        </button>
      </div>
    </form>
  );
}
