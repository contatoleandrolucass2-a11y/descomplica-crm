"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Plus, RotateCcw, Save, Sparkles } from "lucide-react";

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

const roles: Array<{ key: RoleKey; label: string; description: string }> = [
  {
    key: "regional-house",
    label: "Gerente regional house",
    description: "Rotina classificada para acompanhamento semanal.",
  },
  {
    key: "regional-imob",
    label: "Gerente regional imob",
    description: "Aguardando classificação.",
  },
  {
    key: "gerente-house",
    label: "Gerente house",
    description: "Aguardando classificação.",
  },
  {
    key: "coordenador-vendas",
    label: "Coordenador de vendas",
    description: "Aguardando classificação.",
  },
  {
    key: "coordenador-parcerias",
    label: "Coordenador de parcerias",
    description: "Aguardando classificação.",
  },
  {
    key: "corretor",
    label: "Corretor",
    description: "Aguardando classificação.",
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
    "Segunda-feira": "Verificar se existem leads parados.",
    "Terça-feira": "Verificar se existem leads parados.",
    "Quarta-feira": "Verificar se existem leads parados.",
    "Quinta-feira": "Verificar se existem leads parados.",
    "Sexta-feira": "Verificar se existem leads parados.",
    Sábado: "Olhar o número de visitas nesse dia.",
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
    "Segunda-feira": "Analisar o Volta ao Caixa de marketing e comparar com o tamanho do time.",
    "Terça-feira": "Verificar repasse e prazos.",
    "Quarta-feira": "Analisar o planejamento da ação externa e acompanhar o resultado final.",
    "Quinta-feira": "Preparar a base para a geração do ofertão.",
    "Sexta-feira": "Analisar o Volta ao Caixa de marketing e comparar com o tamanho do time.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar a quantidade de leads do dia em relação ao tamanho do time.",
    "Terça-feira": "Analisar o planejamento da ação externa e acompanhar o resultado final.",
    "Quarta-feira": "Analisar o funil de vendas e conferir se cada conversão está dentro da média.",
    "Quinta-feira":
      "Cobrar retorno dos agendamentos da semana passada que não compareceram e direcionar para o final de semana.",
    "Sexta-feira": "Analisar o funil de vendas e conferir se cada conversão está dentro da média.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar a projeção de crescimento.",
    "Terça-feira": "Treinamento de processos.",
    "Quarta-feira": "",
    "Quinta-feira":
      "Conferir agendamentos com o gerente. Cada corretor deve buscar no mínimo dois agendamentos no dia.",
    "Sexta-feira": "Treinamento Acelera.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Programa retenção. Analisar a frequência da semana anterior e ajustar a roleta semanal.",
    "Terça-feira": "Medir equipe sem Creci e criar plano de ação.",
    "Quarta-feira": "Acompanhar prazos de atendimento e cobrar atualização no sistema.",
    "Quinta-feira":
      "Comparar a conversão de agendamentos para visitas e orientar melhorias na qualidade dos agendamentos.",
    "Sexta-feira": "Acompanhar prazos de atendimento e cobrar atualização no sistema.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Leads do gerente. Analisar a frequência da semana anterior e ajustar a roleta semanal.",
    "Terça-feira":
      "Olhar contratos gerados, assinatura do cliente, pagamento do sinal e possíveis falhas no comissionamento.",
    "Quarta-feira":
      "Olhar o painel de oportunidades e montar plano de ação para clientes que não evoluíram para venda.",
    "Quinta-feira":
      "Observar vestimenta, comportamento e rotina dos corretores. Acompanhar ligações e mensagens para orientar ajustes.",
    "Sexta-feira":
      "Olhar fichas aprovadas sem reversão para venda e buscar soluções para converter o cliente.",
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
      "Olhar fichas reprovadas com a CCA e o corretor para buscar reversão do processo.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar percentual de leads perdidos em aguardando atendimento e em atendimento.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "Olhar fichas em rascunho. Processo em rascunho precisa de ação imediata.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar números previstos para o final de semana contra o realizado.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "Olhar vendas futuras e facilitadas e buscar antecipar o repasse do cliente.",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Verificar evidências do plano de ação em agendamento, visita, pasta e venda. Analisar evolução.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar número de agendamentos. Comparar semana anterior, mês vigente e indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar número de visitas. Comparar semana anterior, mês vigente e indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar número de pastas. Comparar semana anterior, mês vigente e indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Analisar número de vendas. Comparar semana anterior, mês vigente e indicador do dia.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar planejado contra realizado e criar plano de ação da semana vigente.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Acompanhar tamanho da equipe, tempo de casa, produtividade, agendamentos, visitas, pastas e vendas.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira": "Analisar turnover de cada equipe e ajustar rota para reduzir ao máximo.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Cobrar descredenciamento de corretores com mais de 30 dias sem agendamento ou visita.",
    "Terça-feira": "",
    "Quarta-feira": "",
    "Quinta-feira": "",
    "Sexta-feira": "",
    Sábado: "",
    Domingo: "",
  },
  {
    "Segunda-feira":
      "Ajustar escala de folga dos gerentes e acompanhar escala dos corretores para prever o time no plantão.",
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
    "Segunda-feira": "Postar conteúdo no Store, redes sociais e status.",
    "Terça-feira": "Postar conteúdo no Store, redes sociais e status.",
    "Quarta-feira": "Postar conteúdo no Store, redes sociais e status.",
    "Quinta-feira":
      "Preencher e analisar resultado. Ajustar rota quando os números não forem satisfatórios.",
    "Sexta-feira": "Postar conteúdo no Store, redes sociais e status.",
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

export function RoutineSettings() {
  const [activeRole, setActiveRole] = useState<RoleKey>("regional-house");
  const [routine, setRoutine] = useState<RoutineState>(defaultRoutine);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const loadStoredRoutine = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setRoutine(normalizeStoredRoutine(JSON.parse(stored)));
        } catch {
          setRoutine(defaultRoutine);
        }
      }
      setHasLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadStoredRoutine);
  }, []);

  const activeRows = routine[activeRole];
  const activeRoleInfo = roles.find((role) => role.key === activeRole) ?? roles[0]!;
  const activeSummary = useMemo(
    () => ({
      rows: activeRows.length,
      filled: countFilledCells(activeRows),
    }),
    [activeRows],
  );

  function updateCell(rowIndex: number, weekday: Weekday, value: string) {
    setRoutine((current) => ({
      ...current,
      [activeRole]: current[activeRole].map((row, index) =>
        index === rowIndex ? { ...row, [weekday]: value } : row,
      ),
    }));
  }

  function addRow() {
    setRoutine((current) => ({
      ...current,
      [activeRole]: [...current[activeRole], emptyRow()],
    }));
  }

  function resetActiveRole() {
    setRoutine((current) => ({
      ...current,
      [activeRole]: defaultRoutine[activeRole],
    }));
    setSavedAt(null);
  }

  function saveRoutine() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routine));
    setSavedAt(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
    );
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
                onClick={resetActiveRole}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button type="button" className={styles.primaryAction} onClick={saveRoutine}>
                <Save size={17} aria-hidden="true" />
                Salvar alterações
              </button>
            </div>
          }
        />

        <section className={styles.hero} aria-labelledby="routine-overview-title">
          <div className={styles.heroCopy}>
            <span className={styles.iconFrame}>
              <CalendarCheck2 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.kicker}>Rotina comercial</p>
              <h2 id="routine-overview-title">Gerente regional house</h2>
              <p>
                Conteúdo inicial revisado a partir da planilha de referência. As demais funções
                ficam sem classificação até receberem rotina própria.
              </p>
            </div>
          </div>
          <div className={styles.saveState} role="status" aria-live="polite">
            <Sparkles size={18} aria-hidden="true" />
            <span>
              {savedAt
                ? `Último salvamento local em ${savedAt}.`
                : hasLoaded
                  ? "Ajuste a rotina e salve quando terminar."
                  : "Carregando rotina."}
            </span>
          </div>
        </section>

        <section className={styles.rolesPanel} aria-labelledby="routine-options-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Opções</p>
              <h2 id="routine-options-title">Escolha a função</h2>
            </div>
            <span>{roles.length} funções</span>
          </div>
          <div className={styles.roleTabs} role="tablist" aria-label="Opções de rotina">
            {roles.map((role) => (
              <button
                key={role.key}
                type="button"
                role="tab"
                aria-selected={activeRole === role.key}
                className={styles.roleTab}
                onClick={() => setActiveRole(role.key)}
              >
                <strong>{role.label}</strong>
                <span>
                  {routine[role.key].length ? `${routine[role.key].length} linhas` : "Nulo"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.tablePanel} aria-labelledby="routine-table-title">
          <div className={styles.tableToolbar}>
            <div>
              <p className={styles.kicker}>{activeRoleInfo.label}</p>
              <h2 id="routine-table-title">Classificação da semana</h2>
              <p>{activeRoleInfo.description}</p>
            </div>
            <div className={styles.tableStats} aria-label="Resumo da rotina ativa">
              <span>{activeSummary.rows} linhas</span>
              <span>{activeSummary.filled} atividades</span>
              <button type="button" className={styles.addButton} onClick={addRow}>
                <Plus size={17} aria-hidden="true" />
                Inserir linha
              </button>
            </div>
          </div>

          {activeRows.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.routineTable}>
                <caption>
                  Rotina semanal editável para {activeRoleInfo.label.toLowerCase()}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Linha</th>
                    {weekdays.map((weekday) => (
                      <th key={weekday} scope="col">
                        {weekday}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <th scope="row">{rowIndex + 1}</th>
                      {weekdays.map((weekday) => (
                        <td key={weekday} data-label={weekday}>
                          <textarea
                            aria-label={`${weekday}, linha ${rowIndex + 1}`}
                            value={row[weekday]}
                            onChange={(event) => updateCell(rowIndex, weekday, event.target.value)}
                            placeholder="Adicionar atividade"
                            rows={3}
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
              <p>
                Rotina nula por enquanto. Insira uma linha quando quiser iniciar a classificação.
              </p>
              <button type="button" className={styles.primaryAction} onClick={addRow}>
                <Plus size={17} aria-hidden="true" />
                Inserir primeira linha
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
