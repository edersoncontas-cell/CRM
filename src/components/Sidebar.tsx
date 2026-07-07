
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, GripVertical, ArrowUpDown, Check } from "lucide-react";
import { ExcavatorIcon } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GRUPOS, TODOS_HREFS, lerMenuOcultos, lerOrdemMenu, salvarOrdemMenu, EVENTO_MENU, type ItemMenu } from "@/lib/menu";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// O link ativo é o de match mais específico (ex.: /maquinas/fichas vence /maquinas).
function hrefAtivo(pathname: string, href: string): boolean {
  const candidatos = TODOS_HREFS.filter(
    (h) => pathname === h || (h !== "/" && pathname.startsWith(h + "/"))
  );
  if (candidatos.length === 0) return false;
  const maisEspecifico = candidatos.reduce((a, b) => (b.length > a.length ? b : a));
  return href === maisEspecifico;
}

// Aplica a ordem customizada (se existir) a uma lista de itens: os que estão
// na ordem salva vêm primeiro (nessa ordem), o resto mantém a ordem original.
function aplicarOrdem(itens: ItemMenu[], ordem: string[]): ItemMenu[] {
  if (!ordem.length) return itens;
  const porHref = new Map(itens.map((i) => [i.href, i]));
  const ordenados: ItemMenu[] = [];
  for (const href of ordem) {
    const item = porHref.get(href);
    if (item) { ordenados.push(item); porHref.delete(href); }
  }
  return [...ordenados, ...porHref.values()];
}

function ItemArrastavel({ item, ativo, fechar }: { item: ItemMenu; ativo: boolean; fechar: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href });
  const Icon = item.icon;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={cn(
        "group flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium",
        ativo ? "bg-white/15 text-white" : "text-brand-300"
      )}
    >
      <span {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-brand-500 active:cursor-grabbing">
        <GripVertical size={15} />
      </span>
      <Icon size={17} className="shrink-0 text-brand-400" />
      <span className="truncate">{item.label}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<string[]>([]);
  const [reorganizando, setReorganizando] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  // Lê a preferência de visibilidade/ordem e reage a mudanças (feitas em Configurações).
  useEffect(() => {
    const atualizar = () => { setOcultos(lerMenuOcultos()); setOrdem(lerOrdemMenu()); };
    atualizar();
    window.addEventListener(EVENTO_MENU, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO_MENU, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  // Trava o scroll do body quando o menu mobile está aberto
  useEffect(() => {
    if (aberto) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [aberto]);

  // Esconde os itens desmarcados (exceto os fixos), e grupos que ficaram vazios.
  const grupos = GRUPOS
    .map((g) => ({ ...g, links: g.links.filter((l) => l.fixo || !ocultos.includes(l.href)) }))
    .filter((g) => g.links.length > 0);

  // Lista plana (todos os itens visíveis, na ordem personalizada se houver) —
  // usada tanto no modo de reorganizar quanto, depois de salva, na navegação normal.
  const itensPlanosOriginais = useMemo(() => grupos.flatMap((g) => g.links), [grupos]);
  const itensOrdenados = useMemo(() => aplicarOrdem(itensPlanosOriginais, ordem), [itensPlanosOriginais, ordem]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const hrefsAtuais = itensOrdenados.map((i) => i.href);
    const oldIndex = hrefsAtuais.indexOf(String(active.id));
    const newIndex = hrefsAtuais.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const novaOrdem = arrayMove(hrefsAtuais, oldIndex, newIndex);
    setOrdem(novaOrdem);
    salvarOrdemMenu(novaOrdem);
  }

  const fechar = () => setAberto(false);

  return (
    <>
      {/* Topbar mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-800 bg-brand-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white md:hidden">
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-agro-400">
            <ExcavatorIcon size={17} className="text-black" />
          </div>
          CRM DO EDY
        </div>
        <button
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg p-1.5 hover:bg-brand-800 active:scale-95 transition-transform"
          aria-label="Menu"
        >
          {aberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Overlay mobile — intercepta toques fora do menu */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={fechar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Layout base
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col",
          // Visual
          "bg-brand-900 text-brand-100 shadow-2xl",
          // Desktop: sticky, com altura travada na viewport para o <nav> interno
          // rolar sozinho (sem isso, o menu rolava junto com a página).
          "md:sticky md:top-0 md:z-30 md:h-screen md:max-h-screen md:w-64 md:overflow-hidden md:shadow-none md:bg-gradient-to-b md:from-brand-900 md:to-brand-950",
          // Animação mobile
          "transition-transform duration-300 ease-in-out md:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full"
        )}
        // Permite scroll independente no aside (mobile)
        style={{ touchAction: "pan-y" }}
      >
        {/* Cabeçalho mobile dentro do aside — com safe-area */}
        <div className="flex items-center justify-between border-b border-brand-800 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-agro-400 shadow-md shadow-agro-500/20">
              <ExcavatorIcon size={22} className="text-black" />
            </div>
            <div>
              <div className="text-sm font-bold leading-none text-white">CRM DO EDY</div>
              <div className="mt-0.5 text-[10px] text-agro-400">New Holland · Dynapac</div>
            </div>
          </div>
          <button
            onClick={fechar}
            className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-800 hover:text-white active:scale-95 transition-transform"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Logo — desktop only */}
        <div className="hidden items-center gap-3 px-5 py-5 md:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-agro-400 shadow-md shadow-agro-500/20">
            <ExcavatorIcon size={22} className="text-black" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-white">CRM DO EDY</div>
            <div className="mt-0.5 text-[10px] text-agro-400">New Holland · Dynapac</div>
          </div>
        </div>

        {/* Divisor desktop */}
        <div className="mx-4 hidden border-t border-brand-800 md:block" />

        {/* Botão de reorganizar menu */}
        <div className="px-4 pt-2">
          <button
            onClick={() => setReorganizando((v) => !v)}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
              reorganizando ? "bg-agro-400 text-black" : "text-brand-400 hover:bg-white/5 hover:text-white"
            )}
          >
            {reorganizando ? <Check size={13} /> : <ArrowUpDown size={13} />}
            {reorganizando ? "Concluir reorganização" : "Reorganizar menu"}
          </button>
        </div>

        {/* Nav com grupos — scroll isolado aqui */}
        <nav
          className="flex-1 overflow-y-auto py-3 scrollbar-none"
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {reorganizando ? (
            <div className="px-3">
              <p className="mb-2 px-2 text-[11px] text-brand-400">Arraste pelo ícone para reordenar.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={itensOrdenados.map((i) => i.href)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {itensOrdenados.map((item) => (
                      <ItemArrastavel key={item.href} item={item} ativo={hrefAtivo(pathname, item.href)} fechar={fechar} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ) : ordem.length ? (
            <div className="px-3">
              {itensOrdenados.map(({ href, label, icon: Icon }) => {
                const ativo = hrefAtivo(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={fechar}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      ativo
                        ? "bg-white/15 text-white"
                        : "text-brand-300 hover:bg-white/10 hover:text-white active:bg-white/20"
                    )}
                  >
                    <Icon
                      size={17}
                      className={cn(
                        "shrink-0 transition-colors",
                        ativo ? "text-agro-400" : "text-brand-400 group-hover:text-brand-200"
                      )}
                    />
                    <span className="truncate">{label}</span>
                    {ativo && <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-agro-400" />}
                  </Link>
                );
              })}
            </div>
          ) : (
            grupos.map((grupo) => (
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
                      onClick={fechar}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        ativo
                          ? "bg-white/15 text-white"
                          : "text-brand-300 hover:bg-white/10 hover:text-white active:bg-white/20"
                      )}
                    >
                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
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
            ))
          )}
          {/* Espaço extra no final para safe-area inferior (iPhone) */}
          <div className="h-[env(safe-area-inset-bottom,1rem)]" />
        </nav>

        {/* Rodapé desktop */}
        <div className="hidden border-t border-brand-800 px-5 py-4 md:block">
          <div className="text-[10px] text-brand-500">Vendas com IA · Sul do ES</div>
        </div>
      </aside>
    </>
  );
}
