import { db } from "@/lib/db";
import { diasDesde, saudacaoBrasilia } from "@/lib/utils";
import { PipelineChart } from "@/components/charts";
import { comissaoConfirmada, classificarLead, COR_CLASSE, ESTAGIO_VENDAS_CONFIRMADAS } from "@/lib/insights";
import { ESTAGIOS, normalizarEstagio, ROTULO_ESTAGIO } from "@/lib/pipeline";
import { MotivacaoWidget, DicaVendas } from "@/components/MotivacaoWidget";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import Link from "next/link";
import {
Target, TrendingUp, AlertTriangle, Clock, DollarSign, Users,
Bell, Snowflake, CheckCircle2, ArrowRight, MessageCircle, UserX,
MapPin, Calendar, Trophy, BarChart3, Zap, Eye,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Dark palette ──────────────────────────────────────────────────────────────
// Surface: #09090b (zinc-950) | Card: #18181b (zinc-900) | Border: #27272a
// Text: #fafafa / #a1a1aa / #71717a
// Accents: #BFDE4D agro | #22c55e green | #f59e0b amber | #f87171 red | #60a5fa blue

const DESPEDIDA_RE =
/\b(obrigad[ao]|valeu|até logo|tchau|tchauzinho|boa noite|boa tarde|bom dia(?! pessoal)|até mais|abraços?|foi um prazer|tudo certo|combinado|fechado|até amanhã|até segunda|pode ser|ok obrigad[ao])\b/i;

export default async function DashboardPage() {
const hoje = new Date();
const anoAtual = hoje.getFullYear();
const inicioAno = new Date(anoAtual, 0, 1);
const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0);
const fimDia = new Date(hoje); fimDia.setHours(23, 59, 59, 999);
const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay()); inicioSemana.setHours(0, 0, 0, 0);
const inicioMes = new Date(anoAtual, hoje.getMonth(), 1);

const DIAS_ESQUECIDO = 15;
const corteEsquecido = new Date(hoje);
corteEsquecido.setDate(corteEsquecido.getDate() - DIAS_ESQUECIDO);

const [
metas, alertas, negociacoes, clientesCount,
aguardando, clientesAguardandoRaw, esquecidos, futuros,
// Visitas por período
visitasHoje, visitasSemana, visitasMes, visitasAno,
// Conversas por período
conversasHoje, conversasSemana, conversasMes, conversasAno,
// Vendas por período
vendasHoje, vendasSemana, vendasMes, vendasGanhasAno,
// Valor financeiro
valorVendasAno,
// Demandas de hoje
demandasHoje,
// Próximas visitas agendadas
proximasVisitas,
faturadas,
] = await Promise.all([
db.meta.findMany({ orderBy: { criadoEm: "asc" } }),
db.alerta.findMany({
where: { resolvido: false },
include: { cliente: true },
orderBy: { diasDesde: "desc" },
}),
db.negociacao.findMany({ where: { status: "aberta" }, include: { cliente: true } }),
db.cliente.count(),
db.negociacao.findMany({
where: { status: "aberta" },
include: { cliente: true },
orderBy: { ultimoContato: "asc" },
}),
db.cliente.findMany({
where: { aguardandoResposta: true },
include: {
conversas: { orderBy: { criadoEm: "desc" }, take: 1 },
},
orderBy: { ultimoContato: "asc" },
}),
db.negociacao.findMany({
where: { status: "aberta", ultimoContato: { lt: corteEsquecido } },
include: { cliente: true },
orderBy: { ultimoContato: "asc" },
take: 8,
}),
db.cliente.findMany({
where: { interesseFuturo: true },
orderBy: { interesseFuturoData: "asc" },
take: 12,
select: { id: true, nome: true, interesseFuturoData: true, interesseFuturoNota: true },
}),
// Visitas
db.visita.count({ where: { data: { gte: inicioDia, lte: fimDia } } }),
db.visita.count({ where: { data: { gte: inicioSemana } } }),
db.visita.count({ where: { data: { gte: inicioMes } } }),
db.visita.count({ where: { data: { gte: inicioAno } } }),
// Conversas (clientes únicos — com quem interagi)
db.whatsAppConversation.count({ where: { lastMessageAt: { gte: inicioDia } } }).catch(() => 0),
db.whatsAppConversation.count({ where: { lastMessageAt: { gte: inicioSemana } } }).catch(() => 0),
db.whatsAppConversation.count({ where: { lastMessageAt: { gte: inicioMes } } }).catch(() => 0),
db.whatsAppConversation.count({ where: { lastMessageAt: { gte: inicioAno } } }).catch(() => 0),
// Vendas fechadas
db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioDia } } }),
db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioSemana } } }),
db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioMes } } }),
db.negociacao.count({ where: { status: "ganha", atualizadoEm: { gte: inicioAno } } }),
// Valor total vendido no ano
db.negociacao.aggregate({
where: { status: "ganha", atualizadoEm: { gte: inicioAno } },
_sum: { valor: true },
}),
// Demandas de hoje (com dueDate definida para hoje)
db.tarefaKanban.count({ where: { dueDate: { gte: inicioDia, lte: fimDia } } }).catch(() => 0),
// Próximas visitas (30 dias)
db.cliente.findMany({
where: {
proximaVisita: { gte: hoje, lte: new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000) },
},
select: { id: true, nome: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
orderBy: { proximaVisita: "asc" },
take: 5,
}),
// Negociações faturadas
db.negociacao.findMany({ where: { status: "ganha" }, include: { cliente: { select: { nome: true } } }, orderBy: { faturadoEm: "desc" } }),
]);
// Dados faturadas no mês atual
const faturadoMes = (faturadas as any[]).filter(n => {
  const d = n.faturadoEm ? new Date(n.faturadoEm) : null;
  return d && d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
});
const valorFaturadoMes = faturadoMes.reduce((s: number, n: any) => s + (n.valor ?? 0), 0);
const comissoesMes = valorFaturadoMes * 0.005;

// Top 5 para atacar hoje (Fase 5.1 — lead scoring recalculado pelo ZEUS)
const topAtacar = await db.cliente.findMany({
where: { OR: [{ negociacoes: { some: { status: "aberta" } } }, { aguardandoResposta: true }] },
orderBy: { leadScore: "desc" },
take: 5,
select: {
id: true, nome: true, leadScore: true, aguardandoResposta: true,
municipio: { select: { nome: true } },
negociacoes: { where: { status: "aberta" }, orderBy: { termometro: "desc" }, take: 1, select: { maquinaModelo: true, valor: true, proximaAcao: true } },
},
});

// "Chegou a hora": interesse futuro dentro de 30 dias
const em30Dias = new Date(hoje);
em30Dias.setDate(em30Dias.getDate() + 30);
const futurosNaHora = futuros.filter(
(f) => f.interesseFuturoData && f.interesseFuturoData <= em30Dias
).length;

const saudacao = saudacaoBrasilia(hoje);
const metasAbertas = metas.filter((m) => m.progresso < m.alvo).length;

const META_ANUAL = 40;
const faltamVendas = Math.max(0, META_ANUAL - vendasGanhasAno);

const valorPipeline = negociacoes.reduce((s, n) => s + (n.valor ?? 0), 0);
const comissao = comissaoConfirmada(negociacoes);
const leadsEsfriando = negociacoes.filter((n) => classificarLead(n).esfriando).slice(0, 6);
const porEstagio = ESTAGIOS.map((e) => ({
estagio: e.id,
total: negociacoes.filter((n) => normalizarEstagio(n.estagio) === e.id).length,
}));
const aguardandoFiltrado = aguardando.filter((n) => diasDesde(n.ultimoContato) >= 3);
const filaAguardando = aguardandoFiltrado.slice(0, 6);

const clientesAguardando = clientesAguardandoRaw
.filter((c) => {
const ultima = c.conversas[0];
if (!ultima) return true;
if (ultima.remetente === "vendedor") return false;
return !DESPEDIDA_RE.test(ultima.conteudo);
})
.slice(0, 8);

const valorVendasAnoNum = valorVendasAno._sum?.valor ?? 0;
const mesAtual = hoje.toLocaleString("pt-BR", { month: "long" });
const diaDoAno = Math.ceil((hoje.getTime() - inicioAno.getTime()) / 86400000);
const diasRestantesAno = 365 - diaDoAno;
const ritmoMensal = vendasGanhasAno > 0 ? (vendasGanhasAno / (hoje.getMonth() + 1)).toFixed(1) : "0";

return (
<div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-4 md:-m-8 md:p-6 space-y-5">
{/* ── Saudação + Atualizar ── */}
<div className="flex items-center justify-between">
<div>
<h1 className="text-2xl font-black text-white">{saudacao} 👋</h1>
<p className="text-xs text-zinc-500 mt-0.5">
{hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {hoje.getFullYear()}
</p>
</div>
<BotaoAtualizar />
</div>

<MotivacaoWidget />

{/* ── Top 5 para Atacar Hoje (Fase 5 — lead scoring) ── */}
{topAtacar.length > 0 && (
<section>
<SectionLabel icone={<Target size={16} />} cor="#f87171">Top 5 para Atacar Hoje</SectionLabel>
<div className="space-y-2">
{topAtacar.map((c) => {
const neg = c.negociacoes[0];
return (
<Link key={c.id} href={"/clientes/" + c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
{c.leadScore}
</span>
<div className="min-w-0 flex-1">
<p className="text-sm font-semibold text-white truncate">{c.nome}</p>
<p className="text-xs text-zinc-500 truncate">
{neg?.proximaAcao ?? (c.aguardandoResposta ? "Aguardando seu retorno no WhatsApp" : (neg?.maquinaModelo ?? "Definir próxima ação"))}
{c.municipio ? ` · ${c.municipio.nome}` : ""}
</p>
</div>
<ArrowRight size={14} className="text-zinc-600" />
</Link>
);
})}
</div>
</section>
)}

{/* ── BLOCO 1: Visitas ── */}
<Section titulo="🚗 Visitas Realizadas" cor="#60a5fa">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<KpiCard titulo="Hoje" valor={visitasHoje} cor="#60a5fa" sub="visita(s)" />
<KpiCard titulo="Semana" valor={visitasSemana} cor="#60a5fa" sub="visita(s)" />
<KpiCard titulo={mesAtual} valor={visitasMes} cor="#60a5fa" sub="visita(s)" />
<KpiCard titulo={String(anoAtual)} valor={visitasAno} cor="#60a5fa" sub="visita(s)" />
</div>
</Section>

{/* ── BLOCO 2: Conversas WhatsApp ── */}
<Section titulo="💬 Conversas WhatsApp" cor="#BFDE4D">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<KpiCard titulo="Hoje" valor={conversasHoje} cor="#BFDE4D" sub="conversa(s)" />
<KpiCard titulo="Semana" valor={conversasSemana} cor="#BFDE4D" sub="conversa(s)" />
<KpiCard titulo={mesAtual} valor={conversasMes} cor="#BFDE4D" sub="conversa(s)" />
<KpiCard titulo={String(anoAtual)} valor={conversasAno} cor="#BFDE4D" sub="conversa(s)" />
</div>
</Section>

{/* ── BLOCO 3b: Demandas de Hoje ── */}
<Section titulo="📋 Demandas de Hoje" cor="#f59e0b">
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <KpiCard titulo="Hoje" valor={demandasHoje} sub="demanda(s)" cor="amber" />
  </div>
</Section>

{/* ── BLOCO 3: Vendas Fechadas ── */}
<Section titulo="🏆 Vendas Fechadas" cor="#4ade80">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<KpiCard titulo="Hoje" valor={vendasHoje} cor="#4ade80" sub="venda(s)" />
<KpiCard titulo="Semana" valor={vendasSemana} cor="#4ade80" sub="venda(s)" />
<KpiCard titulo={mesAtual} valor={vendasMes} cor="#4ade80" sub="venda(s)" />
<KpiCard titulo={String(anoAtual)} valor={vendasGanhasAno} cor="#4ade80" sub={<><span style={{ color: "#4ade80", fontSize: 11 }}>R$ {valorVendasAnoNum.toLocaleString("pt-BR")}</span></>} />
</div>

{/* ── BLOCO: Negociações Faturadas (novo) ── */}
<Section titulo="📦 Negociações Faturadas" cor="#f59e0b">
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <KpiCard titulo={mesAtual} valor={faturadoMes.length} cor="#f59e0b" sub="faturadas" />
    <KpiCard titulo="Valor " valor={"R$ " + (valorFaturadoMes/1000).toFixed(0) + "k"} cor="#f59e0b" sub="valor mês" numerico={false} />
    <KpiCard titulo="Comissões" valor={"R$ " + comissoesMes.toLocaleString("pt-BR", {minimumFractionDigits:0,maximumFractionDigits:0})} cor="#a78bfa" sub="0,5% a receber" numerico={false} />
    <KpiCard titulo="Total hist." valor={(faturadas as any[]).length} cor="#4ade80" sub="desde sempre" />
  </div>
  <div className="mt-3 text-right">
    <a href="/financeiro" className="text-xs text-zinc-400 hover:text-white underline">Ver financeiro completo →</a>
  </div>
</Section>
</Section>

{/* ── BLOCO 4: Pipeline e Metas ── */}
<Section titulo="📊 Pipeline & Metas" cor="#f59e0b">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
<KpiCard titulo="Negoc. Abertas" valor={negociacoes.length} cor="#f59e0b" sub="em andamento" />
<KpiCard titulo="Valor Pipeline" valor={"R$ " + (valorPipeline / 1000).toFixed(0) + "k"} cor="#f59e0b" sub="estimado" numerico={false} />
<KpiCard titulo="Meta Anual" valor={<><span style={{ color: "#4ade80" }}>{vendasGanhasAno}</span><span style={{ color: "#71717a", fontSize: 13 }}>/{META_ANUAL}</span></>} cor="#BFDE4D" sub={faltamVendas + " para bater"} numerico={false} />
<KpiCard titulo="Ritmo Mensal" valor={ritmoMensal} cor="#a78bfa" sub="vendas/mês (média)" />
</div>
{/* Barra de progresso meta anual */}
<div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<div className="flex justify-between items-center mb-2">
<span className="text-xs text-zinc-400 font-semibold">Meta Anual: {vendasGanhasAno}/{META_ANUAL} vendas</span>
<span className="text-xs font-bold" style={{ color: "#BFDE4D" }}>{Math.round((vendasGanhasAno / META_ANUAL) * 100)}%</span>
</div>
<div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#27272a" }}>
<div
className="h-full rounded-full transition-all"
style={{ width: Math.min(100, (vendasGanhasAno / META_ANUAL) * 100) + "%", background: "linear-gradient(90deg, #BFDE4D, #22c55e)" }}
/>
</div>
<p className="text-xs text-zinc-600 mt-1.5">{diasRestantesAno} dias restantes no ano · {faltamVendas} vendas para a meta</p>
</div>
</Section>

{/* ── BLOCO 5: Alertas e Atenção ── */}
<Section titulo="⚠️ Atenção Necessária" cor="#f87171">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<KpiCard titulo="Aguard. WhatsApp" valor={clientesAguardando.length} cor="#f87171" sub="sem resposta" />
<KpiCard titulo="Leads Esquecidos" valor={esquecidos.length} cor="#f59e0b" sub={"15+ dias sem contato"} />
<KpiCard titulo="Interesse Futuro" valor={futuros.length} cor="#a78bfa" sub={futurosNaHora + " chegando (30d)"} />
<KpiCard titulo="Leads Esfriando" valor={leadsEsfriando.length} cor="#f87171" sub="termômetro baixo" />
</div>
</Section>

{/* ── Próximas Visitas Agendadas ── */}
{proximasVisitas.length > 0 && (
<section>
<SectionLabel icone={<Calendar size={16} />} cor="#60a5fa">Próximas Visitas Agendadas</SectionLabel>
<div className="space-y-2">
{proximasVisitas.map((v) => (
<div key={v.id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Calendar size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{v.nome}</p>
{v.municipio && <p className="text-xs text-zinc-500">{v.municipio.nome}</p>}
{v.proximaVisitaNota && <p className="text-xs text-zinc-400 truncate">{v.proximaVisitaNota}</p>}
</div>
<span className="text-xs font-bold whitespace-nowrap" style={{ color: "#60a5fa" }}>
{new Date(v.proximaVisita!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
</span>
</div>
))}
</div>
</section>
)}

{/* ── Aguardando resposta WhatsApp ── */}
{clientesAguardando.length > 0 && (
<section>
<SectionLabel icone={<MessageCircle size={16} />} cor="#f87171">Aguardando Resposta no WhatsApp</SectionLabel>
<div className="space-y-2">
{clientesAguardando.map((c) => (
<Link key={c.id} href={"/clientes/" + c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<MessageCircle size={16} style={{ color: "#f87171", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{c.nome}</p>
<p className="text-xs text-zinc-500">Aguardando resposta · {diasDesde(c.ultimoContato)}d sem contato</p>
</div>
<ArrowRight size={14} className="text-zinc-600" />
</Link>
))}
</div>
</section>
)}

{/* ── Leads esquecidos ── */}
{esquecidos.length > 0 && (
<section>
<SectionLabel icone={<Snowflake size={16} />} cor="#f59e0b">Leads Sem Contato (15+ dias)</SectionLabel>
<div className="space-y-2">
{esquecidos.map((n) => (
<Link key={n.id} href={"/clientes/" + n.clienteId} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Snowflake size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{n.cliente?.nome}</p>
<p className="text-xs text-zinc-500">{n.maquinaModelo ?? "Máquina não definida"} · há {diasDesde(n.ultimoContato)}d sem contato</p>
</div>
<ArrowRight size={14} className="text-zinc-600" />
</Link>
))}
</div>
</section>
)}

{/* ── Leads esfriando ── */}
{leadsEsfriando.length > 0 && (
<section>
<SectionLabel icone={<AlertTriangle size={16} />} cor="#f87171">Pipeline em Risco</SectionLabel>
<div className="space-y-2">
{leadsEsfriando.map((n) => {
const { classe, esfriando } = classificarLead(n);
return (
<Link key={n.id} href={"/pipeline"} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<span className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + COR_CLASSE[classe]} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{n.cliente?.nome}</p>
<p className="text-xs text-zinc-500">{n.maquinaModelo ?? "?"} · R$ {(n.valor ?? 0).toLocaleString("pt-BR")} · {ROTULO_ESTAGIO[n.estagio] ?? n.estagio}</p>
</div>
<span className="text-xs font-bold" style={{ color: "#f87171" }}>{n.termometro}%</span>
</Link>
);
})}
</div>
</section>
)}

{/* ── Aguardando na Fila ── */}
{filaAguardando.length > 0 && (
<section>
<SectionLabel icone={<Clock size={16} />} cor="#60a5fa">Fila de Follow-up</SectionLabel>
<div className="space-y-2">
{filaAguardando.map((n) => (
<Link key={n.id} href={"/pipeline"} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Clock size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{n.cliente?.nome}</p>
<p className="text-xs text-zinc-500">{n.maquinaModelo ?? "?"} · {n.proximaAcao ?? "Definir próxima ação"}</p>
</div>
<span className="text-xs text-zinc-500">{diasDesde(n.ultimoContato)}d</span>
</Link>
))}
</div>
</section>
)}

{/* ── Interesse Futuro chegando ── */}
{futurosNaHora > 0 && (
<section>
<SectionLabel icone={<Bell size={16} />} cor="#a78bfa">Chegou a Hora — Interesse Futuro</SectionLabel>
<div className="space-y-2">
{futuros
.filter((f) => f.interesseFuturoData && f.interesseFuturoData <= em30Dias)
.map((f) => (
<Link key={f.id} href={"/clientes/" + f.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Bell size={16} style={{ color: "#a78bfa", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{f.nome}</p>
<p className="text-xs text-zinc-500">{f.interesseFuturoNota ?? "Interesse futuro"}</p>
</div>
<span className="text-xs font-bold" style={{ color: "#a78bfa" }}>
{f.interesseFuturoData ? new Date(f.interesseFuturoData).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Em breve"}
</span>
</Link>
))}
</div>
</section>
)}

{/* ── Pipeline por estágio ── */}
<section>
<SectionLabel icone={<BarChart3 size={16} />} cor="#BFDE4D">Pipeline por Estágio</SectionLabel>
<PipelineChart data={porEstagio} dark />
</section>

{/* ── Alertas do CRM ── */}
{alertas.length > 0 && (
<section>
<SectionLabel icone={<Bell size={16} />} cor="#f59e0b">Alertas do Sistema</SectionLabel>
<div className="space-y-2">
{alertas.slice(0, 5).map((a) => (
<div key={a.id} className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<AlertTriangle size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white">{a.cliente?.nome}</p>
<p className="text-xs text-zinc-400">{a.mensagem}</p>
</div>
<Link href={"/clientes/" + a.clienteId} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#27272a", color: "#a1a1aa" }}>
Ver
</Link>
</div>
))}
</div>
</section>
)}

<DicaVendas />
</div>
);
}

// ── Componentes internos ───────────────────────────────────────────────────────

function Section({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
return (
<section className="space-y-2">
<h2 className="text-sm font-bold" style={{ color: cor }}>{titulo}</h2>
{children}
</section>
);
}

function KpiCard({
titulo, valor, cor, sub, numerico = true,
}: {
titulo: string;
valor: React.ReactNode;
cor: string;
sub?: React.ReactNode;
numerico?: boolean;
}) {
return (
<div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<p className="text-xs text-zinc-500 font-medium truncate">{titulo}</p>
<p className="text-2xl font-black leading-none" style={{ color: cor }}>{valor}</p>
{sub && <p className="text-xs text-zinc-600 leading-tight">{sub}</p>}
</div>
);
}

function SectionLabel({ children, icone, cor }: { children: React.ReactNode; icone?: React.ReactNode; cor?: string }) {
return (
<div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
{icone && <span style={{ color: cor }}>{icone}</span>}
{children}
</div>
);
}

function EmptyOk({ children }: { children: React.ReactNode }) {
return (
<div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
<CheckCircle2 size={17} style={{ color: "#4ade80" }} />
<span className="text-sm" style={{ color: "#86efac" }}>{children}</span>
</div>
);
}
