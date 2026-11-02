import WhatsAppNotifications from "./WhatsAppNotifications";
import UserViewSelector from "./UserViewSelector";
import { workspaceDocument } from "./workspace-document";
import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import SystemScreens from "./SystemScreens";
import OperationDashboard from "./OperationDashboard";
import MetaDashboard from "./MetaDashboard";
import BackendStatus from "./BackendStatus";
import ConnectedReports from "./ConnectedReports";
import LeadNotifications from "./LeadNotifications";
import { submenus, canAccessRoute } from "./navigation";
import { Sidebar } from "./components/ui/sidebar";
import SidebarDemo from "./components/sidebar-demo";
import { HostSessionRequired, useAuth } from "./Auth";

function currentRoute() {
  try {
    const route = decodeURIComponent(location.hash.slice(1)) || "LEAD+";
    return [
      "Imóveis",
      "Portais",
      "Módulos WhatsApp",
      "Assistente: Qualificação",
      "Integrador WhatsApp",
      "Pesquisa de satisfação",
      "Pagamentos",
      "Conexão Meta",
      "Meu perfil",
      "Leads turbo",
      "Produtos",
      "DESCOMPLICA LEAD IA",
      "Gestor de Imóveis + Site",
      "Financeiro",
    ].includes(route)
      ? "LEAD+"
      : route;
  } catch {
    return "LEAD+";
  }
}
export default function App({ initialScreen = "Leads" }: { initialScreen?: string }) {
  const [active, setActive] = useState(() => (location.hash ? currentRoute() : initialScreen)),
    [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(() => matchMedia("(max-width:767px)").matches);
  const auth = useAuth();
  const navigate = (value: string) => {
    setActive(value);
    location.hash = encodeURIComponent(value);
    workspaceDocument().querySelector(".workspace-scroll")?.scrollTo(0, 0);
  };
  useEffect(() => {
    const route = () => {
      setActive(currentRoute());
      workspaceDocument().querySelector(".workspace-scroll")?.scrollTo(0, 0);
    };
    const media = matchMedia("(max-width:767px)");
    const resized = () => {
      setMobile(media.matches);
      setOpen(false);
    };
    window.addEventListener("hashchange", route);
    media.addEventListener("change", resized);
    return () => {
      window.removeEventListener("hashchange", route);
      media.removeEventListener("change", resized);
    };
  }, []);
  useEffect(() => {
    document.title = active + " · DESCOMPLICA LEAD";
  }, [active]);
  if (auth.loading || (!auth.user && !auth.preview)) return <HostSessionRequired />;
  return (
    <MotionConfig reducedMotion="user">
      <div className="descomplica-app">
        <a
          className="skip-link"
          href="#lead-main"
          onClick={(event) => {
            event.preventDefault();
            workspaceDocument().getElementById("lead-main")?.focus();
          }}
        >
          Pular para o conteúdo
        </a>
        <Sidebar open={open} setOpen={setOpen}>
          <div className="lead-workspace">
            <SidebarDemo active={active} navigate={navigate} />
            <div className="workspace-scroll" inert={mobile && open}>
              <UserViewSelector />
              <div className="workspace-heading">
                <div>
                  <span className="workspace-eyebrow">DESCOMPLICA LEAD</span>
                  <div className="workspace-breadcrumb">
                    LEAD+ <span>/</span> {active === "LEAD+" ? "Visão geral" : active}
                  </div>
                </div>
                <span className="workspace-indicator">
                  <i /> Workspace
                </span>
              </div>
              <main
                key={auth.user?.id || "no-user"}
                id="lead-main"
                tabIndex={-1}
                className="workspace-content system-main"
              >
                {!canAccessRoute(active, auth.can, auth.user?.host_pages) ? (
                  <div className="system-screen" role="alert">
                    <h1>Acesso restrito</h1>
                    <p>Seu nível não possui permissão para esta tela.</p>
                  </div>
                ) : active === "LEAD+" || active === "Dashboards" ? (
                  <OperationDashboard />
                ) : active === "Dashboard Meta" ? (
                  <MetaDashboard />
                ) : active === "Relatórios" || submenus.Relatórios!.includes(active) ? (
                  <ConnectedReports key={active} screen={active} />
                ) : (
                  <SystemScreens key={active} screen={active} navigate={navigate} />
                )}
              </main>
              <footer className="workspace-footer">
                <span>DESCOMPLICA LEAD</span>
                <BackendStatus />
              </footer>
            </div>
          </div>
        </Sidebar>
        <LeadNotifications key={auth.user?.id || "preview"} navigate={navigate} />
        <WhatsAppNotifications
          key={"whatsapp-" + (auth.user?.id || "preview")}
          navigate={navigate}
        />
      </div>
    </MotionConfig>
  );
}
