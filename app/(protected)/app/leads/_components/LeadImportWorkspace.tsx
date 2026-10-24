import { Download, FileCheck2, FileUp, ShieldCheck } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";

import {
  LeadStatePanel,
  LeadSummaryMetric,
  leadStyles,
  type LeadSourceState,
} from "./LeadWorkspace";

type LeadMutation = (formData: FormData) => void | Promise<void>;
export type LeadImportBatch = {
  id: string;
  fileName: string;
  statusLabel: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdAtLabel: string;
  expiresAtLabel: string | null;
  planHash: string | null;
};
export type LeadImportPreview = LeadImportBatch & {
  errors: ReadonlyArray<{ row: number; field: string | null; message: string }>;
};

export function LeadImportWorkspace({
  state,
  scopeId,
  history,
  preview,
  canManage,
  canExport,
  previewAction,
  applyAction,
  exportHref,
  feedback,
}: {
  state: LeadSourceState;
  scopeId?: string | undefined;
  history: readonly LeadImportBatch[];
  preview: LeadImportPreview | null;
  canManage: boolean;
  canExport: boolean;
  previewAction?: LeadMutation | undefined;
  applyAction?: LeadMutation | undefined;
  exportHref?: string | undefined;
  feedback?: string | undefined;
}) {
  return (
    <div className={leadStyles.workspace}>
      {feedback ? (
        <section
          className={`${managementStyles.panel} ${managementStyles.panelPadded}`}
          role="status"
          aria-live="polite"
        >
          <strong className="text-sm text-[var(--analytics-ink)]">{feedback}</strong>
        </section>
      ) : null}
      {!canManage ? (
        <section
          className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.permissionPanel}`}
          role="status"
        >
          <strong className="text-sm text-[var(--analytics-ink)]">
            Importação somente para consulta
          </strong>
          <p className={leadStyles.panelDescription}>
            Seu perfil não pode enviar ou aplicar lotes.
          </p>
        </section>
      ) : null}
      <section className={leadStyles.twoColumn} aria-label="Importar e exportar leads">
        <article className={managementStyles.panel}>
          <header className={leadStyles.panelHeader}>
            <div>
              <h2 className={leadStyles.panelTitle}>1. Pré-visualizar CSV</h2>
              <p className={leadStyles.panelDescription}>
                O preview valida o arquivo e não cria leads.
              </p>
            </div>
            <FileUp aria-hidden="true" />
          </header>
          <form
            {...(canManage && previewAction ? { action: previewAction } : {})}
            className={managementStyles.actionPanel}
          >
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <label className={leadStyles.fileInput}>
              <span>
                <strong className="block">Arquivo CSV UTF-8</strong>
                <span className={leadStyles.helper}>
                  Cabeçalho versionado; limites validados no servidor.
                </span>
              </span>
              <input
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                disabled={!canManage || !previewAction}
              />
            </label>
            <label className={leadStyles.field}>
              Mapeamento de colunas
              <textarea
                className={leadStyles.textarea}
                name="mapping"
                defaultValue={
                  '{"name":"nome","email":"email","phone":"telefone","interest":"interesse"}'
                }
                required
                disabled={!canManage || !previewAction}
              />
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!canManage || !previewAction}
            >
              Validar arquivo
            </button>
          </form>
        </article>
        <article className={managementStyles.panel}>
          <header className={leadStyles.panelHeader}>
            <div>
              <h2 className={leadStyles.panelTitle}>Exportar leads</h2>
              <p className={leadStyles.panelDescription}>
                A exportação respeita escopo, permissão e filtros autorizados.
              </p>
            </div>
            <Download aria-hidden="true" />
          </header>
          <div className={leadStyles.panelBody}>
            {canExport && exportHref ? (
              <a className={managementStyles.buttonPrimary} href={exportHref} download>
                Baixar CSV seguro
              </a>
            ) : (
              <LeadStatePanel
                state="not_configured"
                title="Exportação indisponível"
                description="Seu perfil não possui permissão ou a rota de exportação ainda não está configurada."
              />
            )}
          </div>
        </article>
      </section>
      {preview ? (
        <section className={leadStyles.stack} aria-labelledby="import-preview-title">
          <div className={managementStyles.sectionHeader}>
            <div>
              <h2 id="import-preview-title" className={managementStyles.sectionTitle}>
                2. Revisar preview
              </h2>
              <p className={managementStyles.sectionDescription}>Nenhuma linha foi aplicada.</p>
            </div>
          </div>
          <div className={leadStyles.summaryGrid}>
            <LeadSummaryMetric label="Linhas" value={preview.totalRows} />
            <LeadSummaryMetric label="Válidas" value={preview.validRows} />
            <LeadSummaryMetric label="Com erro" value={preview.invalidRows} />
            <LeadSummaryMetric label="Status" value={preview.statusLabel} />
          </div>
          {preview.errors.length > 0 ? (
            <div className={leadStyles.tableRegion} tabIndex={0}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Linha</th>
                    <th scope="col">Campo</th>
                    <th scope="col">Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((error, index) => (
                    <tr key={`${error.row}-${error.field ?? "row"}-${index}`}>
                      <td>{error.row}</td>
                      <td>{error.field ?? "Linha"}</td>
                      <td>{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={leadStyles.helper}>
              <ShieldCheck size={16} aria-hidden="true" /> Nenhum erro de validação retornado.
            </p>
          )}
          <form
            {...(canManage && applyAction ? { action: applyAction } : {})}
            className={`${managementStyles.panel} ${managementStyles.panelPadded} ${leadStyles.stack}`}
          >
            <input type="hidden" name="batchId" value={preview.id} />
            {scopeId ? <input type="hidden" name="organizationId" value={scopeId} /> : null}
            <input type="hidden" name="expectedHash" value={preview.planHash ?? ""} />
            <input type="hidden" name="planHash" value={preview.planHash ?? ""} />
            <label className={leadStyles.field}>
              Confirmação
              <select
                className={leadStyles.select}
                name="confirmed"
                defaultValue=""
                required
                disabled={!canManage || !applyAction || preview.invalidRows > 0}
              >
                <option value="" disabled>
                  Revise o resumo
                </option>
                <option value="yes">Aplicar somente após confirmação</option>
              </select>
            </label>
            <button
              className={managementStyles.buttonPrimary}
              type="submit"
              disabled={!canManage || !applyAction || preview.invalidRows > 0 || !preview.planHash}
            >
              <FileCheck2 size={16} aria-hidden="true" />
              3. Aplicar lote validado
            </button>
          </form>
        </section>
      ) : null}
      <section className={leadStyles.stack} aria-labelledby="import-history-title">
        <h2 id="import-history-title" className={managementStyles.sectionTitle}>
          Histórico de lotes
        </h2>
        {state === "ready" || state === "empty" ? (
          history.length > 0 ? (
            <div className={leadStyles.tableRegion} tabIndex={0}>
              <table className={leadStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Arquivo</th>
                    <th scope="col">Status</th>
                    <th scope="col">Linhas</th>
                    <th scope="col">Válidas</th>
                    <th scope="col">Erros</th>
                    <th scope="col">Criado em</th>
                    <th scope="col">Expira em</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((batch) => (
                    <tr key={batch.id}>
                      <th scope="row">{batch.fileName}</th>
                      <td>
                        <span className={leadStyles.pill}>{batch.statusLabel}</span>
                      </td>
                      <td>{batch.totalRows}</td>
                      <td>{batch.validRows}</td>
                      <td>{batch.invalidRows}</td>
                      <td>{batch.createdAtLabel}</td>
                      <td>{batch.expiresAtLabel ?? "Não informado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LeadStatePanel
              state="empty"
              title="Nenhum lote importado"
              description="O histórico aparecerá após o primeiro preview autorizado."
            />
          )
        ) : (
          <LeadStatePanel
            state={state === "error" ? "error" : "not_configured"}
            icon={FileUp}
            title={
              state === "error" ? "Histórico indisponível" : "Importação ainda não configurada"
            }
            description="Nenhum arquivo foi enviado por esta tela."
          />
        )}
      </section>
    </div>
  );
}
