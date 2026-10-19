"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  GOAL_PROFILES,
  GOAL_RATE_FIELDS,
  GOAL_STAGES,
  getVisibleStageOffset,
  type GoalProfileKey,
} from "@/lib/crm/goals/catalog";
import type { FunnelGoals } from "@/lib/crm/goals/data";
import {
  buildGoalCalendar,
  distributeFunnelWeeks,
  projectGoalVolumes,
} from "@/lib/crm/goals/planning";
import { prepareFunnelGoalsDraftAction, saveFunnelGoalsAction } from "../actions";
import { ConfigurationDraftForm } from "./ConfigurationDraftForm";
import styles from "./GoalPlanning.module.css";

const colors = ["#173b68", "#155e75", "#0e7490", "#0891b2", "#0f766e", "#059669"];
const singular = ["Oportunidade", "Agendamento", "Visita", "Pasta", "Pasta aprovada", "Venda"];
const nextLabels = ["agendamento", "visita", "pasta", "pasta aprovada", "venda"];
const months = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, i, 1)),
  ),
);
const fmt = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
const decimal = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    value,
  );
const css = (values: Record<string, string | number>) => values as CSSProperties;
type GoalInputKey = Exclude<keyof FunnelGoals, "profileKey" | "effectiveMonth" | "updatedAt">;
function PanelHeader({
  number,
  kicker,
  title,
  children,
}: {
  number: string;
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header>
      <span>{number}</span>
      <div>
        <p>{kicker}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </header>
  );
}

export function GoalPlanning({
  profile,
  initialValues,
  canManageDraft,
  revision,
  today,
  notification,
}: {
  profile: GoalProfileKey;
  initialValues: FunnelGoals | null;
  canManageDraft: boolean;
  revision: number;
  today: string;
  notification?: "saved" | "validation" | "save" | undefined;
}) {
  const [values, setValues] = useState<Partial<Record<GoalInputKey, number | null>>>(() =>
    Object.fromEntries(
      Object.entries(initialValues ?? {}).filter(([, value]) => typeof value === "number"),
    ),
  );
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const offset = getVisibleStageOffset(profile);
  const unit = profile === "dv" ? "corretor" : "imobiliária";
  const units = profile === "dv" ? "corretores" : "imobiliárias";
  const volumes = projectGoalVolumes(
    values.sales ?? null,
    GOAL_RATE_FIELDS.map((field) => values[field.key] ?? null),
  );
  const calendar = buildGoalCalendar(year, month, today);
  const weekly = distributeFunnelWeeks(volumes.slice(offset), calendar.weeks, calendar.workdays);
  const weekColumns = calendar.weeks.map((_, index) => index);
  weekColumns.splice(
    Math.max(
      0,
      calendar.weeks.findIndex((week) => week.isCurrent),
    ),
    0,
    -1,
  );
  function input(key: GoalInputKey, label: string, max = 100000) {
    return (
      <input
        name={key}
        aria-label={label}
        type="number"
        min="0"
        max={max}
        step={GOAL_RATE_FIELDS.some((field) => field.key === key) ? "any" : "1"}
        required
        value={values[key] ?? ""}
        placeholder="—"
        onChange={(event) => {
          const number = event.target.value === "" ? null : event.target.valueAsNumber;
          setValues((previous) => ({
            ...previous,
            [key]: number != null && Number.isFinite(number) ? number : null,
          }));
        }}
      />
    );
  }
  function projection(stage: number) {
    let total = values.sales ?? null;
    for (let index = 4; index >= stage; index--) {
      const rate = values[GOAL_RATE_FIELDS[index]!.key];
      total = total == null || rate == null ? null : (total * rate) / 100;
    }
    return total == null || !Number.isFinite(total)
      ? null
      : Math.ceil((total * calendar.elapsedWorkdays) / calendar.workdays);
  }
  const body = (
    <>
      <input type="hidden" name="draftRevision" value={revision} />
      <div
        className={`goal-studio ${profile === "partnerships" ? "goal-studio-partnerships" : ""}`}
      >
        <section className="goal-panel goal-controls-panel">
          <PanelHeader number="01" kicker="Configuração" title="Volume necessário por etapa" />
          <p className="goal-panel-note">
            Informe quantas vezes uma etapa precisa ser maior que a etapa seguinte.
          </p>
          <div className="goal-rate-list">
            {GOAL_RATE_FIELDS.map((field, index) =>
              index < offset ? (
                <input key={field.key} type="hidden" name={field.key} value="0" />
              ) : (
                <label className="goal-rate-card" key={field.key}>
                  <span className="goal-rate-copy">
                    <strong>{singular[index]}</strong>
                    <small>Meta para gerar 1 {nextLabels[index]}</small>
                    <em>
                      {values[field.key] == null ? "—" : decimal(values[field.key]! / 100)} para 1
                    </em>
                  </span>
                  <span className="goal-rate-input">
                    {input(field.key, `Percentual de ${GOAL_STAGES[index]!.label}`, 10000)}
                    <b>%</b>
                  </span>
                </label>
              ),
            )}
          </div>
          <div className="goal-sales-target">
            <div>
              <strong>Meta de vendas</strong>
              <small>Total desejado no mês</small>
            </div>
            <label className="goal-sales-input">
              {input("sales", "Meta mensal de vendas", 10000000)}
              <span>vendas</span>
            </label>
          </div>
        </section>
        <section className="goal-panel goal-preview-panel">
          <PanelHeader number="02" kicker="Projeção calculada" title="Funil da meta" />
          <div
            className="goal-premium-funnel"
            style={{ gridTemplateRows: `repeat(${6 - offset},minmax(48px,1fr))` }}
          >
            {GOAL_STAGES.slice(offset).map((stage, index) => (
              <div
                className="goal-premium-step"
                key={stage.key}
                style={css({ "--stage-width": `${100 - index * 10}%` })}
              >
                <div
                  className="goal-premium-stage"
                  style={css({
                    "--stage-color": colors[index + offset]!,
                    "--stage-text": "#ffffff",
                  })}
                >
                  <span>{stage.label}</span>
                  <output>{fmt(volumes[index + offset])}</output>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="goal-panel goal-conversion-panel">
          <PanelHeader number="03" kicker="Análise" title="Conversões do funil">
            <small className="goal-weekly-context">Etapa a etapa</small>
          </PanelHeader>
          <p className="goal-panel-note">
            Compare o avanço para a próxima etapa e o resultado até a venda.
          </p>
          <div
            className="goal-conversion-table"
            role="table"
            aria-label="Conversões entre etapas e até vendas"
          >
            {GOAL_STAGES.slice(offset, -1).map((stage, index) => {
              const i = index + offset;
              const current = volumes[i] ?? null;
              return (
                <div className="goal-conversion-row" role="row" key={stage.key}>
                  <span className="goal-conversion-stage" role="rowheader">
                    <i style={{ background: colors[i] }} />
                    {singular[i]}
                  </span>
                  {[i + 1, 5].map((to, cell) => (
                    <span
                      className={`goal-conversion-cell ${cell ? "goal-conversion-sales" : ""}`}
                      role="cell"
                      key={cell}
                    >
                      <small>
                        {singular[i]} → {singular[to]}
                      </small>
                      <b>
                        {fmt(current)} → {fmt(volumes[to])}
                      </b>
                      <strong>
                        {current && volumes[to] != null
                          ? `${decimal((volumes[to]! / current) * 100)}%`
                          : "—"}
                      </strong>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
        <section className="goal-panel goal-weekly-panel">
          <PanelHeader number="04" kicker="Metas semanais" title="Acompanhamento por semana">
            <small className="goal-weekly-context">{6 - offset} etapas · metas acumuladas</small>
          </PanelHeader>
          <p className="goal-panel-note">
            Cada coluna mostra a meta acumulada até o fim da semana. O valor menor indica quanto
            produzir naquela semana.
          </p>
          <div
            className="goal-weekly-distribution"
            role="table"
            tabIndex={0}
            aria-label="Rota acumulada semanal das metas do funil"
            style={css({ "--week-count": calendar.weeks.length })}
          >
            <div className="goal-weekly-table-row goal-weekly-table-head" role="row">
              <span role="columnheader">Etapa</span>
              {weekColumns.map((column) =>
                column === -1 ? (
                  <span key="projection" className="goal-weekly-projection" role="columnheader">
                    Meta até hoje
                    <small>
                      {calendar.elapsedWorkdays} de {calendar.workdays} dias úteis
                    </small>
                    <em>Projeção</em>
                  </span>
                ) : (
                  (() => {
                    const week = calendar.weeks[column]!;
                    return (
                      <span
                        className={week.isCurrent ? "current" : ""}
                        role="columnheader"
                        key={week.start}
                      >
                        {week.isCurrent ? "Semana atual" : `${column + 1}ª semana`}
                        <small>
                          {week.start}–{week.end}
                        </small>
                        {week.isCurrent ? <em>Agora</em> : null}
                      </span>
                    );
                  })()
                ),
              )}
            </div>
            {GOAL_STAGES.slice(offset).map((stage, index) => {
              const i = index + offset;
              return (
                <div className="goal-weekly-table-row" role="row" key={stage.key}>
                  <span className="goal-weekly-stage" role="rowheader">
                    <i style={{ background: colors[i] }} />
                    {stage.label}
                    <small>{fmt(volumes[i])} no mês</small>
                  </span>
                  {weekColumns.map((w) =>
                    w === -1 ? (
                      <strong key="projection" className="goal-weekly-projection" role="cell">
                        <b>{fmt(projection(i))}</b>
                        <small>esperado até hoje</small>
                      </strong>
                    ) : (
                      (() => {
                        const week = calendar.weeks[w]!;
                        return (
                          <strong
                            className={week.isCurrent ? "current" : ""}
                            role="cell"
                            key={week.start}
                          >
                            <b>{fmt(weekly[index]?.[w]?.cumulative)}</b>
                            <small>+{fmt(weekly[index]?.[w]?.increment)} na semana</small>
                          </strong>
                        );
                      })()
                    ),
                  )}
                </div>
              );
            })}
          </div>
          <div className="goal-weekly-legend">
            <span>Valor principal = meta acumulada · +N = meta da semana</span>
            <strong>Cada etapa respeita o volume da etapa anterior</strong>
          </div>
        </section>
        <div className="goal-team-row">
          <section className="goal-panel goal-productivity-panel goal-brokers-panel">
            <PanelHeader
              number="05"
              kicker="Equipe de vendas"
              title={profile === "dv" ? "Corretores por gerente" : "Imobiliárias por coordenador"}
            />
            <p className="goal-panel-note">
              {profile === "dv"
                ? "Defina quantos corretores cada gerente deve manter ativos, conforme o tempo de casa."
                : "Defina quantas imobiliárias cada coordenador deve manter ativas, conforme o tempo de parceria."}
            </p>
            <div className="goal-productivity-block">
              <div className="goal-productivity-block-heading">
                <strong>Meta por tempo de {profile === "dv" ? "casa" : "parceria"}</strong>
                <small>
                  {units} por {profile === "dv" ? "gerente" : "coordenador"}
                </small>
              </div>
              <div className="goal-productivity-fields">
                {(
                  [
                    "brokerMinimumMonth1",
                    "brokerMinimumMonth2",
                    "brokerMinimumMonth3",
                    "brokerMinimumMonth4Plus",
                  ] as const
                ).map((key, index) => (
                  <label className="goal-productivity-field" key={key}>
                    <span>{index < 3 ? `${index + 1}º mês` : "4º mês ou mais"}</span>
                    {input(
                      key,
                      `Meta mínima de ${units} no ${index < 3 ? `${index + 1}º mês` : "4º mês ou mais"}`,
                    )}
                    <small>{units}</small>
                  </label>
                ))}
              </div>
            </div>
          </section>
          <section className="goal-panel goal-productivity-panel goal-broker-production-panel">
            <PanelHeader number="06" kicker="Ritmo semanal" title={`Produção por ${unit}`} />
            <p className="goal-panel-note">Defina a produção semanal esperada de cada {unit}.</p>
            <div className="goal-productivity-block">
              <div className="goal-productivity-block-heading">
                <strong>Produção por {unit}</strong>
                <small>meta semanal</small>
              </div>
              <div
                className={`goal-productivity-fields ${profile === "partnerships" ? "goal-productivity-fields-two" : "goal-productivity-fields-three"}`}
              >
                {(
                  ["brokerWeeklyAppointments", "brokerWeeklyVisits", "brokerWeeklyFolders"] as const
                ).map((key, index) =>
                  profile === "partnerships" && index === 0 ? (
                    <input key={key} type="hidden" name={key} value="0" />
                  ) : (
                    <label className="goal-productivity-field" key={key}>
                      <span>{["Agendamentos", "Visitas", "Pastas"][index]}</span>
                      {input(
                        key,
                        `${["Agendamentos", "Visitas", "Pastas"][index]} por ${unit} por semana`,
                      )}
                      <small>por semana</small>
                    </label>
                  ),
                )}
              </div>
            </div>
          </section>
        </div>
        <section className="goal-panel goal-calendar-panel">
          <PanelHeader number="07" kicker="Calendário do mês" title="Dias úteis estimados" />
          <div className="goal-calendar-layout">
            <div className="goal-calendar-card">
              <div className="goal-calendar-heading">
                <div>
                  <strong>
                    {months[month]} de {year}
                  </strong>
                  <small>Segunda a sexta · feriados não descontados</small>
                </div>
                <div className="goal-calendar-actions">
                  <span>{calendar.workdays} dias úteis</span>
                  <div className="goal-calendar-filters">
                    <label>
                      <span>Mês</span>
                      <select
                        aria-label="Selecionar mês"
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                      >
                        {months.map((name, i) => (
                          <option value={i} key={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Ano</span>
                      <select
                        aria-label="Selecionar ano"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      >
                        {Array.from(
                          { length: 11 },
                          (_, i) => Number(today.slice(0, 4)) - 5 + i,
                        ).map((y) => (
                          <option value={y} key={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
              <div className="goal-calendar-week">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="goal-calendar-grid">
                {Array.from({ length: calendar.leadingDays }, (_, i) => (
                  <i key={`empty-${i}`} aria-hidden="true" />
                ))}
                {calendar.days.map((day) => (
                  <span
                    key={day.day}
                    className={`${day.workday ? "business" : "weekend"} ${today === `${year}-${String(month + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}` ? "today" : ""}`}
                  >
                    {day.day}
                  </span>
                ))}
              </div>
            </div>
            <div className="goal-calendar-insights">
              <div>
                <small>Total de dias úteis</small>
                <strong>{calendar.workdays}</strong>
                <span>no mês selecionado</span>
              </div>
              <div>
                <small>Dias úteis passados</small>
                <strong>{calendar.elapsedWorkdays}</strong>
                <span>{calendar.workdays - calendar.elapsedWorkdays} restantes</span>
              </div>
              <div className="goal-calendar-rule">
                <small>{profile === "dv" ? "Ritmo por corretor" : "Ritmo de visitas"}</small>
                <strong>1 por dia útil</strong>
                <span>
                  {calendar.workdays} {profile === "dv" ? "agendamentos" : "visitas"} no mês
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="goal-panel goal-productive-panel">
          <PanelHeader number="08" kicker="Produtividade" title="Equipe que deve atingir a meta" />
          <p className="goal-panel-note">
            Defina a porcentagem mínima da equipe que deve atingir cada meta.
          </p>
          <div
            className={`goal-productive-grid ${profile === "partnerships" ? "goal-productive-grid-three" : ""}`}
          >
            {(
              [
                "productiveTeamAppointments",
                "productiveTeamVisits",
                "productiveTeamFolders",
                "productiveTeamSales",
              ] as const
            ).map((key, index) =>
              profile === "partnerships" && index === 0 ? (
                <input type="hidden" name={key} value="0" key={key} />
              ) : (
                <label
                  className="goal-productive-card"
                  key={key}
                  style={css({
                    "--productive-color": ["#20b9c3", "#f2c94c", "#42d995", "#4386ef"][index]!,
                  })}
                >
                  <span className="goal-productive-label">
                    {["Agendamentos", "Visitas", "Pastas", "Vendas"][index]}
                  </span>
                  <div
                    className="goal-donut"
                    style={css({
                      "--productive-rate": `${Math.max(0, Math.min(100, values[key] ?? 0))}%`,
                    })}
                  >
                    <div>
                      <strong>{fmt(values[key])}%</strong>
                      <span>da equipe</span>
                    </div>
                  </div>
                  <div className="goal-productive-target">
                    <small>Meta mínima</small>
                    <div className="goal-productive-input">
                      {input(
                        key,
                        `${["Agendamentos", "Visitas", "Pastas", "Vendas"][index]} da equipe produtiva`,
                        100,
                      )}
                      <b>%</b>
                    </div>
                  </div>
                </label>
              ),
            )}
          </div>
        </section>
      </div>
    </>
  );
  return (
    <div className={styles.planning}>
      <section className="goal-page-hero">
        <div className="goal-hero-copy">
          <p className="goal-kicker">Metas comerciais</p>
          <h1>Planejamento de metas</h1>
        </div>
        <div className="goal-command-center">
          <div className="goal-channel-switcher">
            <div className="goal-channel-label">
              <small>Plano comercial</small>
              <strong>Escolha o canal</strong>
            </div>
            <nav className="goal-profile-tabs" aria-label="Selecionar canal da meta">
              {Object.entries(GOAL_PROFILES).map(([key, item]) => (
                <Link
                  href={item.href}
                  prefetch={false}
                  key={key}
                  className={profile === key ? "active" : ""}
                  aria-current={profile === key ? "page" : undefined}
                >
                  <i aria-hidden="true" />
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </Link>
              ))}
              <Link href="/app/configuracoes/metas/pontos" prefetch={false}>
                <i aria-hidden="true" />
                <span>Meta por pontos</span>
                <small>Pontuação comercial</small>
              </Link>
            </nav>
          </div>
          <div className="goal-hero-actions">
            <div className="goal-save-state">
              <i aria-hidden="true" />
              <div>
                <small className="goal-updated-at">
                  {initialValues?.updatedAt
                    ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(initialValues.updatedAt))}`
                    : "Metas ainda não configuradas"}
                </small>
              </div>
            </div>
            {canManageDraft ? (
              profile === "dv" ? (
                <button
                  className="goal-save-button"
                  type="submit"
                  form="goal-configuration-form"
                  title="Salvar as alterações da meta"
                >
                  <span aria-hidden="true">✓</span>Salvar alterações
                </button>
              ) : (
                <a
                  className="goal-save-button"
                  href="#meta-review"
                  title="Revisar metas e salvar um rascunho inativo"
                >
                  <span aria-hidden="true">✓</span>Aplicar metas
                </a>
              )
            ) : null}
          </div>
        </div>
      </section>
      {notification ? (
        <p role="status">
          {notification === "saved"
            ? "Rascunho inativo salvo."
            : "Não foi possível concluir. Revise os campos e tente novamente."}
        </p>
      ) : null}
      {!initialValues ? (
        <p role="status">
          Metas ainda não configuradas. Preencha os campos para planejar; nenhum valor demonstrativo
          foi aplicado.
        </p>
      ) : null}
      {profile === "dv" && canManageDraft ? (
        <form
          id="goal-configuration-form"
          action={saveFunnelGoalsAction.bind(null, profile)}
          className="grid gap-3"
        >
          {body}
        </form>
      ) : (
        <ConfigurationDraftForm
          action={prepareFunnelGoalsDraftAction.bind(null, profile)}
          enabled={canManageDraft}
          saveLabel="Salvar rascunho de metas"
          reviewId="meta-review"
        >
          {body}
        </ConfigurationDraftForm>
      )}
    </div>
  );
}
