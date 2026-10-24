import { BellRing, Settings2, Tags } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import { LeadStatePanel, leadStyles, type LeadSourceState } from "./LeadWorkspace";

type LeadMutation = (formData: FormData) => void | Promise<void>;
export type LeadSettingsData = {
  revision: number;
  duplicateWindowDays: number | null;
  unattendedTimeoutMinutes: number | null;
  assignmentPolicy: string | null;
  publicLinkEnabled: boolean | null;
  alerts: ReadonlyArray<{ id: string; minutes: number; recipientLabel: string; active: boolean }>;
};

export function LeadSettingsWorkspace({
  state,
  scopeId,
  settings,
  canManage,
  saveSettingsAction,
  saveAlertsAction,
  documentJson,
  saveDocumentAction,
}: {
  state: LeadSourceState;
  scopeId?: string | undefined;
  settings: LeadSettingsData | null;
  canManage: boolean;
  saveSettingsAction?: LeadMutation | undefined;
  saveAlertsAction?: LeadMutation | undefined;
  documentJson?: string | undefined;
  saveDocumentAction?: LeadMutation | undefined;
}) {
  if (state !== "ready" || !settings)
    return (
      <LeadStatePanel
        state={state === "error" ? "error" : "not_configured"}
        icon={Settings2}
        title={
          state === "error"
            ? "Configurações temporariamente indisponíveis"
            : state === "scope_required"
              ? "Selecione um escopo"
              : "Configurações ainda não criadas"
        }
        description={
          state === "error"
            ? "A consulta falhou; nenhuma versão anterior foi apresentada como atual."
            : "Defina as políticas somente quando o contrato autorizado estiver disponível."
        }
      />
    );
  return (
    <div className={leadStyles.workspace}>
      {!canManage ? (
        <section
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.permissionPanel}`}
          role="status"
        >
          <strong className="text-sm text-[var(--analytics-ink)]">Consulta habilitada</strong>
          <p className={leadStyles.panelDescription}>Alterações exigem permissão de gestão.</p>
        </section>
      ) : null}
      <section className={leadStyles.twoColumn}>
        <article className={managementStyles.panel}>
          <header className={leadStyles.panelHeader}>
            <div>
              <h2 className={leadStyles.panelTitle}>Políticas da organização</h2>
              <p className={leadStyles.panelDescription}>Revisão atual: {settings.revision}</p>
            </div>
            <Settings2 aria-hidden="true" />
          </header>
          <form
            {...(canManage && saveSettingsAction ? { action: saveSettingsAction } : {})}
            className={managementStyles.actionPanel}
          >
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <input type="hidden" name="expectedRevision" value={settings.revision} />
            <label className={leadStyles.field}>
              Janela de duplicidade (dias)
              <input
                className={leadStyles.input}
                name="duplicateWindowDays"
                type="number"
                min="0"
                max="365"
                defaultValue={settings.duplicateWindowDays ?? ""}
                required
                disabled={!canManage || !saveSettingsAction}
              />
            </label>
            <label className={leadStyles.field}>
              Alerta sem atendimento (minutos)
              <input
                className={leadStyles.input}
                name="unattendedTimeoutMinutes"
                type="number"
                min="1"
                max="10080"
                defaultValue={settings.unattendedTimeoutMinutes ?? ""}
                required
                disabled={!canManage || !saveSettingsAction}
              />
            </label>
            <label className={leadStyles.field}>
              Política de atribuição
              <select
                className={leadStyles.select}
                name="assignmentPolicy"
                defaultValue={settings.assignmentPolicy ?? ""}
                disabled={!canManage || !saveSettingsAction}
              >
                <option value="">Não informada</option>
                <option value="weighted_round_robin">Rodízio ponderado</option>
                <option value="queue">Filas configuradas</option>
                <option value="manual">Somente manual</option>
                <option value="hybrid">Híbrida</option>
              </select>
            </label>
            <label className={leadStyles.field}>
              Link público
              <select
                className={leadStyles.select}
                name="publicLinkEnabled"
                defaultValue={
                  settings.publicLinkEnabled === null
                    ? ""
                    : settings.publicLinkEnabled
                      ? "true"
                      : "false"
                }
                disabled={!canManage || !saveSettingsAction}
              >
                <option value="">Não informado</option>
                <option value="false">Desativado</option>
                <option value="true">Ativado</option>
              </select>
            </label>
            <label className={leadStyles.field}>
              Motivo da alteração
              <textarea
                className={leadStyles.textarea}
                name="reason"
                required
                disabled={!canManage || !saveSettingsAction}
              />
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!canManage || !saveSettingsAction}
            >
              Salvar com controle de revisão
            </button>
          </form>
        </article>
        <article className={managementStyles.panel}>
          <header className={leadStyles.panelHeader}>
            <div>
              <h2 className={leadStyles.panelTitle}>Alertas</h2>
              <p className={leadStyles.panelDescription}>
                Destinatários sempre limitados ao escopo autorizado.
              </p>
            </div>
            <BellRing aria-hidden="true" />
          </header>
          <div className={leadStyles.panelBody}>
            {settings.alerts.length > 0 ? (
              <ul className={leadStyles.compactList}>
                {settings.alerts.map((alert) => (
                  <li key={alert.id}>
                    <span>
                      <strong className="block text-sm text-[var(--analytics-ink)]">
                        {alert.recipientLabel}
                      </strong>
                      <span className={leadStyles.meta}>Após {alert.minutes} minutos</span>
                    </span>
                    <span className={leadStyles.pill}>{alert.active ? "Ativo" : "Inativo"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <LeadStatePanel
                state="empty"
                title="Nenhum alerta configurado"
                description="A operação continuará sem notificações específicas de atraso."
              />
            )}
          </div>
          <details className={managementStyles.disclosure}>
            <summary className={`${managementStyles.button} w-full`}>Editar alertas</summary>
            <form
              {...(canManage && saveAlertsAction ? { action: saveAlertsAction } : {})}
              className={managementStyles.actionPanel}
            >
              {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
              <input type="hidden" name="expectedRevision" value={settings.revision} />
              <label className={leadStyles.field}>
                Alertas estruturados
                <textarea
                  className={leadStyles.textarea}
                  name="alerts"
                  disabled={!canManage || !saveAlertsAction}
                />
              </label>
              <label className={leadStyles.field}>
                Motivo
                <textarea
                  className={leadStyles.textarea}
                  name="reason"
                  required
                  disabled={!canManage || !saveAlertsAction}
                />
              </label>
              <button
                className={managementStyles.buttonPrimary}
                type="submit"
                disabled={!canManage || !saveAlertsAction}
              >
                Validar e salvar alertas
              </button>
            </form>
          </details>
        </article>
      </section>
      {documentJson ? (
        <details className={managementStyles.disclosure}>
          <summary className={`${managementStyles.button} w-full justify-between`}>
            <span>Editor completo das configurações</span>
            <span className={leadStyles.meta}>Validação estrutural e revisão no servidor</span>
          </summary>
          <form
            {...(canManage && saveDocumentAction ? { action: saveDocumentAction } : {})}
            className={managementStyles.actionPanel}
          >
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <input type="hidden" name="expectedRevision" value={settings.revision} />
            <label className={leadStyles.field}>
              Documento de configuração
              <textarea
                className={leadStyles.textarea}
                name="document"
                defaultValue={documentJson}
                required
                disabled={!canManage || !saveDocumentAction}
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
                disabled={!canManage || !saveDocumentAction}
              />
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!canManage || !saveDocumentAction}
            >
              Validar e salvar documento
            </button>
          </form>
        </details>
      ) : null}
      <section
        className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
        aria-labelledby="settings-catalogs-title"
      >
        <div className="flex items-start gap-3">
          <Tags aria-hidden="true" />
          <div>
            <h2 id="settings-catalogs-title" className={leadStyles.panelTitle}>
              Catálogos operacionais
            </h2>
            <p className={leadStyles.panelDescription}>
              Fontes, canais, etiquetas, motivos e etapas são catálogos do núcleo Lead. A gestão
              depende dos endpoints específicos; esta tela não altera listas por inferência.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
