"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, KanbanSquare, MessagesSquare, Calendar,
  TrendingDown, Sparkles, Megaphone, Settings, Menu, X, Calculator,
  Swords, Route, Send, Map, CalendarRange, BrainCircuit, MessageCircle,
} from "lucide-react";
import { ExcavatorIcon } from "@/components/icons";
import { useState } from "react";
import { cn } from "@/lib/utils";

const GRUPOS = [
  {
    label: "Principal",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "WhatsApp", icon: MessageCircle },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/mapa", label: "Mapa", icon: Map },
      { href: "/radar", label: "Radar de safra", icon: CalendarRange },
    ],
  },
  {
    label: "Vendas",
    links: [
      { href: "/pipeline", label: "Pipeline Kanban", icon: KanbanSquare },
      { href: "/comparativo", label: "Comparativo", icon: Swords },
      { href: "/conversas", label: "Conversas + IA", icon: MessagesSquare },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/roteiro", label: "Roteiro", icon: Route },
      { href: "/simulador", label: "Simulador", icon: Calculator },
    ],
  },
  {
    label: "Marketing",
    links: [
      { href: "/marketing", label: "Marketing IA", icon: BrainCircuit },
      { href: "/campanhas", label: "Campanhas", icon: Send },
      { href: "/midia", label: "Mídia", icon: Megaphone },
    ],
  },
  {
    label: "Análise",
    links: [
      { href: "/vendas-perdidas", label: "Vendas Perdidas", icon: TrendingDown },
      { href: "/sugestoes", label: "Sugestões IA", icon: Sparkles },
    ],
  },
  {
    label: "Sistema",
    links: [
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-800 bg-brand-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-agro-400">
            <ExcavatorIcon size={17} className="text-black" />
          </div>
          CRM DO EDY
        </div>
        <button
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg p-1.5 hover:bg-brand-800"
          aria-label="Menu"
        >
          {aberto ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay mobile */}
      {aberto && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 flex-col bg-gradient-to-b from-brand-900 to-brand-950 text-brand-100 md:sticky md:top-0 md:flex md:min-h-screen",
          aberto ? "flex" : "hidden"
        )}
      >
        {/* Logo — desktop */}
        <div className="hidden items-center gap-3 px-5 py-5 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-agro-400 shadow-md shadow-agro-500/20">
            <ExcavatorIcon size={22} className="text-black" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-white">CRM DO EDY</div>
            <div className="mt-0.5 text-[10px] text-agro-400">New Holland · Dynapac</div>
          </div>
        </div>

        {/* Divisor */}
        <div className="mx-4 hidden border-t border-brand-800 md:block" />

        {/* Nav com grupos */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
          {GRUPOS.map((grupo) => (
            <div key={grupo.label} className="mb-1 px-3">
              <div className="mb-1 mt-3 px-2 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                {grupo.label}
              </div>
              {grupo.links.map(({ href, label, icon: Icon }) => {
                const ativo = pathname === href || (pathname.startsWith(href + "/") && href !== "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAberto(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                      ativo
                        ? "bg-white/15 text-white"
                        : "text-brand-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon
                      size={16}
                      className={cn(
                        "shrink-0",
                        ativo ? "text-agro-400" : "text-brand-400 group-hover:text-brand-200"
                      )}
                    />
                    <span className="truncate">{label}</span>
                    {ativo && (
                      <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-agro-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="hidden border-t border-brand-800 px-5 py-4 md:block">
          <div className="text-[10px] text-brand-500">Vendas com IA · Sul do ES</div>
        </div>
      </aside>
    </>
  );
}
