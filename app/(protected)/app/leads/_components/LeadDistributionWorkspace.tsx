import {
  CheckCircle2,
  CircleHelp,
  ListChecks,
  Network,
  Plus,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import { LeadStatePanel, leadStyles, type LeadSourceState } from "./LeadWorkspace";

type LeadMutation = (formData: FormData) => void | Promise<void>;

export type DistributionView = "queues" | "rules" | "members" | "checkin" | "explanation";

export type DistributionRule = {
  id: string;
  order: number;
  fieldLabel: string;
  operatorLabel: string;
  valueLabel: string;
};

export type DistributionMember = {
  id: string;
  name: string;
  weight: number;
  position: number;
  presenceLabel: string;
  active: boolean;
};

export type DistributionQueue = {
  id: string;
  name: string;
  active: boolean;
  priority: number | null;
  revision: number;
  strategyLabel: string;
  fallbackLabel: string | null;
  rules: readonly DistributionRule[];
  members: readonly DistributionMember[];
};

export type DistributionExplanation = {
  id: string;
  leadLabel: string;
  queueLabel: string;
  responsibleLabel: string | null;
  reason: string;
  occurredAtLabel: string;
};

const VIEWS: ReadonlyArray<{ key: DistributionView; label: string; icon: typeof Network }> = [
  { key: "queues", label: "Filas", icon: Network },
  { key: "rules", label: "Regras", icon: ListChecks },
  { key: "members", label: "Membros", icon: UsersRound },
  { key: "checkin", label: "Check-in", icon: CheckCircle2 },
  { key: "explanation", label: "Explicação", icon: CircleHelp },
];

export function LeadDistributionWorkspace({
  state,
  view,
  queues,
  explanations,
  scopeId,
  canManage,
  canAssign,
  saveQueueAction,
  saveRulesAction,
  saveMembersAction,
  checkInAction,
  assignAction,
  documentJson,
  saveDistributionAction,
}: {
  state: LeadSourceState;
  view: DistributionView;
  queues: readonly DistributionQueue[];
  explanations: readonly DistributionExplanation[];
  scopeId?: string | undefined;
  canManage: boolean;
  canAssign: boolean;
  saveQueueAction?: LeadMutation | undefined;
  saveRulesAction?: LeadMutation | undefined;
  saveMembersAction?: LeadMutation | undefined;
  checkInAction?: LeadMutation | undefined;
  assignAction?: LeadMutation | undefined;
  documentJson?: string | undefined;
  saveDistributionAction?: LeadMutation | undefined;
}) {
  const activeQueue = queues[0] ?? null;
  return (
    <div className={leadStyles.workspace}>
      <nav className={leadStyles.tabs} aria-label="Áreas da distribuição">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            className={leadStyles.tab}
            href={`/app/leads/distribuicao?visao=${key}${scopeId ? `&scope=${encodeURIComponent(scopeId)}` : ""}`}
            aria-current={view === key ? "page" : undefined}
            prefetch={false}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {documentJson ? (
        <details className={managementStyles.disclosure}>
          <summary className={`${managementStyles.button} w-full justify-between`}>
            <span>Editor completo da distribuição</span>
            <span className={leadStyles.meta}>Validação estrutural no servidor</span>
          </summary>
          <form
            {...(saveDistributionAction ? { action: saveDistributionAction } : {})}
            className={managementStyles.actionPanel}
          >
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <input type="hidden" name="expectedRevision" value={activeQueue?.revision ?? 0} />
            <label className={leadStyles.field}>
              Documento de filas e regras
              <textarea
                className={leadStyles.textarea}
                name="document"
                defaultValue={documentJson}
                required
                disabled={!saveDistributionAction}
              />
            </label>
            <label className={leadStyles.field}>
              Motivo da alteração
              <textarea
                className={leadStyles.textarea}
                name="reason"
                required
                minLength={8}
                maxLength={500}
                disabled={!saveDistributionAction}
              />
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!saveDistributionAction}
            >
              Validar e salvar documento
            </button>
          </form>
        </details>
      ) : null}

      {!canManage && (view === "queues" || view === "rules" || view === "members") ? (
        <section
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.permissionPanel}`}
          role="status"
        >
          <strong className="text-sm text-[var(--analytics-ink)]">
            Acesso somente para consulta
          </strong>
          <p className={leadStyles.panelDescription}>
            Seu perfil pode acompanhar a distribuição, mas não alterar filas, regras ou membros.
          </p>
        </section>
      ) : null}

      {state === "ready" || state === "empty" ? (
        view === "queues" ? (
          <QueueView
            queues={queues}
            scopeId={scopeId}
            action={canManage ? saveQueueAction : undefined}
          />
        ) : view === "rules" ? (
          <RulesView queue={activeQueue} action={canManage ? saveRulesAction : undefined} />
        ) : view === "members" ? (
          <MembersView queue={activeQueue} action={canManage ? saveMembersAction : undefined} />
        ) : view === "checkin" ? (
          <CheckInView queue={activeQueue} action={checkInAction} scopeId={scopeId} />
        ) : (
          <ExplanationView
            explanations={explanations}
            canAssign={canAssign}
            assignAction={assignAction}
            scopeId={scopeId}
          />
        )
      ) : (
        <LeadStatePanel
          state={state === "error" ? "error" : "not_configured"}
          icon={Network}
          title={
            state === "error"
              ? "Distribuição temporariamente indisponível"
              : state === "scope_required"
                ? "Selecione um escopo"
                : "Distribuição ainda não configurada"
          }
          description={
            state === "error"
              ? "A consulta falhou; nenhuma regra anterior foi apresentada como atual."
              : "Filas, regras e membros aparecerão quando a operação autorizada estiver disponível."
          }
        />
      )}
    </div>
  );
}

function QueueView({
  queues,
  scopeId,
  action,
}: {
  queues: readonly DistributionQueue[];
  scopeId?: string | undefined;
  action?: LeadMutation | undefined;
}) {
  return (
    <section className={leadStyles.stack} aria-labelledby="distribution-queues-title">
      <div className={managementStyles.sectionHeader}>
        <div>
          <h2 id="distribution-queues-title" className={managementStyles.sectionTitle}>
            Filas de distribuição
          </h2>
          <p className={managementStyles.sectionDescription}>
            Prioridade, estratégia e fallback ficam visíveis sem expor dados de clientes.
          </p>
        </div>
        <details className={managementStyles.disclosure}>
          <summary className={managementStyles.buttonPrimary}>
            <Plus size={16} aria-hidden="true" />
            Nova fila
          </summary>
          <QueueForm action={action} scopeId={scopeId} />
        </details>
      </div>
      {queues.length > 0 ? (
        <div className={leadStyles.threeColumn}>
          {queues.map((queue) => (
            <article
              key={queue.id}
              className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className={leadStyles.panelTitle}>{queue.name}</h3>
                <span className={leadStyles.pill}>{queue.active ? "Ativa" : "Inativa"}</span>
              </div>
              <dl className={`${leadStyles.detailGrid} mt-3`}>
                <div className={leadStyles.detailItem}>
                  <dt>Prioridade</dt>
                  <dd>{queue.priority ?? "Não informada"}</dd>
                </div>
                <div className={leadStyles.detailItem}>
                  <dt>Revisão</dt>
                  <dd>{queue.revision}</dd>
                </div>
                <div className={leadStyles.detailItem}>
                  <dt>Estratégia</dt>
                  <dd>{queue.strategyLabel}</dd>
                </div>
                <div className={leadStyles.detailItem}>
                  <dt>Fallback</dt>
                  <dd>{queue.fallbackLabel ?? "Não configurado"}</dd>
                </div>
              </dl>
              <details className={`${managementStyles.disclosure} mt-3`}>
                <summary className={`${managementStyles.button} w-full`}>Editar fila</summary>
                <QueueForm action={action} scopeId={scopeId} queue={queue} />
              </details>
            </article>
          ))}
        </div>
      ) : (
        <LeadStatePanel
          state="empty"
          title="Nenhuma fila configurada"
          description="Crie a primeira fila quando seu perfil tiver permissão de gestão."
        />
      )}
    </section>
  );
}

function QueueForm({
  action,
  scopeId,
  queue,
}: {
  action?: LeadMutation | undefined;
  scopeId?: string | undefined;
  queue?: DistributionQueue;
}) {
  return (
    <form {...(action ? { action } : {})} className={managementStyles.actionPanel}>
      {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
      {queue ? (
        <>
          <input type="hidden" name="queueId" value={queue.id} />
          <input type="hidden" name="expectedRevision" value={queue.revision} />
        </>
      ) : null}
      <div className={leadStyles.formGrid}>
        <label className={leadStyles.field}>
          Nome
          <input
            className={leadStyles.input}
            name="name"
            defaultValue={queue?.name}
            required
            disabled={!action}
          />
        </label>
        <label className={leadStyles.field}>
          Prioridade
          <input
            className={leadStyles.input}
            name="priority"
            type="number"
            min="1"
            defaultValue={queue?.priority ?? 1}
            required
            disabled={!action}
          />
        </label>
        <label className={leadStyles.field}>
          Estratégia
          <select
            className={leadStyles.select}
            name="strategy"
            defaultValue="round_robin"
            disabled={!action}
          >
            <option value="round_robin">Rodízio</option>
            <option value="weighted">Peso</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className={leadStyles.field}>
          <span>Estado</span>
          <select
            className={leadStyles.select}
            name="active"
            defaultValue={queue?.active === false ? "false" : "true"}
            disabled={!action}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
        </label>
        <label className={`${leadStyles.field} ${leadStyles.fieldWide}`}>
          Motivo da alteração
          <textarea className={leadStyles.textarea} name="reason" required disabled={!action} />
        </label>
      </div>
      <button className={managementStyles.buttonPrimary} type="submit" disabled={!action}>
        Salvar fila
      </button>
    </form>
  );
}

function RulesView({
  queue,
  action,
}: {
  queue: DistributionQueue | null;
  action?: LeadMutation | undefined;
}) {
  if (!queue)
    return (
      <LeadStatePanel
        state="empty"
        title="Nenhuma fila selecionada"
        description="Crie ou selecione uma fila antes de organizar regras."
      />
    );
  return (
    <section className={leadStyles.stack} aria-labelledby="distribution-rules-title">
      <div className={managementStyles.sectionHeader}>
        <div>
          <h2 id="distribution-rules-title" className={managementStyles.sectionTitle}>
            Regras de {queue.name}
          </h2>
          <p className={managementStyles.sectionDescription}>
            A ordem define a precedência da avaliação.
          </p>
        </div>
      </div>
      {queue.rules.length > 0 ? (
        <ol className={leadStyles.stack}>
          {queue.rules.map((rule) => (
            <li key={rule.id} className={leadStyles.ruleRow}>
              <span className={leadStyles.pill}>{rule.order}</span>
              <span className="text-sm text-[var(--analytics-ink)]">
                {rule.fieldLabel} {rule.operatorLabel} <strong>{rule.valueLabel}</strong>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <LeadStatePanel
          state="empty"
          title="Fila sem regras"
          description="Sem regras, a fila depende dos critérios gerais da operação."
        />
      )}
      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full`}>
          Substituir conjunto de regras
        </summary>
        <form {...(action ? { action } : {})} className={managementStyles.actionPanel}>
          <input type="hidden" name="queueId" value={queue.id} />
          <input type="hidden" name="expectedRevision" value={queue.revision} />
          <label className={leadStyles.field}>
            Regras estruturadas
            <textarea
              className={leadStyles.textarea}
              name="rules"
              aria-describedby="rules-help"
              disabled={!action}
            />
          </label>
          <p id="rules-help" className={leadStyles.helper}>
            Use somente campos e operadores aceitos pelo contrato. A pré-validação ocorre no
            servidor.
          </p>
          <label className={leadStyles.field}>
            Motivo
            <textarea className={leadStyles.textarea} name="reason" required disabled={!action} />
          </label>
          <button className={managementStyles.buttonPrimary} type="submit" disabled={!action}>
            Validar e salvar regras
          </button>
        </form>
      </details>
    </section>
  );
}

function MembersView({
  queue,
  action,
}: {
  queue: DistributionQueue | null;
  action?: LeadMutation | undefined;
}) {
  if (!queue)
    return (
      <LeadStatePanel
        state="empty"
        title="Nenhuma fila selecionada"
        description="Selecione uma fila para gerenciar membros."
      />
    );
  return (
    <section className={leadStyles.stack} aria-labelledby="distribution-members-title">
      <div className={managementStyles.sectionHeader}>
        <div>
          <h2 id="distribution-members-title" className={managementStyles.sectionTitle}>
            Membros de {queue.name}
          </h2>
          <p className={managementStyles.sectionDescription}>
            Peso, posição e presença não substituem os controles de acesso.
          </p>
        </div>
      </div>
      {queue.members.length > 0 ? (
        <div className={leadStyles.tableRegion} tabIndex={0}>
          <table className={leadStyles.table}>
            <thead>
              <tr>
                <th scope="col">Membro</th>
                <th scope="col">Peso</th>
                <th scope="col">Posição</th>
                <th scope="col">Presença</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {queue.members.map((member) => (
                <tr key={member.id}>
                  <th scope="row">{member.name}</th>
                  <td>{member.weight}</td>
                  <td>{member.position}</td>
                  <td>{member.presenceLabel}</td>
                  <td>
                    <span className={leadStyles.pill}>{member.active ? "Ativo" : "Inativo"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <LeadStatePanel
          state="empty"
          title="Fila sem membros"
          description="Adicione usuários autorizados antes de ativar a distribuição."
        />
      )}
      <details className={managementStyles.disclosure}>
        <summary className={`${managementStyles.button} w-full`}>Editar membros</summary>
        <form {...(action ? { action } : {})} className={managementStyles.actionPanel}>
          <input type="hidden" name="queueId" value={queue.id} />
          <input type="hidden" name="expectedRevision" value={queue.revision} />
          <label className={leadStyles.field}>
            Membros estruturados
            <textarea className={leadStyles.textarea} name="members" disabled={!action} />
          </label>
          <label className={leadStyles.field}>
            Motivo
            <textarea className={leadStyles.textarea} name="reason" required disabled={!action} />
          </label>
          <button className={managementStyles.buttonPrimary} type="submit" disabled={!action}>
            Validar e salvar membros
          </button>
        </form>
      </details>
    </section>
  );
}

function CheckInView({
  queue,
  action,
  scopeId,
}: {
  queue: DistributionQueue | null;
  action?: LeadMutation | undefined;
  scopeId?: string | undefined;
}) {
  return (
    <section className={leadStyles.stack} aria-labelledby="distribution-checkin-title">
      <div className={managementStyles.sectionHeader}>
        <div>
          <h2 id="distribution-checkin-title" className={managementStyles.sectionTitle}>
            Check-in operacional
          </h2>
          <p className={managementStyles.sectionDescription}>
            A presença vale para a organização selecionada e pode expirar conforme a configuração.
          </p>
        </div>
      </div>
      {queue ? (
        <form
          {...(action ? { action } : {})}
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.formGrid}`}
        >
          {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
          <label className={leadStyles.field}>
            Presença
            <select
              className={leadStyles.select}
              name="available"
              defaultValue="true"
              disabled={!action}
            >
              <option value="true">Disponível</option>
              <option value="false">Indisponível</option>
            </select>
          </label>
          <label className={leadStyles.field}>
            Capacidade
            <input
              className={leadStyles.input}
              name="capacity"
              type="number"
              min="1"
              max="10000"
              defaultValue="1"
              required
              disabled={!action}
            />
          </label>
          <button className={managementStyles.buttonPrimary} type="submit" disabled={!action}>
            Atualizar presença
          </button>
        </form>
      ) : (
        <LeadStatePanel
          state="empty"
          title="Nenhuma fila disponível"
          description="O check-in será liberado depois da configuração de uma fila."
        />
      )}
    </section>
  );
}

function ExplanationView({
  explanations,
  canAssign,
  assignAction,
  scopeId,
}: {
  explanations: readonly DistributionExplanation[];
  canAssign: boolean;
  assignAction?: LeadMutation | undefined;
  scopeId?: string | undefined;
}) {
  return (
    <section className={leadStyles.stack} aria-labelledby="distribution-explanation-title">
      <div className={managementStyles.sectionHeader}>
        <div>
          <h2 id="distribution-explanation-title" className={managementStyles.sectionTitle}>
            Explicação da atribuição
          </h2>
          <p className={managementStyles.sectionDescription}>
            Motivos operacionais sem telefone, e-mail ou conteúdo de mensagens.
          </p>
        </div>
      </div>
      {explanations.length > 0 ? (
        <div className={leadStyles.tableRegion} tabIndex={0}>
          <table className={leadStyles.table}>
            <thead>
              <tr>
                <th scope="col">Lead</th>
                <th scope="col">Fila</th>
                <th scope="col">Responsável</th>
                <th scope="col">Motivo</th>
                <th scope="col">Horário</th>
              </tr>
            </thead>
            <tbody>
              {explanations.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.leadLabel}</th>
                  <td>{item.queueLabel}</td>
                  <td>{item.responsibleLabel ?? "Não atribuído"}</td>
                  <td>{item.reason}</td>
                  <td>{item.occurredAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <LeadStatePanel
          state="empty"
          icon={CircleHelp}
          title="Nenhuma atribuição explicada"
          description="Eventos aparecerão após a execução autorizada da distribuição."
        />
      )}
      {canAssign ? (
        <details className={managementStyles.disclosure}>
          <summary className={`${managementStyles.button} w-full`}>
            Atribuir lead manualmente
          </summary>
          <form
            {...(assignAction ? { action: assignAction } : {})}
            className={managementStyles.actionPanel}
          >
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <label className={leadStyles.field}>
              Identificador do lead
              <input className={leadStyles.input} name="leadId" required disabled={!assignAction} />
            </label>
            <label className={leadStyles.field}>
              Fila
              <select
                className={leadStyles.select}
                name="queueId"
                required
                disabled={!assignAction}
              >
                <option value="">Selecione</option>
              </select>
            </label>
            <label className={leadStyles.field}>
              Motivo
              <textarea
                className={leadStyles.textarea}
                name="reason"
                required
                disabled={!assignAction}
              />
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!assignAction}
            >
              Confirmar atribuição
            </button>
          </form>
        </details>
      ) : (
        <section
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.permissionPanel}`}
        >
          <ShieldAlert size={18} aria-hidden="true" />
          <p className={leadStyles.panelDescription}>
            Seu perfil não possui permissão para atribuição manual.
          </p>
        </section>
      )}
    </section>
  );
}
