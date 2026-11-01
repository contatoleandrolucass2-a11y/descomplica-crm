import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type AuthUser = {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  permissions: string[];
  host_pages?: string[];
  label?: string;
  scope?: string;
  c2s_flags?: Record<string, boolean>;
};
type Session = {
  user: AuthUser | null;
  preview?: boolean;
  permissions?: string[];
  demo?: {
    users: { id: string; name: string; label: string; team: string }[];
    count: number;
  };
};
type AuthState = Session & {
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
};
const Context = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw Error("Contexto do CRM indisponível.");
  return value;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => {
    try {
      setSession(await api<Session>("/session"));
      setError("");
    } catch (error) {
      setSession({ user: null });
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const expired = () => {
      setSession({ user: null });
      setError("Não foi possível validar sua sessão. Atualize a página do CRM.");
    };
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);
  return (
    <Context.Provider
      value={{
        ...session,
        loading,
        error,
        refresh,
        can: (permission) =>
          (session.user?.permissions || session.permissions || []).includes(permission),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function HostSessionRequired() {
  const auth = useAuth();
  return (
    <div className="lead-login">
      <div className="lead-login-card">
        <img src="/lead-plus/descomplica-lead-icon.svg" alt="" width="44" height="44" />
        <h1>DESCOMPLICA LEAD</h1>
        <p role="status">
          {auth.loading
            ? "Abrindo DESCOMPLICA LEAD…"
            : auth.error ||
              "Não foi possível validar a sessão do CRM. Atualize a página ou entre novamente pelo CRM."}
        </p>
        <button type="button" className="btn" onClick={() => void auth.refresh()}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
