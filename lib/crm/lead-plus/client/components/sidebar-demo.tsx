"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  MessageCircle,
  MessagesSquare,
  PanelsTopLeft,
  Briefcase,
  Grid3X3,
  House,
  Network,
  Inbox,
  Filter,
  Users,
  ChartNoAxesCombined,
  Upload,
  Plug,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { SidebarBody, SidebarLink, useSidebar } from "./ui/sidebar";
import { submenus, canShowMenu, visibleSubmenus } from "../navigation";
import { cn } from "../lib/utils";
import { useAuth } from "../Auth";

const menu = [
  ["Leads", MessageCircle],
  ["Central de Atendimento", MessagesSquare],
  ["Dashboards", PanelsTopLeft],
  ["Gestão", Briefcase],
  ["Meu DESCOMPLICA LEAD", Grid3X3],
  ["Hierarquia", Network],
  ["Bolsão", Inbox],
  ["Funil", Filter],
  ["Usuários", Users],
  ["Relatórios", ChartNoAxesCombined],
  ["Distribuição de leads", Network],
  ["Importar leads", Upload],
  ["Integrações", Plug],
  ["Configurações", Settings],
  ["Administração", ShieldCheck],
] as const;
export default function SidebarDemo({
  active,
  navigate,
}: {
  active: string;
  navigate: (value: string) => void;
}) {
  const { open, setOpen } = useSidebar();
  const { can, user } = useAuth();
  const [expanded, setExpanded] = useState<string[]>([]);
  const reduced = useReducedMotion();
  const choose = (value: string) => {
    navigate(value);
    if (matchMedia("(max-width:767px)").matches) setOpen(false);
  };
  return (
    <SidebarBody className="lead-sidebar justify-between gap-10" data-sidebar-shell="true">
      <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <a
          href="#LEAD%2B"
          aria-label="DESCOMPLICA LEAD, início"
          onClick={() => choose("LEAD+")}
          className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
        >
          <img className="h-5 w-6 shrink-0" src="/lead-plus/descomplica-lead-icon.svg" alt="" />
          {open && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduced ? { duration: 0 } : {}}
              className="font-medium whitespace-pre text-black dark:text-white"
            >
              DESCOMPLICA LEAD
            </motion.span>
          )}
        </a>
        <div className="mt-8 flex flex-col gap-2">
          {menu
            .filter(([label]) => canShowMenu(label, can, user?.host_pages))
            .map(([label, Icon]) => {
              const current = active === label || submenus[label]?.includes(active);
              const children = submenus[label]
                ? visibleSubmenus(label, can, user?.host_pages)
                : undefined;
              return (
                <div key={label}>
                  <SidebarLink
                    link={{
                      label,
                      href: children
                        ? "#" + encodeURIComponent(active)
                        : "#" + encodeURIComponent(label),
                      icon: (
                        <Icon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                      ),
                    }}
                    aria-current={current ? "page" : undefined}
                    aria-expanded={children ? expanded.includes(label) : undefined}
                    className={cn(
                      "rounded-lg",
                      current && "balanced:bg-[#cdd9e8] bg-white dark:bg-neutral-700",
                    )}
                    onClick={(e) => {
                      if (children) {
                        e.preventDefault();
                        setOpen(true);
                        setExpanded(
                          expanded.includes(label)
                            ? expanded.filter((v) => v !== label)
                            : [...expanded, label],
                        );
                      } else choose(label);
                    }}
                  />
                  {children && open && expanded.includes(label) && (
                    <div className="flex flex-col gap-1 py-1 pl-7">
                      {children.map((child) => (
                        <a
                          key={child}
                          href={"#" + encodeURIComponent(child)}
                          aria-current={active === child ? "page" : undefined}
                          onClick={() => choose(child)}
                          className={cn(
                            "rounded-md px-2 py-2 text-xs text-neutral-600 hover:bg-white dark:text-neutral-300 dark:hover:bg-neutral-700",
                            active === child && "bg-white dark:bg-neutral-700",
                          )}
                        >
                          {child}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </SidebarBody>
  );
}
