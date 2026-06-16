"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, KanbanSquare, MessagesSquare, Calendar,
  TrendingDown, Sparkles, Megaphone, Settings, Tractor, Menu, X, Calculator,
  Swords, Route, Send,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pipeline", label: "Pipeline (Kanban)", icon: KanbanSquare },
  { href: "/comparativo", label: "Comparativo", icon: Swords },
  { href: "/conversas", label: "Conversas + IA", icon: MessagesSquare },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/roteiro", label: "Roteiro de visitas", icon: Route },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/campanhas", label: "Campanhas", icon: Send },
  { href: "/vendas-perdidas", label: "Vendas Perdidas", icon: TrendingDown },
  { href: "/sugestoes", label: "Sugestões", icon: Sparkles },
  { href: "/midia", label: "Mídia", icon: Megaphone },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Topo mobile */}
      <div className="flex items-center justify-between border-b bg-brand-800 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2 font-bold">
          <Tractor size={20} /> CRM New Holland
        </div>
        <button onClick={() => setAberto((v) => !v)}>
          {aberto ? <X /> : <Menu />}
        </button>
      </div>

      <aside
        className={cn(
          "z-20 w-64 shrink-0 flex-col bg-brand-900 text-brand-100 md:flex md:min-h-screen",
          aberto ? "flex" : "hidden"
        )}
      >
        <div className="hidden items-center gap-2 px-6 py-5 text-lg font-bold text-white md:flex">
          <Tractor size={24} className="text-agro-500" />
          CRM New Holland
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const ativo = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setAberto(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  ativo
                    ? "bg-brand-600 text-white"
                    : "text-brand-200 hover:bg-brand-800 hover:text-white"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden px-6 py-4 text-xs text-brand-300 md:block">
          Sul do Espírito Santo · Vendas com IA
        </div>
      </aside>
    </>
  );
}
