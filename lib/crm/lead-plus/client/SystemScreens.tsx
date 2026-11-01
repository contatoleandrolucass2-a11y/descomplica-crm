import { ConnectedBucket, BucketSettings } from "./Bucket";
import ImportLeads from "./ImportLeads";
import Exportations from "./Exportations";
import Management from "./Management";
import Permissions from "./Permissions";
import AdminPanel from "./AdminPanel";
import { ConnectedConfiguration } from "./ConnectedConfiguration";
import {
  ConnectedLeads,
  ConnectedIntegrations,
  ConnectedAudit,
  PersistentRecords,
} from "./ConnectedCRM";
import { WorkspaceHome, Hierarchy, Training } from "./OperationalScreens";
import { Panel } from "./ui";

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
      return (
        <PersistentRecords
          kind="users"
          title="Listagem de usuários"
          headers={["Hierarquia", "Nome", "E-mail", "Telefone(s)", "Ativo"]}
        />
      );
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
