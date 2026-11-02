"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { BookOpen } from "lucide-react";

type ManualProps = { directTable?: boolean; associative?: boolean; initialOpen?: boolean };

/** Help text and its dialog styles are needed only when the manual is opened. */
export function DeferredInvestorLearningManual(props: Omit<ManualProps, "initialOpen">) {
  const [Manual, setManual] = useState<ComponentType<ManualProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);

  const open = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const manualModule = await import("./InvestorLearningManualContent");
      if (mounted.current) setManual(() => manualModule.InvestorLearningManualContent);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const fromHash = () => {
      if (props.associative && /^#investor-associative-learning-(policy|faq)$/.test(location.hash))
        void open();
    };
    void Promise.resolve().then(fromHash);
    window.addEventListener("hashchange", fromHash);
    return () => {
      mounted.current = false;
      window.removeEventListener("hashchange", fromHash);
    };
  }, [props.associative, open]);

  if (Manual) return <Manual {...props} initialOpen />;
  const modality = props.directTable
    ? "Tabela Direta"
    : props.associative
      ? "Associativo"
      : "Tabela Investidor";
  return (
    <section className="investor-learning-manual" aria-label={`Manual da ${modality}`}>
      <button
        type="button"
        className="investor-learning-link"
        aria-haspopup="dialog"
        disabled={loading}
        onClick={() => void open()}
      >
        {props.associative && !props.directTable ? (
          <BookOpen size={20} aria-hidden="true" style={{ flex: "0 0 auto" }} />
        ) : null}
        {loading ? (
          "Abrindo manual…"
        ) : (
          <>
            Aprenda <span aria-hidden="true">+</span>
          </>
        )}
      </button>
      {error ? <p role="alert">Não foi possível abrir o manual. Tente novamente.</p> : null}
    </section>
  );
}
