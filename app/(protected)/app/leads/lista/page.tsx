import { Search, SlidersHorizontal } from "lucide-react";

import { managementStyles } from "@/app/(protected)/_components/ManagementCanvas";
import { enforcePageAccess } from "@/lib/authorization/enforce";

import { LeadPageShell, LeadSourceNotice } from "../_components/LeadWorkspace";

export const metadata = { title: "Lista de leads" };

const VIEWS = ["A fazer", "Visitas", "Futuras", "Favoritos", "Todos"] as const;

export default async function LeadsListPage() {
  await enforcePageAccess("/app/leads/lista");

  return (
    <LeadPageShell
      eyebrow="Lead"
      title="Lista de leads"
      description="Pesquisa, filtros e acompanhamento diário dos contatos comerciais."
    >
      <LeadSourceNotice />

      <section className="grid gap-3" aria-labelledby="lead-list-controls-title">
        <div className={managementStyles.sectionHeader}>
          <div>
            <h2 id="lead-list-controls-title" className={managementStyles.sectionTitle}>
              Trabalho diário
            </h2>
            <p className={managementStyles.sectionDescription}>
              As visões e os filtros serão ativados quando a fonte oficial estiver disponível.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Visões da lista">
          {VIEWS.map((view) => (
            <button key={view} type="button" className={managementStyles.button} disabled>
              {view}
            </button>
          ))}
        </div>

        <div className={managementStyles.toolbar}>
          <label className={managementStyles.searchLabel}>
            <Search aria-hidden="true" />
            <span className={managementStyles.searchCopy}>
              <span>Pesquisar leads</span>
              <input
                className={managementStyles.searchInput}
                type="search"
                name="lead-search"
                autoComplete="off"
                placeholder="Ex.: nome, telefone, e-mail ou produto…"
                disabled
              />
            </span>
          </label>
          <button type="button" className={managementStyles.button} disabled>
            <SlidersHorizontal size={17} aria-hidden="true" />
            Filtros
          </button>
        </div>

        <div className={managementStyles.tableRegion}>
          <table className={managementStyles.table}>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Interesse</th>
                <th scope="col">Responsável</th>
                <th scope="col">Status</th>
                <th scope="col">Etapa</th>
                <th scope="col">Última interação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className={managementStyles.emptyCell}>
                  Nenhum lead foi consultado porque a fonte oficial ainda não está configurada.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </LeadPageShell>
  );
}
