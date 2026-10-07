import { useState } from "react";
import type { Account } from "../../shared/types.ts";
import { authRequest } from "./lib.ts";
import Modal from "./Modal.tsx";

export default function AuthDialog({
  initialMode,
  onDone,
  onClose,
}: {
  initialMode: "login" | "register" | "company";
  onDone: (result: { account: Account; token: string }, created: boolean) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode === "company" ? "register" : initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCompany, setIsCompany] = useState(initialMode === "company");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authRequest(
        mode,
        registering ? { name, email, password, ...(isCompany ? { company } : {}) } : { email, password },
      );
      onDone(result, registering);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
      setBusy(false);
    }
  };

  return (
    <Modal title={registering ? (isCompany ? "Crea tu cuenta de empresa" : "Crea tu cuenta") : "Inicia sesión"} onClose={onClose} narrow>
      <form className="form" onSubmit={submit}>
        <p className="muted">
          {registering
            ? "Con una cuenta guardas tu personaje y puedes entrar a salas privadas si tu correo está en la lista de invitados."
            : "Entra con tu cuenta para aparecer con tu personaje."}
        </p>
        {registering && (
          <label>
            Nombre del personaje
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoFocus placeholder="Ana" />
          </label>
        )}
        {registering && (
          <label className="check">
            <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} />
            Es una cuenta de empresa: quiero organizar eventos
          </label>
        )}
        {registering && isCompany && (
          <label>
            Nombre de la empresa
            <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={60} required placeholder="Acme Tech" />
          </label>
        )}
        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={!registering}
            autoComplete="email"
            placeholder="ana@ejemplo.com"
          />
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
        <button type="button" className="link" onClick={() => setMode(registering ? "login" : "register")}>
          {registering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Créala"}
        </button>
      </form>
    </Modal>
  );
}
