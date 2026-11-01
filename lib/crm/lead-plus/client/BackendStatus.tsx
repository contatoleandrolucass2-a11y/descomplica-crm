import { useEffect, useState } from "react";
import { api } from "./api";
export default function BackendStatus() {
  const [state, setState] = useState("Conferindo banco…");
  useEffect(() => {
    let active = true;
    api<{ database_target: string; schema: string }>("/health")
      .then((health) => {
        if (active)
          setState(
            health.database_target === "remote"
              ? "Supabase remoto · DESCOMPLICA LEAD"
              : "Supabase local · DESCOMPLICA LEAD",
          );
      })
      .catch(() => {
        if (active) setState("Banco indisponível");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <span className="backend-state" role="status">
      {state}
    </span>
  );
}
