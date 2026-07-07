import { db } from "@/lib/db";
import { diasDesde, saudacaoBrasilia, semCodigoPais } from "@/lib/utils";
import { ESTAGIO_VENDAS_CONFIRMADAS } from "@/lib/insights";
import { criarCategorizadorColunas } from "@/lib/pipeline";
import { DicaVendas, FraseMotivacional } from "@/components/MotivacaoWidget";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { CadastrarContatoWhatsApp } from "@/components/CadastrarContatoWhatsApp";
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

// Semana de segunda a domingo (para os quadros que zeram toda segunda-feira)
const diaSemanaAtual = hoje.getDay(); // 0=domingo ... 6=sábado
const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
const inicioSemanaSegunda = new Date(hoje); inicioSemanaSegunda.setDate(hoje.getDate() - deltaSegunda); inicioSemanaSegunda.setHours(0, 0, 0, 0);
const fimSemanaDomingo = new Date(inicioSemanaSegunda); fimSemanaDomingo.setDate(inicioSemanaSegunda.getDate() + 7);

// Janela de segunda a sábado (para o quadro "Novos Negócios", que zera todo domingo)
const ehDomingoHoje = diaSemanaAtual === 0;
const fimSemanaSabado = new Date(inicioSemanaSegunda); fimSemanaSabado.setDate(inicioSemanaSegunda.getDate() + 6); fimSemanaSabado.setHours(23, 59, 59, 999);

// Ano corrente completo (para a Meta Anual — só conta faturamento dentro do ano)
const fimAno = new Date(anoAtual + 1, 0, 1);

const DIAS_SEM_CONTATO = 30;
const corteSemContato = new Date(hoje);
corteSemContato.setDate(corteSemContato.getDate() - DIAS_SEM_CONTATO);

const [
metas, alertas, negociacoes, clientesCount,
clientesAguardandoRaw, futuros,
vendasGanhasAno,
// Demandas de hoje
demandasHoje,
// Próximas visitas agendadas
proximasVisitas,
// Metas semanais
visitasSemanaAgendadas, negociosCriadosSemana,
// WHATSAPP: clientes sem contato há 30+ dias, conversas sem cadastro
clientes30DiasSemContato, conversasSemCadastro,
municipios,
colunasFunil,
] = await Promise.all([
db.meta.findMany({ orderBy: { criadoEm: "asc" } }),
db.alerta.findMany({
where: { resolvido: false },
include: { cliente: true },
orderBy: { diasDesde: "desc" },
}),
db.negociacao.findMany({ where: { status: "aberta" }, include: { cliente: true } }),
db.cliente.count(),
db.cliente.findMany({
where: { aguardandoResposta: true },
include: {
conversas: { orderBy: { criadoEm: "desc" }, take: 1 },
},
orderBy: { ultimoContato: "asc" },
}),
db.cliente.findMany({
where: { interesseFuturo: true },
orderBy: { interesseFuturoData: "asc" },
take: 12,
select: { id: true, nome: true, interesseFuturoData: true, interesseFuturoNota: true },
}),
// Vendas faturadas DENTRO do ano corrente (por data de faturamento, não de atualização)
db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: inicioAno, lt: fimAno } } }),
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
// Visitas agendadas nesta semana (segunda a domingo) — zera toda segunda
db.visita.count({ where: { data: { gte: inicioSemanaSegunda, lt: fimSemanaDomingo } } }),
// Negociações criadas de segunda a sábado (zera todo domingo) — filtradas
// por coluna (EM NEGOCIAÇÃO/EM BANCO) mais abaixo, depois de saber os títulos reais
ehDomingoHoje ? Promise.resolve([]) : db.negociacao.findMany({
  where: { criadoEm: { gte: inicioSemanaSegunda, lte: fimSemanaSabado } },
  select: { estagio: true },
}),
// Clientes com 30+ dias sem contato (cadastro do cliente, não depende de negociação)
db.cliente.findMany({
  where: { ultimoContato: { lt: corteSemContato } },
  orderBy: { ultimoContato: "asc" },
  take: 8,
  select: { id: true, nome: true, ultimoContato: true },
}),
// Conversas de WhatsApp abertas sem cliente vinculado
db.whatsAppConversation.findMany({
  where: { clienteId: null, isGroup: false },
  orderBy: { lastMessageAt: "desc" },
  take: 8,
  select: { id: true, contactName: true, externalPhone: true, lastMessageAt: true },
}),
// Municípios (para o popup de "Cadastrar" nas conversas sem cadastro)
db.municipio.findMany({ select: { id: true, nome: true, foraDeArea: true }, orderBy: { nome: "asc" } }),
// Colunas reais do funil (para não contar negociações "órfãs" de colunas renomeadas/excluídas)
db.colunaFunil.findMany({ select: { titulo: true } }),
]);

const categorizarColunaPorTitulo = criarCategorizadorColunas(colunasFunil);

const novosNegociosSemana = negociosCriadosSemana.filter((n) => {
  const cat = categorizarColunaPorTitulo(n.estagio);
  return cat === "em_negociacao" || cat === "banco";
}).length;

// Top 5 para atacar hoje: clientes com atendimento no WhatsApp ainda ABERTO
// (não marcado "Atendimento encerrado" = aguardandoResposta ainda true),
// excluindo quem está classificado como "não cliente".
const topAtacar = await db.cliente.findMany({
where: { aguardandoResposta: true, status: { not: "nao_cliente" } },
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

// EM NEGOCIAÇÃO = ainda com o vendedor (contato/visita); EM BANCO = proposta no
// banco/BCNH. Classificado pelo TÍTULO real das colunas (Negociacao.estagio
// grava o título, que pode ter sido renomeado pelo usuário).
const emNegociacaoCount = negociacoes.filter((n) => categorizarColunaPorTitulo(n.estagio) === "em_negociacao").length;
const emBancoCount = negociacoes.filter((n) => categorizarColunaPorTitulo(n.estagio) === "banco").length;

// Meta Anual: quantas máquinas em média preciso vender por mês até dezembro
const mesesRestantesAno = Math.max(1, 12 - hoje.getMonth());
const mediaNecessariaPorMes = (faltamVendas / mesesRestantesAno).toFixed(1);

// Negócios em aberto (EM NEGOCIAÇÃO/EM BANCO) que ainda não têm visita marcada
const precisamDeVisita = negociacoes
.filter((n) => {
const cat = categorizarColunaPorTitulo(n.estagio);
return (cat === "em_negociacao" || cat === "banco") && !n.dataVisita;
})
.sort((a, b) => (a.ultimoContato?.getTime() ?? 0) - (b.ultimoContato?.getTime() ?? 0))
.slice(0, 6);

const clientesAguardando = clientesAguardandoRaw
.filter((c) => {
const ultima = c.conversas[0];
if (!ultima) return true;
if (ultima.remetente === "vendedor") return false;
return !DESPEDIDA_RE.test(ultima.conteudo);
})
.slice(0, 8);

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

<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
<DicaVendas />
<FraseMotivacional />
</div>

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

{/* ── Negociações (primeiro lugar) ── */}
<Section titulo="🤝 Negociações" cor="#BFDE4D">
<div className="grid grid-cols-2 gap-3">
<KpiCard titulo="Em negociação" valor={emNegociacaoCount} cor="#BFDE4D" sub="com o cliente" />
<KpiCard titulo="Em banco" valor={emBancoCount} cor="#a78bfa" sub="proposta no BCNH" />
</div>
</Section>

{/* ── BLOCO 3b: Demandas de Hoje ── */}
<Section titulo="📋 Demandas de Hoje" cor="#f59e0b">
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <KpiCard titulo="Hoje" valor={demandasHoje} sub="demanda(s)" cor="amber" />
  </div>
</Section>

{/* ── METAS ── */}
<Section titulo="📊 Metas" cor="#f59e0b">
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
<KpiCard titulo="Visitas Semanais" valor={<><span style={{ color: "#60a5fa" }}>{visitasSemanaAgendadas}</span><span style={{ color: "#71717a", fontSize: 13 }}>/20</span></>} cor="#60a5fa" sub="zera toda segunda" numerico={false} />
<KpiCard titulo="Novos Negócios" valor={<><span style={{ color: "#BFDE4D" }}>{novosNegociosSemana}</span><span style={{ color: "#71717a", fontSize: 13 }}>/5</span></>} cor="#BFDE4D" sub="na semana" numerico={false} />
<KpiCard titulo="Ritmo Mensal" valor={ritmoMensal} cor="#a78bfa" sub="vendas/mês (média)" />
</div>
<div className="grid grid-cols-2 gap-3 mb-3">
<KpiCard titulo="Meta Anual" valor={<><span style={{ color: "#4ade80" }}>{vendasGanhasAno}</span><span style={{ color: "#71717a", fontSize: 13 }}>/{META_ANUAL}</span></>} cor="#BFDE4D" sub={faltamVendas + " para bater"} numerico={false} />
<KpiCard titulo="Média necessária" valor={mediaNecessariaPorMes} cor="#f59e0b" sub={"máquinas/mês até dez"} />
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

{/* ── WHATSAPP ── */}
<Section titulo="📱 WhatsApp" cor="#f87171">
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
<KpiCard titulo="Aguard. resposta" valor={clientesAguardando.length} cor="#f87171" sub="sem resposta" />
<KpiCard titulo="30+ dias sem contato" valor={clientes30DiasSemContato.length} cor="#f59e0b" sub="clientes" />
<KpiCard titulo="Interesse Futuro" valor={futuros.length} cor="#a78bfa" sub={futurosNaHora + " chegando (30d)"} />
<KpiCard titulo="Sem cadastro" valor={conversasSemCadastro.length} cor="#f87171" sub="conversas abertas" />
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

{/* ── Clientes com 30+ dias sem contato ── */}
{clientes30DiasSemContato.length > 0 && (
<section>
<SectionLabel icone={<Snowflake size={16} />} cor="#f59e0b">Clientes com 30+ dias sem contato</SectionLabel>
<div className="space-y-2">
{clientes30DiasSemContato.map((c) => (
<Link key={c.id} href={"/clientes/" + c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Snowflake size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{c.nome}</p>
<p className="text-xs text-zinc-500">{c.ultimoContato ? `há ${diasDesde(c.ultimoContato)}d sem contato` : "sem registro de contato"}</p>
</div>
<ArrowRight size={14} className="text-zinc-600" />
</Link>
))}
</div>
</section>
)}

{/* ── Conversas de WhatsApp sem cadastro ── */}
{conversasSemCadastro.length > 0 && (
<section>
<SectionLabel icone={<UserX size={16} />} cor="#f87171">Conversas sem cadastro</SectionLabel>
<div className="space-y-2">
{conversasSemCadastro.map((c) => (
<div key={c.id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Link href={"/atendimento?conversa=" + c.id} className="flex flex-1 items-center gap-3 min-w-0 active:opacity-70">
<UserX size={16} style={{ color: "#f87171", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{c.contactName || c.externalPhone}</p>
<p className="text-xs text-zinc-500">{c.externalPhone} · sem cliente vinculado</p>
</div>
</Link>
<CadastrarContatoWhatsApp telefone={semCodigoPais(c.externalPhone.replace(/\D/g, ""))} municipios={municipios} />
</div>
))}
</div>
</section>
)}

{/* ── Negócios em aberto que precisam de visita ── */}
{precisamDeVisita.length > 0 && (
<section>
<SectionLabel icone={<Clock size={16} />} cor="#60a5fa">Negócios que precisam de visita</SectionLabel>
<div className="space-y-2">
{precisamDeVisita.map((n) => (
<Link key={n.id} href={"/pipeline"} className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70" style={{ background: "#18181b", border: "1px solid #27272a" }}>
<Clock size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />
<div className="flex-1 min-w-0">
<p className="text-sm font-semibold text-white truncate">{n.cliente?.nome}</p>
<p className="text-xs text-zinc-500">{n.maquinaModelo ?? "?"} · {n.proximaAcao ?? "Agendar visita"}</p>
</div>
<span className="text-xs text-zinc-500">{n.ultimoContato ? `${diasDesde(n.ultimoContato)}d` : ""}</span>
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
