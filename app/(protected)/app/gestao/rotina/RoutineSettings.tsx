"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Plus, RotateCcw, Save, Sparkles } from "lucide-react";

import { SimulationCanvasHeader } from "@/app/(protected)/app/simulacao/_components/SimulationCanvasHeader";
import "@/app/(protected)/app/simulacao/_components/archive-investor/investor-theme-tokens.css";
import "@/app/(protected)/app/simulacao/_components/archive-investor/canvas-layout.css";
import styles from "./RoutineSettings.module.css";

const STORAGE_KEY = "descomplica.crm.settings.routine.v1";

const weekdays = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
] as const;

type Weekday = (typeof weekdays)[number];
type RoleKey =
  | "regional-house"
  | "regional-imob"
  | "gerente-house"
  | "coordenador-vendas"
  | "coordenador-parcerias"
  | "corretor";
type RoutineRow = Record<Weekday, string>;
type RoutineState = Record<RoleKey, RoutineRow[]>;

const roles: Array<{ key: RoleKey; label: string }> = [
  {
    key: "regional-house",
    label: "Gerente regional house",
  },
  {
    key: "regional-imob",
    label: "Gerente regional imob",
  },
  {
    key: "gerente-house",
    label: "Gerente house",
  },
  {
    key: "coordenador-vendas",
    label: "Coordenador de vendas",
  },
  {
    key: "coordenador-parcerias",
    label: "Coordenador de parcerias",
  },
  {
    key: "corretor",
    label: "Corretor",
  },
];

const emptyRow = (): RoutineRow =>
  weekdays.reduce(
    (row, weekday) => ({
      ...row,
      [weekday]: "",
    }),
    {} as RoutineRow,
  );

const regionalHouseRows: RoutineRow[] = [
  {
    "Segunda-feira": "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
    "Terça-feira": "Acompanhar a frequência do time de acordo com a escala.",
    "Quarta-feira": "Acompanhar a frequência do time de acordo com a escala.",
    "Quinta-feira": "Time 100% convocado nesse dia. Ativação on-line o dia inteiro.",
    "Sexta-feira": "Acompanhar a frequência do time de acordo com a escala.",
    Sábado: "Acompanhar a frequência do time nesse dia.",
    Domingo: "",
  },
  {
    "Segunda-feira": "",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira":
      "Realizar uma preleção com o time, motivando a equipe a buscar a meta traçada para o dia.",
    "Sexta-feira": "",
    Sábado: "Analisar o número de visitas nesse dia.",
    Domingo: "",
  },
  {
    "Segunda-feira": "Verificar se existem leads parados.",
    "Terça-feira": "Verificar se existem leads parados.",
    "Quarta-feira": "Verificar se existem leads parados.",
    "Quinta-feira": "Verificar se existem leads parados.",
    "Sexta-feira": "Verificar se existem leads parados.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar se o anúncio está entregando o necessário.",
    "Terça-feira": "Analisar se o anúncio está entregando o necessário.",
    "Quarta-feira": "Analisar se o anúncio está entregando o necessário.",
    "Quinta-feira": "Analisar se o anúncio está entregando o necessário.",
    "Sexta-feira": "Analisar se o anúncio está entregando o necessário.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar o volta ao caixa de marketing e comparar com o tamanho do time.",
    "Terça-feira": "Verificar repasse e prazos.",
    "Quarta-feira": "Analisar o planejamento da ação externa e acompanhar o resultado final.",
    "Quinta-feira": "Preparar a base para a geração do ofertão.",
    "Sexta-feira": "Analisar o volta ao caixa de marketing e comparar com o tamanho do time.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "",
    "Terça-feira":
      "Analisar o número de agendamentos do dia anterior. Se estiver abaixo da meta, orientar o gerente sobre quantos agendamentos ainda faltam.",
    "Quarta-feira":
      "Analisar o número de agendamentos do dia anterior. Se estiver abaixo da meta, orientar o gerente sobre quantos agendamentos ainda faltam.",
    "Quinta-feira":
      "Analisar o número de agendamentos do dia anterior. Se estiver abaixo da meta, orientar o gerente sobre quantos agendamentos ainda faltam.",
    "Sexta-feira":
      "Analisar o número de agendamentos do dia anterior. Se estiver abaixo da meta, orientar o gerente sobre quantos agendamentos ainda faltam.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar a quantidade de leads do dia em relação ao tamanho do time.",
    "Terça-feira": "Analisar o planejamento da ação externa e acompanhar o resultado final.",
    "Quarta-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    "Quinta-feira":
      "Cobrar retorno dos agendamentos da semana passada que não compareceram e direcionar para o final de semana.",
    "Sexta-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar a projeção de crescimento.",
    "Terça-feira": "Treinamento de processos.",
    "Quarta-feira": "",
    "Quinta-feira":
      "Conferir os agendamentos com o gerente. Cada corretor deve fazer no mínimo dois agendamentos no dia. Se estiver abaixo da meta, orientar ações para alcançar o número esperado nessa data.",
    "Sexta-feira": "Treinamento acelera.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Programa retenção. Analisar a frequência dos corretores no programa na semana anterior e ajustar a roleta semanal.",
    "Terça-feira": "Analisar o percentual da equipe sem Creci e criar um plano de ação.",
    "Quarta-feira": "Acompanhar os prazos de atendimento e cobrar atualização no sistema.",
    "Quinta-feira":
      "Comparar com o gerente a conversão de agendamentos para visitas e orientar melhorias na qualidade dos agendamentos.",
    "Sexta-feira": "Acompanhar os prazos de atendimento e cobrar atualização no sistema.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Leads do gerente. Analisar a frequência dos corretores na semana anterior e ajustar a roleta semanal.",
    "Terça-feira":
      "Verificar se o cliente assinou o contrato e pagou o sinal. Identificar falhas no comissionamento da cadeia: corretor, gerente regional e diretor. Se houver falha, acionar o coordenador que gerou o contrato para resolver.",
    "Quarta-feira":
      "Analisar no painel de oportunidades os rankings com datas iguais ou posteriores à última consulta do CPF que não evoluíram para venda. Realizar uma nova consulta do CPF e criar um plano de ação para o cliente.",
    "Quinta-feira":
      "Observar vestimenta, comportamento e rotina dos corretores. Acompanhar de perto ligações e mensagens e orientar os ajustes necessários.",
    "Sexta-feira":
      "Analisar os detalhes de cada ficha aprovada que ainda não gerou venda e buscar soluções para converter o cliente.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Comparar regionais por tamanho de equipe, funil de vendas e percentual de leads perdidos.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira":
      "Analisar o plano de ação elaborado na segunda-feira e identificar necessidade de ajuste de rota.",
    "Sexta-feira":
      "Analisar os detalhes de cada ficha reprovada com a CCA e o corretor para buscar reversão do processo.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o percentual de leads perdidos em aguardando atendimento e em atendimento.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira":
      "Analisar fichas em rascunho. Não deve haver processo com esse status sem ação para avançar.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o percentual de leads perdidos em aguardando atendimento e em atendimento.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira":
      "Analisar vendas futuras e facilitadas e buscar soluções para antecipar o repasse do cliente.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar os números previstos para o final de semana em comparação com o realizado.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Verificar evidências do plano de ação em agendamento, visita, pasta e venda. Analisar a evolução.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o número de agendamentos realizados na semana anterior e no mês vigente e comparar com o indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o número de visitas realizadas na semana anterior e no mês vigente e comparar com o indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o número de pastas realizadas na semana anterior e no mês vigente e comparar com o indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o número de vendas realizadas na semana anterior e no mês vigente e comparar com o indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar planejado contra realizado e criar um plano de ação da semana vigente.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Acompanhar o tamanho da equipe. Comparar a quantidade de corretores com o tempo de casa do gerente e analisar a equipe produtiva em agendamentos, visitas, pastas e vendas.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar o turnover de cada equipe e ajustar a rota para reduzir ao máximo.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Cobrar do gerente o descredenciamento de corretores com mais de 30 dias sem agendamento ou visita.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Ajustar a escala de folga dos gerentes e acompanhar a escala dos corretores para prever o time no plantão e seus dias.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    "Terça-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    "Quarta-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    "Quinta-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    "Sexta-feira":
      "Analisar o funil de vendas e conferir se cada etapa está de acordo com a média.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Publicar conteúdo nos stories, nas redes sociais e no status.",
    "Terça-feira": "Publicar conteúdo nos stories, nas redes sociais e no status.",
    "Quarta-feira": "Publicar conteúdo nos stories, nas redes sociais e no status.",
    "Quinta-feira":
      "Preencher e analisar o resultado. Ajustar a rota quando os números não forem satisfatórios.",
    "Sexta-feira": "Publicar conteúdo nos stories, nas redes sociais e no status.",
    Sábado: "",
    Domingo: "",
  },
];

const defaultRoutine: RoutineState = {
  "regional-house": regionalHouseRows,
  "regional-imob": [],
  "gerente-house": [],
  "coordenador-vendas": [],
  "coordenador-parcerias": [],
  corretor: [],
};

function normalizeStoredRoutine(value: unknown): RoutineState {
  if (!value || typeof value !== "object") return defaultRoutine;
  const source = value as Partial<Record<RoleKey, unknown>>;
  return roles.reduce((state, role) => {
    const storedRows = source[role.key];
    const rows: unknown[] = Array.isArray(storedRows) ? storedRows : defaultRoutine[role.key];
    state[role.key] = rows
      .filter((row): row is Partial<Record<Weekday, unknown>> => !!row && typeof row === "object")
      .map((row) =>
        weekdays.reduce(
          (clean, weekday) => ({
            ...clean,
            [weekday]: typeof row[weekday] === "string" ? row[weekday] : "",
          }),
          {} as RoutineRow,
        ),
      );
    return state;
  }, {} as RoutineState);
}

function countFilledCells(rows: RoutineRow[]) {
  return rows.reduce(
    (total, row) => total + weekdays.filter((weekday) => row[weekday].trim().length > 0).length,
    0,
  );
}

function fitRoutineFields(table: HTMLTableElement | null) {
  if (!table) return;
  const fields = Array.from(table.querySelectorAll("textarea"));
  // Batch measurements so typing does not trigger a layout for every cell.
  fields.forEach((field) => {
    field.style.height = "auto";
  });
  const heights = fields.map((field) => {
    const style = getComputedStyle(field);
    const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    return Math.max(44, field.scrollHeight + borders);
  });
  fields.forEach((field, index) => {
    field.style.height = `${heights[index]}px`;
  });
}

type RoutineNavigationEvent = Event & {
  hashChange: boolean;
  destination: { url: string; sameDocument: boolean };
  navigationType: string;
};

type RoutineBrowserNavigation = {
  currentEntry?: { index: number };
  addEventListener: (
    type: "navigate" | "navigatesuccess" | "navigateerror",
    listener: (event: RoutineNavigationEvent) => void,
  ) => void;
  removeEventListener: (
    type: "navigate" | "navigatesuccess" | "navigateerror",
    listener: (event: RoutineNavigationEvent) => void,
  ) => void;
};

export function RoutineSettings() {
  const [activeRole, setActiveRole] = useState<RoleKey>("regional-house");
  const [routine, setRoutine] = useState<RoutineState>(defaultRoutine);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tableRef = useRef<HTMLTableElement | null>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
    });
    const refresh = () => setToday(formatter.format(new Date()));
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const loadStoredRoutine = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setRoutine(normalizeStoredRoutine(JSON.parse(stored)));
        }
      } catch {
        setStorageError(
          "Não foi possível carregar a rotina salva neste navegador. A rotina inicial está sendo exibida.",
        );
      } finally {
        setHasLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(loadStoredRoutine);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const protectedLocation = new URL(window.location.href);
    const protectedHistoryState = window.history.state;
    const browserNavigation = (window as Window & { navigation?: RoutineBrowserNavigation })
      .navigation;
    const protectedHistoryIndex = browserNavigation?.currentEntry?.index;
    let restoringHistory = false;
    let approvedDestination: string | null = null;
    let unloadApproved = false;
    const destinationKey = (destination: URL) =>
      destination.origin + destination.pathname + destination.search;
    const confirmDiscard = () =>
      window.confirm("Existem alterações não salvas na rotina. Sair sem salvar?");
    const approveNavigation = (destination: URL) => {
      approvedDestination = destinationKey(destination);
    };
    const clearApproval = () => {
      approvedDestination = null;
      unloadApproved = false;
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unloadApproved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== protectedLocation.origin) return;
      if (
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) return;
      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      approveNavigation(destination);
    };
    const confirmNavigationApi = (event: RoutineNavigationEvent) => {
      if (event.hashChange || !event.cancelable) return;
      // App Router commits history with the render; cancelling pushState cannot undo that render.
      if (event.destination.sameDocument && ["push", "replace"].includes(event.navigationType))
        return;
      const destination = new URL(event.destination.url);
      if (destination.origin !== protectedLocation.origin) return;
      if (
        event.navigationType !== "reload" &&
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) {
        unloadApproved = !event.destination.sameDocument;
        return;
      }
      if (!confirmDiscard()) {
        event.preventDefault();
        return;
      }
      approveNavigation(destination);
      unloadApproved = !event.destination.sameDocument;
    };
    const confirmHistoryNavigation = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      const destination = new URL(window.location.href);
      if (
        destination.pathname === protectedLocation.pathname &&
        destination.search === protectedLocation.search
      )
        return;
      if (approvedDestination === destinationKey(destination)) return;
      if (confirmDiscard()) {
        approveNavigation(destination);
        return;
      }
      event.stopImmediatePropagation();
      const destinationHistoryIndex = browserNavigation?.currentEntry?.index;
      if (
        Number.isInteger(protectedHistoryIndex) &&
        Number.isInteger(destinationHistoryIndex) &&
        protectedHistoryIndex !== destinationHistoryIndex
      ) {
        restoringHistory = true;
        window.history.go(protectedHistoryIndex! - destinationHistoryIndex!);
        return;
      }
      window.history.pushState(protectedHistoryState, "", protectedLocation.href);
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    browserNavigation?.addEventListener("navigate", confirmNavigationApi);
    browserNavigation?.addEventListener("navigatesuccess", clearApproval);
    browserNavigation?.addEventListener("navigateerror", clearApproval);
    window.addEventListener("popstate", confirmHistoryNavigation, true);
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      browserNavigation?.removeEventListener("navigate", confirmNavigationApi);
      browserNavigation?.removeEventListener("navigatesuccess", clearApproval);
      browserNavigation?.removeEventListener("navigateerror", clearApproval);
      window.removeEventListener("popstate", confirmHistoryNavigation, true);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [hasUnsavedChanges, routine]);

  const activeRows = routine[activeRole];
  const activeRoleInfo = roles.find((role) => role.key === activeRole) ?? roles[0]!;
  useEffect(() => {
    fitRoutineFields(tableRef.current);
  }, [activeRows]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let previousWidth = 0;
    const observer = new ResizeObserver(() => {
      if (table.clientWidth === previousWidth) return;
      previousWidth = table.clientWidth;
      fitRoutineFields(table);
    });
    observer.observe(table);
    return () => observer.disconnect();
  }, [activeRole, activeRows.length]);
  const activeSummary = useMemo(
    () => ({
      rows: activeRows.length,
      filled: countFilledCells(activeRows),
    }),
    [activeRows],
  );

  function updateCell(rowIndex: number, weekday: Weekday, value: string) {
    if (!hasLoaded) return;
    setRoutine((current) => ({
      ...current,
      [activeRole]: current[activeRole].map((row, index) =>
        index === rowIndex ? { ...row, [weekday]: value } : row,
      ),
    }));
    setHasUnsavedChanges(true);
  }

  function addRow() {
    if (!hasLoaded) return;
    setRoutine((current) => ({
      ...current,
      [activeRole]: [...current[activeRole], emptyRow()],
    }));
    setHasUnsavedChanges(true);
  }

  function resetActiveRole() {
    if (!hasLoaded) return;
    if (
      !window.confirm(
        `Restaurar a rotina de ${activeRoleInfo.label.toLowerCase()}? As alterações desta função serão descartadas.`,
      )
    )
      return;
    setRoutine((current) => ({
      ...current,
      [activeRole]: defaultRoutine[activeRole],
    }));
    setHasUnsavedChanges(true);
  }

  function saveRoutine() {
    if (!hasLoaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routine));
      setSavedAt(
        new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
      );
      setHasUnsavedChanges(false);
      setStorageError(null);
    } catch {
      setSavedAt(null);
      setHasUnsavedChanges(true);
      setStorageError(
        "Não foi possível salvar a rotina neste navegador. As alterações continuam não salvas.",
      );
    }
  }

  function handleRoleKeyDown(event: KeyboardEvent<HTMLButtonElement>, roleIndex: number) {
    if (!hasLoaded) return;
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (roleIndex + 1) % roles.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (roleIndex - 1 + roles.length) % roles.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = roles.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActiveRole(roles[nextIndex]!.key);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={`investor-page-shell ${styles.page}`}>
      <main className={`investor-main ${styles.main}`}>
        <SimulationCanvasHeader
          eyebrow="Gestão"
          title="Rotina"
          description="Classificação semanal das rotinas comerciais por função."
          statusLabel="Rotina editável"
          actions={
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.secondaryAction}
                aria-label="Restaurar rotina da função ativa"
                title="Restaurar rotina da função ativa"
                disabled={!hasLoaded}
                onClick={resetActiveRole}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={!hasLoaded}
                onClick={saveRoutine}
              >
                <Save size={17} aria-hidden="true" />
                Salvar alterações
              </button>
            </div>
          }
        />

        <div className={styles.saveState} role="status" aria-live="polite">
          <Sparkles size={18} aria-hidden="true" />
          <span>
            {!hasLoaded
              ? "Carregando rotina."
              : hasUnsavedChanges
                ? "Alterações não salvas."
                : savedAt
                  ? `Último salvamento local em ${savedAt}.`
                  : "Nenhuma alteração pendente."}
          </span>
        </div>

        {storageError ? (
          <p className={styles.storageError} role="alert">
            {storageError}
          </p>
        ) : null}

        <section className={styles.rolesPanel} aria-labelledby="routine-options-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Opções</p>
              <h2 id="routine-options-title">Escolha a função</h2>
            </div>
            <span>{roles.length} funções</span>
          </div>
          <div className={styles.roleTabs} role="tablist" aria-label="Opções de rotina">
            {roles.map((role, roleIndex) => (
              <button
                key={role.key}
                ref={(element) => {
                  tabRefs.current[roleIndex] = element;
                }}
                id={`routine-tab-${role.key}`}
                type="button"
                role="tab"
                aria-selected={activeRole === role.key}
                aria-controls={`routine-panel-${role.key}`}
                tabIndex={hasLoaded && activeRole === role.key ? 0 : -1}
                disabled={!hasLoaded}
                className={styles.roleTab}
                onClick={() => setActiveRole(role.key)}
                onKeyDown={(event) => handleRoleKeyDown(event, roleIndex)}
              >
                <strong>{role.label}</strong>
                <span>
                  {routine[role.key].length ? `${routine[role.key].length} linhas` : "Nulo"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {roles.map((role) => (
          <section
            key={role.key}
            id={`routine-panel-${role.key}`}
            role="tabpanel"
            aria-labelledby={`routine-tab-${role.key}`}
            aria-busy={!hasLoaded}
            tabIndex={0}
            hidden={activeRole !== role.key}
            className={styles.tablePanel}
          >
            {activeRole === role.key ? (
              <>
                <div className={styles.tableToolbar}>
                  <div>
                    <p className={styles.kicker}>Classificação da semana</p>
                    <h2 id="routine-table-title">{activeRoleInfo.label}</h2>
                    <p>
                      {activeSummary.filled
                        ? `${activeSummary.filled} ${activeSummary.filled === 1 ? "atividade" : "atividades"} em ${activeSummary.rows} ${activeSummary.rows === 1 ? "linha" : "linhas"} na semana.`
                        : "Nenhuma atividade cadastrada para esta função."}
                    </p>
                  </div>
                  <div className={styles.tableStats} aria-label="Ações da rotina">
                    <button
                      type="button"
                      className={styles.addButton}
                      disabled={!hasLoaded}
                      onClick={addRow}
                    >
                      <Plus size={17} aria-hidden="true" />
                      Inserir linha
                    </button>
                  </div>
                </div>

                {activeRows.length ? (
                  <div
                    className={styles.tableScroll}
                    role="region"
                    aria-label="Tabela de rotina semanal"
                    tabIndex={0}
                  >
                    <table ref={tableRef} className={styles.routineTable}>
                      <caption>
                        Rotina semanal editável para {activeRoleInfo.label.toLowerCase()}.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Linha</th>
                          {weekdays.map((weekday) => (
                            <th
                              key={weekday}
                              scope="col"
                              data-today={weekday.toLocaleLowerCase("pt-BR") === today || undefined}
                              aria-current={
                                weekday.toLocaleLowerCase("pt-BR") === today ? "date" : undefined
                              }
                            >
                              <span className={styles.dayHeading}>{weekday}</span>
                              {weekday.toLocaleLowerCase("pt-BR") === today ? (
                                <span className={styles.todayBadge}>Hoje</span>
                              ) : null}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeRows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <th scope="row">{rowIndex + 1}</th>
                            {weekdays.map((weekday) => (
                              <td
                                key={weekday}
                                data-label={weekday}
                                data-today={
                                  weekday.toLocaleLowerCase("pt-BR") === today || undefined
                                }
                              >
                                <textarea
                                  aria-label={`${weekday}, linha ${rowIndex + 1}`}
                                  disabled={!hasLoaded}
                                  value={row[weekday]}
                                  onChange={(event) =>
                                    updateCell(rowIndex, weekday, event.target.value)
                                  }
                                  rows={1}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <h3>{activeRoleInfo.label}</h3>
                    <p>Nenhuma atividade cadastrada.</p>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={!hasLoaded}
                      onClick={addRow}
                    >
                      <Plus size={17} aria-hidden="true" />
                      Inserir primeira linha
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </section>
        ))}
      </main>
    </div>
  );
}
