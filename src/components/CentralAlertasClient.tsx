"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { resolverAlerta, resolverVariosAlertasAction, registrarContatoPosVenda, ocultarItemCentralAction, ocultarVariosItensCentralAction } from "@/lib/actions";
import type { GrupoCentral, ItemCentral, SeveridadeAlerta, GraficosCentral } from "@/lib/central-alertas";
import { PosVendaModal } from "@/components/PosVendaClient";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, ArrowRight, Loader2, MessageSquareQuote, Clock, Compass, HeartHandshake, MapPin, ListTodo, ShieldCheck, Target, MessageCircle, History, Snowflake, Route } from "lucide-react";

const ICONE_GRUPO: Record<string, typeof Bell> = {
  rascunhos: MessageSquareQuote, aguardando: Clock, semcontato: Snowflake, visitar: Route, comerciais: Compass, posvenda: HeartHandshake, visitas: MapPin, demandas: ListTodo, meta: Target, sistema: ShieldCheck,
};
const COR_GRUPO: Record<string, string> = {
  rascunhos: "#ffcb2d", aguardando: "#fb923c", semcontato: "#facc15", visitar: "#22d3ee", comerciais: "#a78bfa", posvenda: "#f472b6", visitas: "#38bdf8", demandas: "#34d399", meta: "#f87171", sistema: "#94a3b8",
};
const COR_SEV: Record<SeveridadeAlerta, string> = { alta: "border-l-red-500", media: "border-l-amber-400", baixa: "border-l-slate-300" };
const ROTULO_SEV: Record<SeveridadeAlerta, { texto: string; classe: string }> = {
  alta: { texto: "urgente", classe: "bg-red-100 text-red-700" },
  media: { texto: "hoje", classe: "bg-amber-100 text-amber-700" },
  baixa: { texto: "quando puder", classe: "bg-slate-100 text-slate-500" },
};

function waLink(item: ItemCentral): string | null {
  const d = (item.telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const numero = d.startsWith("55") ? d : `55${d}`;
  const primeiro = (item.clienteNome ?? "").trim().split(" ")[0];
  const saudacao = primeiro && !/^\d/.test(primeiro) ? `Olá ${primeiro}, tudo bem?` : "Olá, tudo bem?";
  const texto = item.posVenda
    ? `${saudacao} Passando para saber como está a máquina e se precisa de alguma coisa.`
    : `${saudacao} Aqui é o Edy, da New Holland Construction.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function CentralAlertasClient({ grupos, graficos, grupoInicial }: { grupos: GrupoCentral[]; graficos: GraficosCentral; grupoInicial: string | null }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<string>(grupoInicial && grupos.some((g) => g.id === grupoInicial) ? grupoInicial : "todos");
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [modalPosVenda, setModalPosVenda] = useState<ItemCentral["posVenda"] | null>(null);
  const [, startTransition] = useTransition();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (grupoInicial) setFiltro(grupoInicial); }, [grupoInicial]);
  // Cancela o refresh pendente se a tela for trocada no meio (evita refresh
  // "perdido" depois que o componente já saiu de cena).
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  const visiveis = grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !resolvidos.has(i.id)) }))
    .filter((g) => g.itens.length > 0 && (filtro === "todos" || g.id === filtro));
  const totalVisivel = grupos.reduce((s, g) => s + g.itens.filter((i) => !resolvidos.has(i.id)).length, 0);
  const urgentes = grupos.reduce((s, g) => s + g.itens.filter((i) => !resolvidos.has(i.id) && i.severidade === "alta").length, 0);

  const criados14 = graficos.tendencia.reduce((s, d) => s + d.criados, 0);
  const resolvidos14 = graficos.tendencia.reduce((s, d) => s + d.resolvidos, 0);

  // Só busca a lista atualizada do servidor um tempinho depois do último
  // clique — resolver vários itens em sequência (ex.: os 39 "aguardando")
  // não dispara uma busca pesada a cada clique, só uma no final. A tela já
  // está certa antes disso (otimista), então não há pressa nenhuma.
  function agendarRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => startTransition(() => router.refresh()), 900);
  }

  // Tenta a mutação até 3x (a Neon "dorme" e o primeiro request pode falhar
  // por timeout) antes de desistir — evita o alerta "piscar" de volta.
  async function comRetentativa(fn: () => Promise<{ ok: boolean } | void>): Promise<boolean> {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const r = await fn();
        if (!r || r.ok !== false) return true;
      } catch {
        // segue para a próxima tentativa
      }
      if (tentativa < 3) await new Promise((res) => setTimeout(res, 700 * tentativa));
    }
    return false;
  }

  // "Resolvido" em qualquer item: some da lista NA HORA (otimista) — o
  // servidor confirma (com retentativa) por trás, sem travar a tela. No
  // pós-venda com marco pendente, "Resolvido" também registra o marco como
  // cumprido (era o antigo botão "Marco feito", que fazia a mesma coisa).
  async function resolver(item: ItemCentral) {
    setResolvidos((s) => new Set(s).add(item.id));
    const marco = item.posVenda?.marcoPendente;
    const ok = await comRetentativa(async () => {
      if (item.alertaId) return resolverAlerta(item.alertaId);
      if (marco && item.posVenda) await registrarContatoPosVenda(item.posVenda.clienteId, marco.tipo, `Marco de ${marco.label} cumprido.`);
      return ocultarItemCentralAction(item.id, item.clienteId ?? null);
    });
    if (!ok) {
      // Falhou de verdade (não só um soluço passageiro): volta a aparecer.
      setResolvidos((s) => { const n = new Set(s); n.delete(item.id); return n; });
      return;
    }
    agendarRefresh();
  }

  // "Resolver todos" de um grupo inteiro (ex.: os 50+ "aguardando resposta"
  // atrasados) de uma vez, em lote — sem clicar item por item.
  const [resolvendoGrupo, setResolvendoGrupo] = useState<string | null>(null);
  async function resolverTodosDoGrupo(grupo: GrupoCentral) {
    const itens = grupo.itens.filter((i) => !resolvidos.has(i.id));
    if (!itens.length) return;
    setResolvendoGrupo(grupo.id);
    setResolvidos((s) => { const n = new Set(s); itens.forEach((i) => n.add(i.id)); return n; });
    const comAlerta = itens.filter((i) => i.alertaId).map((i) => i.alertaId!);
    const semAlerta = itens.filter((i) => !i.alertaId).map((i) => ({ chave: i.id, clienteId: i.clienteId ?? null }));
    const ok = await comRetentativa(async () => {
      const [r1, r2] = await Promise.all([
        comAlerta.length ? resolverVariosAlertasAction(comAlerta) : Promise.resolve({ ok: true }),
        semAlerta.length ? ocultarVariosItensCentralAction(semAlerta) : Promise.resolve({ ok: true, total: 0 }),
      ]);
      return { ok: r1.ok !== false && r2.ok !== false };
    });
    setResolvendoGrupo(null);
    if (!ok) {
      setResolvidos((s) => { const n = new Set(s); itens.forEach((i) => n.delete(i.id)); return n; });
      return;
    }
    agendarRefresh();
  }

  return (
    <div>
      {/* Resumo + gráficos */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { rotulo: "Pendentes agora", valor: totalVisivel, cor: "text-slate-900" },
          { rotulo: "Urgentes", valor: urgentes, cor: urgentes ? "text-red-600" : "text-slate-900" },
          { rotulo: "Alertas criados · 14 dias", valor: criados14, cor: "text-slate-900" },
          { rotulo: "Resolvidos · 14 dias", valor: resolvidos14, cor: "text-emerald-600" },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className={cn("text-2xl font-black", k.cor)}>{k.valor}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.rotulo}</div>
          </div>
        ))}
      </div>

      {totalVisivel === 0 ? (
        <EmptyState icone={<Bell size={28} />} texto="Nenhum alerta pendente" subtexto="Clientes aguardando resposta, 30+ dias sem contato, negócios sem visita, alertas do ZEUS, pós-venda, visitas e demandas aparecem aqui assim que precisarem de você." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setFiltro("todos")} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", filtro === "todos" ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
              Todos · {totalVisivel}
            </button>
            {grupos.map((g) => {
              const n = g.itens.filter((i) => !resolvidos.has(i.id)).length;
              if (!n) return null;
              const Icon = ICONE_GRUPO[g.id] ?? Bell;
              return (
                <button key={g.id} onClick={() => setFiltro(g.id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", filtro === g.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
                  <Icon size={13} /> {g.titulo} · {n}
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {visiveis.map((g) => {
              const Icon = ICONE_GRUPO[g.id] ?? Bell;
              return (
                <section key={g.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Icon size={16} style={{ color: COR_GRUPO[g.id] ?? "#475569" }} />
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-200">{g.titulo}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{g.itens.length}</span>
                    {g.itens.length > 1 && (
                      <button onClick={() => resolverTodosDoGrupo(g)} disabled={resolvendoGrupo === g.id}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-100 disabled:opacity-60">
                        {resolvendoGrupo === g.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Resolver todos ({g.itens.length})
                      </button>
                    )}
                  </div>
                  <p className="mb-2 text-xs text-slate-400">{g.descricao}</p>
                  <Card className="divide-y divide-slate-100 p-0">
                    {g.itens.map((item) => {
                      const wa = waLink(item);
                      return (
                        // No celular os botões vão para a linha de baixo e ocupam a
                        // largura toda (quebrando em duas linhas se precisar);
                        // em tela larga ficam à direita do texto.
                        <div key={item.id} className={cn("flex flex-col gap-2 border-l-4 px-3 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4", COR_SEV[item.severidade])}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="break-words font-semibold text-slate-800">{item.titulo}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", ROTULO_SEV[item.severidade].classe)}>{ROTULO_SEV[item.severidade].texto}</span>
                            </div>
                            {item.detalhe && <p className="mt-0.5 break-words text-sm text-slate-600">{item.detalhe}</p>}
                            {item.quando && <p className="mt-0.5 text-[11px] text-slate-400">{item.quando}</p>}
                          </div>
                          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                            {item.posVenda ? (
                              <button onClick={() => setModalPosVenda(item.posVenda ?? null)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800">
                                <History size={13} /> Histórico e contato
                              </button>
                            ) : (
                              <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800">
                                {item.hrefLabel} <ArrowRight size={13} />
                              </Link>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
                                <MessageCircle size={13} /> WhatsApp
                              </a>
                            )}
                            <button
                              onClick={() => resolver(item)}
                              disabled={ocupado === item.id}
                              title={item.alertaId ? "Marcar como resolvido" : item.posVenda?.marcoPendente ? "Registra o marco como cumprido e tira da lista" : "Tira da lista de vez"}
                              className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60"
                            >
                              {ocupado === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Resolvido
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </section>
              );
            })}
          </div>
        </>
      )}

      {modalPosVenda && <PosVendaModal item={modalPosVenda} onClose={() => { setModalPosVenda(null); startTransition(() => router.refresh()); }} />}
    </div>
  );
}
