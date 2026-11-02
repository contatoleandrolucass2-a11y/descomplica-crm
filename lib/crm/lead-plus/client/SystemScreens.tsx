import { lazy } from "react";
import {
  ConnectedLeads,
  ConnectedIntegrations,
  ConnectedAudit,
  PersistentRecords,
} from "./ConnectedCRM";
import { Panel } from "./ui";

const CrmUserLinks = lazy(() => import("./CrmUserLinks"));
const ConnectedBucket = lazy(() =>
  import("./Bucket").then((module) => ({ default: module.ConnectedBucket })),
);
const BucketSettings = lazy(() =>
  import("./Bucket").then((module) => ({ default: module.BucketSettings })),
);
const ImportLeads = lazy(() => import("./ImportLeads"));
const Exportations = lazy(() => import("./Exportations"));
const Management = lazy(() => import("./Management"));
const Permissions = lazy(() => import("./Permissions"));
const AdminPanel = lazy(() => import("./AdminPanel"));
const ConnectedConfiguration = lazy(() =>
  import("./ConnectedConfiguration").then((module) => ({ default: module.ConnectedConfiguration })),
);
const WorkspaceHome = lazy(() =>
  import("./OperationalScreens").then((module) => ({ default: module.WorkspaceHome })),
);
const Hierarchy = lazy(() =>
  import("./OperationalScreens").then((module) => ({ default: module.Hierarchy })),
);
const Training = lazy(() =>
  import("./OperationalScreens").then((module) => ({ default: module.Training })),
);

export default function SystemScreens({
  screen,
  navigate,
}: {
  screen: string;
  navigate: (screen: string) => void;
}) {
  switch (screen) {
    case "Administração":
      return <AdminPanel navigate={navigate} />;
    case "Permissões":
      return <Permissions />;
    case "Bolsão":
      return <ConnectedBucket navigate={navigate} />;
    case "Ajustes do Bolsão":
      return <BucketSettings />;
    case "Importar leads":
      return <ImportLeads />;
    case "Minhas exportações":
      return <Exportations />;
    case "Meu DESCOMPLICA LEAD":
      return <WorkspaceHome navigate={navigate} />;
    case "Hierarquia":
      return <Hierarchy />;
    case "Treinamentos":
      return <Training />;
    case "Leads":
      return <ConnectedLeads />;
    case "Funil":
      return <ConnectedLeads kanban />;
    case "Gestão":
      return <Management navigate={navigate} />;
    case "Ajustes":
    case "Mensagens prontas":
    case "Distribuição de leads":
    case "Filas de Distribuição":
      return <ConnectedConfiguration key={screen} screen={screen} />;
    case "Motivos de arquivamento":
      return (
        <PersistentRecords
          kind="archive-reasons"
          title={screen}
          headers={["Motivo", "Ativo (Sim/Não)"]}
        />
      );
    case "Usuários":
      return <CrmUserLinks />;
    case "Etiquetas":
      return (
        <PersistentRecords
          kind="tags"
          title={screen}
          headers={[
            "Nome",
            "Criado por",
            "Data de criação",
            "Última edição por",
            "Data da última edição",
          ]}
        />
      );
    case "Alerta de clientes sem atendimento":
      return (
        <PersistentRecords
          kind="alerts"
          title={screen}
          headers={["Equipe", "Cliente sem atendimento há", "Notificar", "Usuário", "Ativado?"]}
        />
      );
    case "Minhas indicações":
      return (
        <PersistentRecords
          kind="referrals"
          title={screen}
          headers={["Revenda", "Contato", "Telefone", "E-mail", "Cidade"]}
        />
      );
    case "Auditoria":
    case "Configurações":
      return <ConnectedAudit />;
    case "Integrações":
      return <ConnectedIntegrations />;
    default:
      return (
        <div className="system-screen">
          <Panel title="Tela não encontrada">
            <p>Selecione uma opção disponível na navegação do DESCOMPLICA LEAD.</p>
          </Panel>
        </div>
      );
  }
}
