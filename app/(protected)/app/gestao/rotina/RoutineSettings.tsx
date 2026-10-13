"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ListChecks, Plus, Save } from "lucide-react";
import { routineRecordSchema, routineRowsSchema, routineSnapshotSchema } from "@/lib/crm/routines";

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
// Keep the stored seven-day schema compatible; Sunday is no longer displayed.
const scheduleDays = weekdays.filter((day) => day !== "Domingo");
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

function normalizeStoredRoutine(value: unknown): Partial<RoutineState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Partial<Record<RoleKey, unknown>>;
  return roles.reduce((state, role) => {
    if (!Object.prototype.hasOwnProperty.call(source, role.key)) return state;
    const rows = routineRowsSchema.safeParse(source[role.key]);
    if (rows.success) state[role.key] = rows.data;
    return state;
  }, {} as Partial<RoutineState>);
}

function fitRoutineFields(table: HTMLTableElement | null) {
  if (!table) return;
  const fields = Array.from(table.querySelectorAll("textarea"));
  // Measure outside the flow: collapsing live fields clamps the page scroll on refresh.
  const measurements = fields.map((field) => {
    const style = getComputedStyle(field);
    const probe = field.cloneNode() as HTMLTextAreaElement;
    probe.removeAttribute("id");
    probe.removeAttribute("name");
    probe.removeAttribute("aria-label");
    probe.removeAttribute("data-row");
    probe.setAttribute("aria-hidden", "true");
    probe.tabIndex = -1;
    probe.value = field.value;
    Object.assign(probe.style, {
      position: "absolute",
      top: "0px",
      left: "0px",
      visibility: "hidden",
      pointerEvents: "none",
      width: style.width,
      height: "0px",
      minHeight: "0px",
    });
    return {
      probe,
      borders: parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth),
    };
  });
  measurements.forEach(({ probe }, index) => fields[index]!.after(probe));
  const heights = measurements.map(({ probe, borders }) =>
    Math.max(32, probe.scrollHeight + borders),
  );
  measurements.forEach(({ probe }) => {
    probe.remove();
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

class RoutineSaveError extends Error {}

export function RoutineSettings() {
  const [activeRole, setActiveRole] = useState<RoleKey>("regional-house");
  const [routine, setRoutine] = useState<RoutineState>(defaultRoutine);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [legacy, setLegacy] = useState<Partial<RoutineState> | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const revisions = useRef<Partial<Record<RoleKey, number>>>({});
  const dirtyRoles = useRef(new Set<RoleKey>());
  const saving = useRef(false);
  const changeVersion = useRef(0);
  const [today, setToday] = useState<string | null>(null);
  const [view, setView] = useState<"week" | "day">("week");
  const [editedCells, setEditedCells] = useState<Set<string>>(() => new Set());
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingRow = useRef<number | null>(null);

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
    let disposed = false;
    let loading = false;
    const controller = new AbortController();
    async function loadSharedRoutine() {
      if (loading || dirtyRoles.current.size || saving.current) return;
      loading = true;
      const startedVersion = changeVersion.current;
      try {
        const response = await fetch("/api/routines", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        });
        if (!response.ok) throw new Error("unavailable");
        const snapshot = routineSnapshotSchema.parse(await response.json());
        if (
          disposed ||
          dirtyRoles.current.size ||
          saving.current ||
          startedVersion !== changeVersion.current
        )
          return;
        const next = { ...defaultRoutine };
        const nextRevisions: Partial<Record<RoleKey, number>> = {};
        for (const record of snapshot.routines) {
          next[record.role_key] = record.rows;
          nextRevisions[record.role_key] = record.revision;
        }
        revisions.current = nextRevisions;
        setRoutine(next);
        setCanEdit(snapshot.can_edit);
        setHasLoaded(true);
        setConflict(false);
        setStorageError(null);
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          setLegacy(stored ? normalizeStoredRoutine(JSON.parse(stored)) : null);
        } catch {
          // Shared data remains authoritative even if local storage is unavailable.
          setLegacy(null);
        }
      } catch {
        if (!disposed && startedVersion === changeVersion.current) {
          setHasLoaded(false);
          setStorageError("Não foi possível carregar a rotina do CRM. Tente novamente.");
        }
      } finally {
        loading = false;
      }
    }
    void loadSharedRoutine();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadSharedRoutine();
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadAttempt]);

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
  const currentDay = scheduleDays.find((day) => day.toLocaleLowerCase("pt-BR") === today);
  const visibleDays = view === "week" ? scheduleDays : currentDay ? [currentDay] : [];
  const visibleRows = activeRows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row, index }) =>
        view === "week" ||
        (currentDay &&
          (row[currentDay].trim() ||
            weekdays.every((day) => !row[day].trim()) ||
            editedCells.has(`${activeRole}:${currentDay}:${index}`))),
    );
  useEffect(() => {
    fitRoutineFields(tableRef.current);
    if (pendingRow.current !== null) {
      tableRef.current
        ?.querySelector<HTMLTextAreaElement>(`textarea[data-row="${pendingRow.current}"]`)
        ?.focus();
      pendingRow.current = null;
    }
  }, [activeRows, view, today]);

  useEffect(() => {
    const table = tableRef.current;
    const heading = table?.tHead;
    if (!table || !heading) return;
    const navigation = document.querySelector<HTMLElement>("[data-protected-topbar]");
    const viewport = window.visualViewport;
    let frame = 0;
    let previousOffset = -1;

    // Same page-scroll header pattern as Tabelao: preserve the real table headers.
    const updateHeading = () => {
      frame = 0;
      const tableRect = table.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const top = Math.max(
        viewport?.offsetTop ?? 0,
        navigation?.getBoundingClientRect().bottom ?? 0,
      );
      const offset = Math.max(
        0,
        Math.min(top - headingRect.top, tableRect.bottom - headingRect.bottom),
      );
      if (offset !== previousOffset) {
        table.style.setProperty("--routine-heading-offset", `${offset}px`);
        previousOffset = offset;
      }
    };
    const scheduleHeading = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeading);
    };
    const observer = new ResizeObserver(scheduleHeading);
    observer.observe(table);
    observer.observe(heading);
    if (navigation) observer.observe(navigation);
    window.addEventListener("scroll", scheduleHeading, { capture: true, passive: true });
    window.addEventListener("resize", scheduleHeading);
    viewport?.addEventListener("resize", scheduleHeading);
    viewport?.addEventListener("scroll", scheduleHeading);
    scheduleHeading();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleHeading, true);
      window.removeEventListener("resize", scheduleHeading);
      viewport?.removeEventListener("resize", scheduleHeading);
      viewport?.removeEventListener("scroll", scheduleHeading);
      table.style.removeProperty("--routine-heading-offset");
    };
  }, [activeRole, view, currentDay, visibleRows.length]);

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
  }, [activeRole, activeRows.length, view, currentDay]);

  function updateCell(rowIndex: number, weekday: Weekday, value: string) {
    if (!hasLoaded || !canEdit || saving.current) return;
    changeVersion.current += 1;
    dirtyRoles.current.add(activeRole);
    setEditedCells((current) => new Set(current).add(`${activeRole}:${weekday}:${rowIndex}`));
    setRoutine((current) => ({
      ...current,
      [activeRole]: current[activeRole].map((row, index) =>
        index === rowIndex ? { ...row, [weekday]: value } : row,
      ),
    }));
    setHasUnsavedChanges(true);
  }

  function addRow() {
    if (!hasLoaded || !canEdit || saving.current) return;
    if (activeRows.length >= 200) {
      setStorageError("Limite de 200 linhas por função atingido.");
      return;
    }
    dirtyRoles.current.add(activeRole);
    changeVersion.current += 1;
    pendingRow.current = activeRows.length;
    setRoutine((current) => ({
      ...current,
      [activeRole]: [...current[activeRole], emptyRow()],
    }));
    setHasUnsavedChanges(true);
  }

  function changeView(nextView: "week" | "day") {
    setView(nextView);
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }

  async function saveRoutine() {
    if (!hasLoaded || !canEdit || saving.current || conflict) return;
    saving.current = true;
    changeVersion.current += 1;
    setIsSaving(true);
    setStorageError(null);
    // Each role has its own revision; a failure never discards the remaining draft.
    const targets = dirtyRoles.current.size ? [...dirtyRoles.current] : [activeRole];
    try {
      for (const role of targets) {
        dirtyRoles.current.add(role);
        if (!routineRowsSchema.safeParse(routine[role]).success) {
          throw new RoutineSaveError("Use até 200 linhas por função e 4.000 caracteres por campo.");
        }
        const response = await fetch("/api/routines", {
          method: "PUT",
          signal: AbortSignal.timeout(20_000),
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            role_key: role,
            rows: routine[role],
            expected_revision: revisions.current[role] ?? 0,
          }),
        });
        if (response.status === 409) {
          setConflict(true);
          throw new RoutineSaveError(
            "Outra pessoa alterou esta rotina. Suas alterações continuam nesta tela. Recarregue a versão do CRM antes de editar novamente.",
          );
        }
        if (!response.ok)
          throw new RoutineSaveError(
            "Não foi possível salvar no CRM. Suas alterações continuam nesta tela.",
          );
        const saved = routineRecordSchema.safeParse(await response.json());
        if (
          !saved.success ||
          saved.data.role_key !== role ||
          saved.data.revision !== (revisions.current[role] ?? 0) + 1
        )
          throw new RoutineSaveError("Não foi possível confirmar o salvamento no CRM.");
        revisions.current[role] = saved.data.revision;
        dirtyRoles.current.delete(role);
      }
      setSavedAt(
        new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
      );
    } catch (error) {
      setSavedAt(null);
      setStorageError(
        error instanceof RoutineSaveError
          ? error.message
          : "Não foi possível salvar no CRM. Suas alterações continuam nesta tela.",
      );
    } finally {
      setHasUnsavedChanges(dirtyRoles.current.size > 0);
      saving.current = false;
      setIsSaving(false);
    }
  }

  function reloadSharedRoutine() {
    if (saving.current) return;
    if (
      dirtyRoles.current.size &&
      !window.confirm("Descartar as alterações desta tela e carregar a versão salva no CRM?")
    )
      return;
    dirtyRoles.current.clear();
    changeVersion.current += 1;
    setHasUnsavedChanges(false);
    setEditedCells(new Set());
    setHasLoaded(false);
    setLoadAttempt((value) => value + 1);
  }

  function importLocalRoutine() {
    const localRows = legacy?.[activeRole];
    if (!localRows || !canEdit || !hasLoaded || saving.current) return;
    if (!routineRowsSchema.safeParse(localRows).success) {
      setStorageError(
        "A cópia local excede os limites da rotina. Revise o conteúdo antes de importar.",
      );
      return;
    }
    if (
      !window.confirm(
        "Usar a cópia deste navegador nesta função? A versão compartilhada só será alterada ao salvar no CRM.",
      )
    )
      return;
    dirtyRoles.current.add(activeRole);
    changeVersion.current += 1;
    setRoutine((current) => ({ ...current, [activeRole]: localRows }));
    setHasUnsavedChanges(true);
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
        <header className={styles.pageHeader}>
          <h1>Rotina semanal e diária</h1>
          <div className={styles.headerActions}>
            <div className={styles.actionRow} aria-label="Ações da rotina">
              <div className={styles.viewToggle} role="group" aria-label="Visualização da rotina">
                <button
                  type="button"
                  aria-pressed={view === "week"}
                  onClick={() => changeView("week")}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                  Semana
                </button>
                <button
                  type="button"
                  aria-pressed={view === "day"}
                  onClick={() => changeView("day")}
                >
                  <ListChecks size={16} aria-hidden="true" />
                  Hoje
                </button>
              </div>
              <button
                type="button"
                className={styles.addButton}
                disabled={!hasLoaded || !canEdit || isSaving || (view === "day" && !currentDay)}
                hidden={hasLoaded && !canEdit}
                onClick={addRow}
              >
                <Plus size={17} aria-hidden="true" />
                Inserir linha
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                disabled={!hasLoaded || !canEdit || isSaving || conflict}
                hidden={hasLoaded && !canEdit}
                onClick={saveRoutine}
              >
                <Save size={17} aria-hidden="true" />
                {isSaving ? "Salvando..." : "Salva alterações"}
              </button>
            </div>
            <span className={styles.saveState} role="status" aria-live="polite">
              {!hasLoaded
                ? "Carregando rotina."
                : hasUnsavedChanges
                  ? "Alterações não salvas."
                  : savedAt
                    ? `Salvo no CRM em ${savedAt}.`
                    : ""}
            </span>
          </div>
        </header>

        {storageError ? (
          <div className={styles.storageError} role="alert">
            <p>{storageError}</p>
            {(!hasLoaded || conflict) && (
              <button className={styles.addButton} type="button" onClick={reloadSharedRoutine}>
                Recarregar do CRM
              </button>
            )}
          </div>
        ) : null}

        {hasLoaded && !canEdit ? <p className={styles.syncNotice}>Somente visualização</p> : null}
        {hasLoaded &&
        canEdit &&
        legacy?.[activeRole] &&
        JSON.stringify(legacy[activeRole]) !== JSON.stringify(routine[activeRole]) ? (
          <div className={styles.syncNotice}>
            <span>Cópia diferente salva neste navegador.</span>
            <button
              className={styles.addButton}
              type="button"
              disabled={isSaving}
              onClick={importLocalRoutine}
            >
              Importar cópia local desta função
            </button>
          </div>
        ) : null}

        <section className={styles.rolesPanel} aria-label="Funções">
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
              <div
                ref={scrollRef}
                className={styles.tableScroll}
                role="region"
                aria-label={
                  view === "week" ? "Tabela de rotina semanal" : "Tabela de rotina do dia"
                }
                tabIndex={0}
              >
                {visibleRows.length && visibleDays.length ? (
                  <table ref={tableRef} className={styles.routineTable} data-view={view}>
                    <caption>
                      Rotina {view === "week" ? "semanal" : "do dia"}{" "}
                      {canEdit ? "editável" : "compartilhada"} para{" "}
                      {activeRoleInfo.label.toLowerCase()}.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className={styles.srOnly}>Linha</span>
                        </th>
                        {visibleDays.map((weekday) => (
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
                      {visibleRows.map(({ row, index: rowIndex }) => (
                        <tr key={rowIndex}>
                          <th scope="row">{rowIndex + 1}</th>
                          {visibleDays.map((weekday) => (
                            <td
                              key={weekday}
                              data-label={weekday}
                              data-today={weekday.toLocaleLowerCase("pt-BR") === today || undefined}
                            >
                              <textarea
                                data-row={rowIndex}
                                aria-label={`${weekday}, linha ${rowIndex + 1}`}
                                disabled={!hasLoaded}
                                readOnly={!canEdit || isSaving}
                                maxLength={4000}
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
                ) : (
                  <div className={styles.emptyState}>
                    <p>
                      {view === "day" && !currentDay
                        ? today
                          ? "Sem rotina aos domingos."
                          : "Carregando rotina."
                        : "Nenhuma atividade cadastrada."}
                    </p>
                    {canEdit && (view === "week" || currentDay) ? (
                      <button
                        type="button"
                        className={styles.primaryAction}
                        disabled={!hasLoaded || isSaving}
                        onClick={addRow}
                      >
                        <Plus size={17} aria-hidden="true" />
                        Inserir primeira linha
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        ))}
        <footer className={styles.footer}>
          <span className={styles.footerCredit}>Desenvolvido e gerenciado por Leandro Lucas</span>
        </footer>
      </main>
    </div>
  );
}
