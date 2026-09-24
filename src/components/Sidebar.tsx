
"use client";

import Link from "next/link";
import { INTERVALO_ALERTAS } from "@/lib/intervalos-atualizacao";
import { usePathname } from "next/navigation";
import { Menu, X, GripVertical, ArrowUpDown, Check } from "lucide-react";
import { LogoEscavadeira } from "@/components/icons";
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
        // select-none: sem isto, segurar o dedo na linha para arrastar começa a
        // selecionar o texto do item em vez de mover.
        "group flex select-none items-center gap-2 rounded-xl px-2 py-1 text-sm font-medium",
        ativo ? "bg-[var(--menu-ativo)] text-[var(--menu-texto)]" : "text-[var(--menu-texto2)]"
      )}
    >
      {/* A alça tinha 23px — abaixo do mínimo de 48 que o dedo acerta, e ele
          usa o CRM na rua. Grande no celular, compacta no computador, onde o
          ponteiro é preciso e o espaço do menu é mais curto. */}
      <span
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${item.label}`}
        className="flex h-12 w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--menu-mudo2)] active:cursor-grabbing active:bg-[var(--menu-hover)] md:h-8 md:w-8"
      >
        <GripVertical size={20} className="md:h-4 md:w-4" />
      </span>
      <Icon size={17} className="shrink-0 text-[var(--menu-mudo)]" />
      <span className="truncate">{item.label}</span>
    </div>
  );
}

// Contador da Central de alertas (badge no item "Alertas"), atualizado a cada
// minuto e sempre que a rota muda.
function ContadorAlertas({ href, total, alta }: { href: string; total: number; alta: number }) {
  if (href !== "/alertas" || total <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none",
        alta > 0 ? "bg-red-500 text-white" : "bg-agro-400 text-black"
      )}
      title={`${total} alerta(s)${alta ? ` · ${alta} urgente(s)` : ""}`}
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}

export function Sidebar({ nome = "CRM DO EDY", sub = "New Holland · Dynapac" }: { nome?: string; sub?: string } = {}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<string[]>([]);
  const [reorganizando, setReorganizando] = useState(false);
  const [alertas, setAlertas] = useState<{ total: number; alta: number }>({ total: 0, alta: 0 });

  useEffect(() => {
    let ativo = true;
    const carregar = () => {
      fetch("/api/alertas/contagem", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (ativo && j && typeof j.total === "number") setAlertas({ total: j.total, alta: Number(j.alta) || 0 }); })
        .catch(() => {});
    };
    carregar();
    // Aba escondida não chama: a rota consulta o banco (docs/consumo-invocacoes.md).
    const timer = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, INTERVALO_ALERTAS);
    return () => { ativo = false; clearInterval(timer); };
  }, [pathname]);

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
      <div id="topbar-mobile" className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--menu-borda)] bg-[var(--menu-fundo)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-[var(--menu-texto)] md:hidden">
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white">
            <LogoEscavadeira size={28} />
          </div>
          {nome}
        </div>
        <button
          onClick={() => setAberto((v) => !v)}
          className="rounded-lg p-1.5 hover:bg-[var(--menu-hover)] active:scale-95 transition-transform"
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
          "bg-[var(--menu-fundo)] text-[var(--menu-texto)] shadow-2xl",
          // Desktop: sticky, com altura travada na viewport para o <nav> interno
          // rolar sozinho (sem isso, o menu rolava junto com a página).
          "md:sticky md:top-0 md:z-30 md:h-screen md:max-h-screen md:w-64 md:overflow-hidden md:shadow-none md:bg-gradient-to-b md:from-[var(--menu-fundo)] md:to-[var(--menu-fundo2)]",
          // Animação mobile
          "transition-transform duration-300 ease-in-out md:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full"
        )}
        // Permite scroll independente no aside (mobile)
        style={{ touchAction: "pan-y" }}
      >
        {/* Cabeçalho mobile dentro do aside — com safe-area */}
        <div className="flex items-center justify-between border-b border-[var(--menu-borda)] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-agro-500/20">
              <LogoEscavadeira size={36} />
            </div>
            <div>
              <div className="text-sm font-bold leading-none text-[var(--menu-texto)]">{nome}</div>
              <div className="mt-0.5 text-[10px] text-agro-400">{sub}</div>
            </div>
          </div>
          <button
            onClick={fechar}
            className="rounded-lg p-1.5 text-[var(--menu-mudo)] hover:bg-[var(--menu-hover)] hover:text-[var(--menu-texto)] active:scale-95 transition-transform"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Logo — desktop only */}
        <div className="hidden items-center gap-3 px-5 py-5 md:flex">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-agro-500/20">
            <LogoEscavadeira size={36} />
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-[var(--menu-texto)]">{nome}</div>
            <div className="mt-0.5 text-[10px] text-agro-400">{sub}</div>
          </div>
        </div>

        {/* Divisor desktop */}
        <div className="mx-4 hidden border-t border-[var(--menu-borda)] md:block" />

        {/* Botão de reorganizar menu */}
        <div className="px-4 pt-2">
          <button
            onClick={() => setReorganizando((v) => !v)}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
              reorganizando ? "bg-agro-400 text-black" : "text-[var(--menu-mudo)] hover:bg-[var(--menu-hover)] hover:text-[var(--menu-texto)]"
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
              <p className="mb-2 px-2 text-[11px] text-[var(--menu-mudo)]">Arraste pelo ícone para reordenar.</p>
              <DndContext id="dnd-sidebar" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                        ? "bg-[var(--menu-ativo)] text-[var(--menu-texto)]"
                        : "text-[var(--menu-texto2)] hover:bg-[var(--menu-hover)] hover:text-[var(--menu-texto)] active:bg-[var(--menu-pressionado)]"
                    )}
                  >
                    <Icon
                      size={17}
                      className={cn(
                        "shrink-0 transition-colors",
                        ativo ? "text-[var(--menu-destaque)]" : "text-[var(--menu-mudo)] group-hover:text-[var(--menu-texto)]"
                      )}
                    />
                    <span className="truncate">{label}</span>
                    <ContadorAlertas href={href} total={alertas.total} alta={alertas.alta} />
                    {ativo && <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-agro-400" />}
                  </Link>
                );
              })}
            </div>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.label} className="mb-1 px-3">
                <div className="mb-1 mt-3 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--menu-mudo2)]">
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
                          ? "bg-[var(--menu-ativo)] text-[var(--menu-texto)]"
                          : "text-[var(--menu-texto2)] hover:bg-[var(--menu-hover)] hover:text-[var(--menu-texto)] active:bg-[var(--menu-pressionado)]"
                      )}
                    >
                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
                          ativo ? "text-[var(--menu-destaque)]" : "text-[var(--menu-mudo)] group-hover:text-[var(--menu-texto)]"
                        )}
                      />
                      <span className="truncate">{label}</span>
                      <ContadorAlertas href={href} total={alertas.total} alta={alertas.alta} />
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
        <div className="hidden border-t border-[var(--menu-borda)] px-5 py-4 md:block">
          <div className="text-[10px] text-[var(--menu-mudo2)]">Vendas com IA · Sul do ES</div>
        </div>
      </aside>
    </>
  );
}
