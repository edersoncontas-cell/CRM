"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ExcavatorIcon } from "@/components/icons";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { GRUPOS, TODOS_HREFS, lerMenuOcultos, EVENTO_MENU } from "@/lib/menu";

// O link ativo é o de match mais específico (ex.: /maquinas/fichas vence /maquinas).
function hrefAtivo(pathname: string, href: string): boolean {
  const candidatos = TODOS_HREFS.filter(
    (h) => pathname === h || (h !== "/" && pathname.startsWith(h + "/"))
  );
  if (candidatos.length === 0) return false;
  const maisEspecifico = candidatos.reduce((a, b) => (b.length > a.length ? b : a));
  return href === maisEspecifico;
}

export function Sidebar() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);

  // Lê a preferência de visibilidade e reage a mudanças (feitas em Configurações).
  useEffect(() => {
    const atualizar = () => setOcultos(lerMenuOcultos());
    atualizar();
    window.addEventListener(EVENTO_MENU, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_MENU, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  // Esconde os itens desmarcados (exceto os fixos), e grupos que ficaram vazios.
  const grupos = GRUPOS
    .map((g) => ({ ...g, links: g.links.filter((l) => l.fixo || !ocultos.includes(l.href)) }))
    .filter((g) => g.links.length > 0);

  return (
    <>
      {/* Topbar mobile (com safe-area para o notch/ilha dinâmica do iPhone) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-800 bg-brand-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white md:hidden">
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
          {grupos.map((grupo) => (
            <div key={grupo.label} className="mb-1 px-3">
              <div className="mb-1 mt-3 px-2 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                {grupo.label}
              </div>
              {grupo.links.map(({ href, label, icon: Icon }) => {
                const ativo = hrefAtivo(pathname, href);
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
