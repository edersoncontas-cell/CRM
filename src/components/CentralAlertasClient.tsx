"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { resolverAlerta, registrarContatoPosVenda, ocultarItemCentralAction } from "@/lib/actions";
import type { GrupoCentral, ItemCentral, SeveridadeAlerta, GraficosCentral } from "@/lib/central-alertas";
import { PosVendaModal } from "@/components/PosVendaClient";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, ArrowRight, Loader2, MessageSquareQuote, Clock, Compass, HeartHandshake, MapPin, ListTodo, ShieldCheck, Target, MessageCircle, History, BarChart3, Flame, Snowflake, Route } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from "recharts";

const ICONE_GRUPO: Record<string, typeof Bell> = {
  rascunhos: MessageSquareQuote, aguardando: Clock, atacar: Flame, semcontato: Snowflake, visitar: Route, comerciais: Compass, posvenda: HeartHandshake, visitas: MapPin, demandas: ListTodo, meta: Target, sistema: ShieldCheck,
};
const COR_GRUPO: Record<string, string> = {
  rascunhos: "#ffcb2d", aguardando: "#fb923c", atacar: "#f43f5e", semcontato: "#facc15", visitar: "#22d3ee", comerciais: "#a78bfa", posvenda: "#f472b6", visitas: "#38bdf8", demandas: "#34d399", meta: "#f87171", sistema: "#94a3b8",
};
const COR_SEV_HEX: Record<SeveridadeAlerta, string> = { alta: "#ef4444", media: "#f59e0b", baixa: "#cbd5e1" };
const COR_SEV: Record<SeveridadeAlerta, string> = { alta: "border-l-red-500", media: "border-l-amber-400", baixa: "border-l-slate-300" };
const ROTULO_SEV: Record<SeveridadeAlerta, { texto: string; classe: string }> = {
  alta: { texto: "urgente", classe: "bg-red-100 text-red-700" },
  media: { texto: "hoje", classe: "bg-amber-100 text-amber-700" },
  baixa: { texto: "quando puder", classe: "bg-slate-100 text-slate-500" },
};

function waLink(telefone: string | null | undefined, nome: string): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const numero = d.startsWith("55") ? d : `55${d}`;
  const texto = encodeURIComponent(`Olá ${nome.split(" ")[0]}, tudo bem? Passando para saber como está a máquina e se precisa de alguma coisa.`);
  return `https://wa.me/${numero}?text=${texto}`;
}

export function CentralAlertasClient({ grupos, graficos, grupoInicial }: { grupos: GrupoCentral[]; graficos: GraficosCentral; grupoInicial: string | null }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<string>(grupoInicial && grupos.some((g) => g.id === grupoInicial) ? grupoInicial : "todos");
  const [resolvidos, setResolvidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [modalPosVenda, setModalPosVenda] = useState<ItemCentral["posVenda"] | null>(null);
  const [mostrarGraficos, setMostrarGraficos] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => { if (grupoInicial) setFiltro(grupoInicial); }, [grupoInicial]);

  const visiveis = grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !resolvidos.has(i.id)) }))
    .filter((g) => g.itens.length > 0 && (filtro === "todos" || g.id === filtro));
  const totalVisivel = grupos.reduce((s, g) => s + g.itens.filter((i) => !resolvidos.has(i.id)).length, 0);
  const urgentes = grupos.reduce((s, g) => s + g.itens.filter((i) => !resolvidos.has(i.id) && i.severidade === "alta").length, 0);

  const dadosGrupo = useMemo(() => graficos.porGrupo.map((g) => ({ ...g, nome: g.grupo.replace(/ .*/, "") })), [graficos]);
  const criados14 = graficos.tendencia.reduce((s, d) => s + d.criados, 0);
  const resolvidos14 = graficos.tendencia.reduce((s, d) => s + d.resolvidos, 0);

  // "Resolvido" em qualquer item: some da lista NA HORA (otimista) — o
  // servidor só confirma depois, sem o usuário esperar o round-trip.
  async function resolver(item: ItemCentral) {
    setResolvidos((s) => new Set(s).add(item.id));
    try {
      if (item.alertaId) await resolverAlerta(item.alertaId);
      else await ocultarItemCentralAction(item.id, item.clienteId ?? null);
    } catch {
      // Falhou no servidor: volta a aparecer, já que não foi resolvido de verdade.
      setResolvidos((s) => { const n = new Set(s); n.delete(item.id); return n; });
      return;
    }
    startTransition(() => router.refresh());
  }

  async function marcoFeito(item: ItemCentral) {
    const p = item.posVenda;
    if (!p?.marcoPendente) return;
    setOcupado(item.id);
    await registrarContatoPosVenda(p.clienteId, p.marcoPendente.tipo, `Marco de ${p.marcoPendente.label} cumprido.`);
    setOcupado(null);
    setResolvidos((s) => new Set(s).add(item.id));
    startTransition(() => router.refresh());
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

      {totalVisivel > 0 && (
        <div className="mb-4">
          <button onClick={() => setMostrarGraficos((v) => !v)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><BarChart3 size={13} /> {mostrarGraficos ? "Ocultar gráficos" : "Mostrar gráficos"}</button>
          {mostrarGraficos && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Por tipo</div>
                <div style={{ height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrupo} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="nome" width={86} tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip formatter={(v: number, n: string) => [v, n === "total" ? "itens" : "urgentes"]} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]} onClick={(d) => setFiltro((d as { id: string }).id)} cursor="pointer">
                        {dadosGrupo.map((g) => <Cell key={g.id} fill={COR_GRUPO[g.id] ?? "#94a3b8"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Por urgência</div>
                <div className="flex items-center gap-3" style={{ height: 170 }}>
                  <div className="h-full w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={graficos.porSeveridade} dataKey="total" nameKey="severidade" innerRadius={42} outerRadius={70} paddingAngle={2}>
                          {graficos.porSeveridade.map((s) => <Cell key={s.severidade} fill={COR_SEV_HEX[s.severidade]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {graficos.porSeveridade.map((s) => (
                      <li key={s.severidade} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_SEV_HEX[s.severidade] }} /><span className="w-24 text-slate-600">{ROTULO_SEV[s.severidade].texto}</span><b className="text-slate-800">{s.total}</b></li>
                    ))}
                  </ul>
                </div>
              </Card>
              <Card>
                <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-slate-500">Alertas do ZEUS · 14 dias</div>
                <div style={{ height: 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graficos.tendencia} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="criados" name="criados" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                      <Area type="monotone" dataKey="resolvidos" name="resolvidos" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {totalVisivel === 0 ? (
        <EmptyState icone={<Bell size={28} />} texto="Nenhum alerta pendente" subtexto="Clientes aguardando resposta, top 5 para atacar, 30+ dias sem contato, negócios sem visita, alertas do ZEUS, pós-venda, visitas e demandas aparecem aqui assim que precisarem de você." />
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
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={16} style={{ color: COR_GRUPO[g.id] ?? "#475569" }} />
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">{g.titulo}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{g.itens.length}</span>
                  </div>
                  <p className="mb-2 text-xs text-slate-500">{g.descricao}</p>
                  <Card className="divide-y divide-slate-100 p-0">
                    {g.itens.map((item) => {
                      const wa = item.posVenda ? waLink(item.telefone, item.posVenda.nome) : null;
                      return (
                        <div key={item.id} className={cn("flex flex-wrap items-start gap-3 border-l-4 px-4 py-3", COR_SEV[item.severidade])}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-800">{item.titulo}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", ROTULO_SEV[item.severidade].classe)}>{ROTULO_SEV[item.severidade].texto}</span>
                            </div>
                            {item.detalhe && <p className="mt-0.5 text-sm text-slate-600">{item.detalhe}</p>}
                            {item.quando && <p className="mt-0.5 text-[11px] text-slate-400">{item.quando}</p>}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {item.posVenda ? (
                              <>
                                <button onClick={() => setModalPosVenda(item.posVenda ?? null)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800">
                                  <History size={13} /> Histórico e contato
                                </button>
                                {wa && (
                                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">
                                    <MessageCircle size={13} /> WhatsApp
                                  </a>
                                )}
                                {item.posVenda.marcoPendente && (
                                  <button onClick={() => marcoFeito(item)} disabled={ocupado === item.id} className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60">
                                    {ocupado === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Marco feito
                                  </button>
                                )}
                                <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cliente <ArrowRight size={13} /></Link>
                                <button onClick={() => resolver(item)} disabled={ocupado === item.id} title="Some da lista até o cliente falar de novo" className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60">
                                  {ocupado === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Resolvido
                                </button>
                              </>
                            ) : (
                              <>
                                <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800">
                                  {item.hrefLabel} <ArrowRight size={13} />
                                </Link>
                                <button onClick={() => resolver(item)} disabled={ocupado === item.id} title={item.alertaId ? "Marcar como resolvido" : "Some da lista até o cliente falar de novo"} className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60">
                                  {ocupado === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Resolvido
                                </button>
                              </>
                            )}
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
