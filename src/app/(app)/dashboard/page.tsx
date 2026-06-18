import { db } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { formatCurrency, diasDesde, saudacaoBrasilia } from "@/lib/utils";
import { PipelineChart } from "@/components/charts";
import { resolverAlerta } from "@/lib/actions";
import { comissaoConfirmada, classificarLead, COR_CLASSE, ESTAGIO_VENDAS_CONFIRMADAS } from "@/lib/insights";
import { ESTAGIOS, normalizarEstagio } from "@/lib/pipeline";
import { MotivacaoWidget, DicaVendas } from "@/components/MotivacaoWidget";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import Link from "next/link";
import {
  Target, TrendingUp, AlertTriangle, Clock, DollarSign, Users,
  Bell, Snowflake, CheckCircle2, ArrowRight, MessageCircle, UserX,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Paleta dark ──────────────────────────────────────────────────────────────
// Surface:  #09090b (zinc-950) | Card: #18181b (zinc-900) | Border: #27272a
// Text:     #fafafa / #a1a1aa / #71717a
// Accents:  #BFDE4D agro | #22c55e green | #f59e0b amber | #f87171 red | #60a5fa blue
// ─────────────────────────────────────────────────────────────────────────────

// Palavras que indicam conversa encerrada — IA não precisa responder.
const DESPEDIDA_RE =
  /\b(obrigad[ao]|valeu|até logo|tchau|tchauzinho|boa noite|boa tarde|bom dia(?! pessoal)|até mais|abraços?|foi um prazer|tudo certo|combinado|fechado|até amanhã|até segunda|pode ser|ok obrigad[ao])\b/i;

export default async function DashboardPage() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const inicioAno = new Date(anoAtual, 0, 1);

  const DIAS_ESQUECIDO = 15;
  const corteEsquecido = new Date(hoje);
  corteEsquecido.setDate(corteEsquecido.getDate() - DIAS_ESQUECIDO);

  const [metas, alertas, negociacoes, clientesCount, aguardando, clientesAguardandoRaw, esquecidos, futuros] =
    await Promise.all([
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
      // Clientes com negociação aberta e sem contato há 15+ dias
      db.negociacao.findMany({
        where: {
          status: "aberta",
          ultimoContato: { lt: corteEsquecido },
        },
        include: { cliente: true },
        orderBy: { ultimoContato: "asc" },
        take: 8,
      }),
      // Clientes com interesse futuro (ex: aguardando Plano Safra)
      db.cliente.findMany({
        where: { interesseFuturo: true },
        orderBy: { interesseFuturoData: "asc" },
        take: 12,
        select: { id: true, nome: true, interesseFuturoData: true, interesseFuturoNota: true },
      }),
    ]);

  // "Chegou a hora": data de retomar o contato já passou ou está a até 30 dias.
  const em30Dias = new Date(hoje);
  em30Dias.setDate(em30Dias.getDate() + 30);
  const futurosNaHora = futuros.filter(
    (f) => f.interesseFuturoData && f.interesseFuturoData <= em30Dias
  ).length;

  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(hoje); fimDia.setHours(23, 59, 59, 999);
  const [visitasHoje, vendasGanhasAno] = await Promise.all([
    db.negociacao.count({
      where: { dataVisita: { gte: inicioDia, lte: fimDia }, status: { not: "perdida" } },
    }),
    db.negociacao.count({
      where: { status: "ganha", atualizadoEm: { gte: inicioAno } },
    }),
  ]);

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

  // Filtra "aguardando retorno no WhatsApp": exclui conversas que terminaram em despedida.
  const clientesAguardando = clientesAguardandoRaw
    .filter((c) => {
      const ultima = c.conversas[0];
      if (!ultima) return true;
      if (ultima.remetente === "vendedor") return false; // eu já respondi
      return !DESPEDIDA_RE.test(ultima.conteudo);
    })
    .slice(0, 8);

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm" style={{ color: "#71717a" }}>Visão geral das suas metas e negociações</p>
        </div>
        <BotaoAtualizar />
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div
        className="mb-7 overflow-hidden rounded-2xl p-6"
        style={{
          background: "#000000",
          border: "1px solid #27272a",
          boxShadow: "0 0 40px 0 rgba(191,222,77,0.06)",
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-bold text-white">
              ☀️ {saudacao}, Ederson!
            </div>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#a1a1aa" }}>
              Você tem{" "}
              <Chip cor="#22c55e" bg="rgba(34,197,94,0.12)">{visitasHoje} visita{visitasHoje !== 1 ? "s" : ""}</Chip>
              {" "}hoje,{" "}
              <Chip cor="#f59e0b" bg="rgba(245,158,11,0.12)">{aguardandoFiltrado.length} cliente{aguardandoFiltrado.length !== 1 ? "s" : ""}</Chip>
              {" "}esperando resposta e{" "}
              <Chip
                cor={alertas.length > 0 ? "#f87171" : "#22c55e"}
                bg={alertas.length > 0 ? "rgba(248,113,113,0.12)" : "rgba(34,197,94,0.12)"}
              >
                {alertas.length} alerta{alertas.length !== 1 ? "s" : ""}
              </Chip>
              {" "}{alertas.length === 0 ? "✅ Tudo em dia!" : "para resolver."}
            </p>
            <p className="mt-1.5 text-xs" style={{ color: "#52525b" }}>
              {metasAbertas > 0
                ? `Faltam ${metasAbertas} meta(s) para bater este período.`
                : "🎉 Todas as metas batidas!"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Link href="/pipeline">
              <MiniStat
                label={faltamVendas === 0 ? "Meta anual atingida! 🎉" : `Faltam ${faltamVendas} p/ meta`}
                valor={`${vendasGanhasAno}/${META_ANUAL} vendas`}
                cor={faltamVendas === 0 ? "#4ade80" : "#BFDE4D"}
              />
            </Link>
            <Link href="/pipeline">
              <MiniStat label="Comissão (confirmadas)" valor={formatCurrency(comissao)} cor="#4ade80" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DarkStatCard
          href="/pipeline"
          icone={<DollarSign size={18} />}
          rotulo="Pipeline aberto"
          valor={formatCurrency(valorPipeline)}
          accentColor="#4ade80"
        />
        <DarkStatCard
          href="/pipeline"
          icone={<TrendingUp size={18} />}
          rotulo="Negociações ativas"
          valor={String(negociacoes.length)}
          accentColor="#60a5fa"
        />
        <DarkStatCard
          href="/clientes"
          icone={<Users size={18} />}
          rotulo="Clientes cadastrados"
          valor={String(clientesCount)}
          accentColor="#a78bfa"
        />
        <DarkStatCard
          href="#alertas"
          icone={<AlertTriangle size={18} />}
          rotulo="Alertas abertos"
          valor={String(alertas.length)}
          accentColor={alertas.length > 0 ? "#f87171" : "#4ade80"}
        />
      </div>

      {/* ── Motivação + Dica ──────────────────────────────────────────── */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MotivacaoWidget />
        <DicaVendas />
      </div>

      {/* ── Metas + Funil ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DarkCard className="lg:col-span-2">
          <SectionLabel icone={<Target size={15} />} cor="#BFDE4D">Metas do período</SectionLabel>
          <div className="space-y-4">
            {metas.length === 0 ? (
              <p className="text-sm" style={{ color: "#71717a" }}>Nenhuma meta configurada. Acesse Configurações.</p>
            ) : metas.map((m) => {
              const pct = Math.min(100, Math.round((m.progresso / m.alvo) * 100));
              const barColor = pct >= 100 ? "#4ade80" : pct >= 60 ? "#BFDE4D" : "#f59e0b";
              return (
                <div key={m.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span style={{ color: "#d4d4d8" }}>{m.rotulo}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#71717a" }}>{m.progresso}/{m.alvo}</span>
                      <span className="text-xs font-bold" style={{ color: barColor }}>
                        {pct}%{pct >= 100 && " ✓"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#27272a" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </DarkCard>

        <DarkCard>
          <SectionLabel cor="#60a5fa">Funil por estágio</SectionLabel>
          <PipelineChart data={porEstagio} dark />
        </DarkCard>
      </div>

      {/* ── Alertas + Aguardando ──────────────────────────────────────── */}
      <div id="alertas" className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DarkCard>
          <SectionLabel icone={<Bell size={15} />} cor="#f87171">Clientes sem resposta</SectionLabel>
          {alertas.length === 0 ? (
            <EmptyOk>Tudo em dia! Nenhum cliente esquecido.</EmptyOk>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                >
                  <div className="min-w-0">
                    <Link href={`/clientes/${a.clienteId}`} className="block truncate text-sm font-semibold text-white hover:text-[#BFDE4D]">
                      {a.cliente.nome}
                    </Link>
                    <p className="truncate text-xs" style={{ color: "#71717a" }}>{a.mensagem}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={a.severidade === "alta"
                        ? { background: "rgba(248,113,113,0.15)", color: "#f87171" }
                        : { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                    >
                      {a.diasDesde}d
                    </span>
                    <form action={resolverAlerta.bind(null, a.id)}>
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                        style={{ background: "rgba(191,222,77,0.1)", color: "#BFDE4D" }}
                      >
                        Resolver
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DarkCard>

        <DarkCard>
          <SectionLabel icone={<Clock size={15} />} cor="#f59e0b">Aguardando sua resposta</SectionLabel>
          {filaAguardando.length === 0 ? (
            <EmptyOk>Nenhuma negociação parada. Ótimo ritmo!</EmptyOk>
          ) : (
            <ul className="space-y-2">
              {filaAguardando.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                >
                  <div className="min-w-0">
                    <Link href={`/clientes/${n.clienteId}`} className="block truncate text-sm font-semibold text-white hover:text-[#BFDE4D]">
                      {n.cliente.nome}
                    </Link>
                    <p className="truncate text-xs" style={{ color: "#71717a" }}>
                      {n.maquinaModelo ?? "Sem máquina"} · {n.proximaAcao ?? "Retomar contato"}
                    </p>
                  </div>
                  <span
                    className="ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                  >
                    {diasDesde(n.ultimoContato)}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DarkCard>
      </div>

      {/* ── WhatsApp aguardando ───────────────────────────────────────── */}
      <div className="mt-6">
        <DarkCard>
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle size={15} style={{ color: "#4ade80" }} />
            <span className="font-semibold text-white text-sm">Aguardando seu retorno no WhatsApp</span>
            {clientesAguardando.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
              >
                {clientesAguardando.length}
              </span>
            )}
            <span className="ml-1 text-xs" style={{ color: "#52525b" }} title="Despedidas e agradecimentos são filtrados automaticamente">🤖 IA filtra despedidas</span>
            <Link href="/inbox" className="ml-auto text-xs font-semibold hover:underline" style={{ color: "#BFDE4D" }}>
              Abrir WhatsApp →
            </Link>
          </div>
          {clientesAguardando.length === 0 ? (
            <EmptyOk>Nenhum cliente esperando resposta. Tudo respondido! 🎉</EmptyOk>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clientesAguardando.map((c) => {
                const dias = c.ultimoContato ? diasDesde(c.ultimoContato) : 0;
                return (
                  <Link
                    key={c.id}
                    href="/inbox"
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:brightness-110"
                    style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-white">{c.nome}</span>
                    <span
                      className="ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={dias >= 2
                        ? { background: "rgba(248,113,113,0.15)", color: "#f87171" }
                        : { background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
                    >
                      {dias === 0 ? "hoje" : `${dias}d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </DarkCard>
      </div>

      {/* ── Clientes esquecidos ──────────────────────────────────────── */}
      {esquecidos.length > 0 && (
        <div className="mt-6">
          <DarkCard>
            <div className="mb-4 flex items-center gap-2">
              <UserX size={15} style={{ color: "#c084fc" }} />
              <span className="font-semibold text-white text-sm">Clientes esquecidos</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}
              >
                {esquecidos.length}
              </span>
              <span className="ml-1 text-xs" style={{ color: "#52525b" }}>
                +{DIAS_ESQUECIDO} dias sem contato em negociação aberta
              </span>
              <Link href="/clientes?esquecidos=1" className="ml-auto text-xs font-semibold hover:underline" style={{ color: "#BFDE4D" }}>
                Ver todos →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {esquecidos.map((n) => {
                const dias = diasDesde(n.ultimoContato);
                const urgente = dias >= 30;
                return (
                  <Link
                    key={n.id}
                    href={`/clientes/${n.clienteId}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:brightness-110"
                    style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{n.cliente.nome}</span>
                      <p className="text-xs truncate" style={{ color: "#71717a" }}>
                        {n.maquinaModelo ?? "—"} · {n.estagio}
                      </p>
                    </div>
                    <span
                      className="ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={urgente
                        ? { background: "rgba(248,113,113,0.15)", color: "#f87171" }
                        : { background: "rgba(192,132,252,0.15)", color: "#c084fc" }}
                    >
                      {dias}d
                    </span>
                  </Link>
                );
              })}
            </div>
          </DarkCard>
        </div>
      )}

      {/* ── Interesse futuro (ex: aguardando Plano Safra) ─────────────── */}
      {futuros.length > 0 && (
        <div className="mt-6">
          <DarkCard>
            <div className="mb-4 flex items-center gap-2">
              <Clock size={15} style={{ color: "#fbbf24" }} />
              <span className="font-semibold text-white text-sm">Interesse futuro</span>
              {futurosNaHora > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
                >
                  {futurosNaHora} na hora de contatar
                </span>
              )}
              <span className="ml-1 text-xs" style={{ color: "#52525b" }}>
                clientes aguardando o momento certo (ex: Plano Safra)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {futuros.map((f) => {
                const naHora = !!f.interesseFuturoData && f.interesseFuturoData <= em30Dias;
                const dataFmt = f.interesseFuturoData
                  ? f.interesseFuturoData.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" })
                  : null;
                return (
                  <Link
                    key={f.id}
                    href={`/clientes/${f.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:brightness-110"
                    style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{f.nome}</span>
                      <p className="truncate text-xs" style={{ color: "#71717a" }}>
                        {f.interesseFuturoNota ?? "Aguardando momento certo"}
                      </p>
                    </div>
                    <span
                      className="ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={naHora
                        ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                        : { background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                    >
                      {naHora ? "agora!" : dataFmt ?? "futuro"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </DarkCard>
        </div>
      )}

      {/* ── Leads esfriando ──────────────────────────────────────────── */}
      {leadsEsfriando.length > 0 && (
        <div className="mt-6">
          <DarkCard>
            <div className="mb-4 flex items-center gap-2">
              <Snowflake size={15} style={{ color: "#60a5fa" }} />
              <span className="font-semibold text-white text-sm">Leads esfriando</span>
              <span className="ml-auto text-xs" style={{ color: "#71717a" }}>Estavam quentes e pararam</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {leadsEsfriando.map((n) => {
                const { classe } = classificarLead(n);
                return (
                  <Link
                    key={n.id}
                    href={`/clientes/${n.clienteId}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:brightness-110"
                    style={{ background: "#27272a", border: "1px solid #3f3f46" }}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {n.cliente.nome}
                      </span>
                      <p className="text-xs" style={{ color: "#71717a" }}>
                        {n.maquinaModelo ?? "—"} · {diasDesde(n.ultimoContato)}d sem contato
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <Badge tom={COR_CLASSE[classe]}>Lead {classe}</Badge>
                      <ArrowRight size={12} style={{ color: "#52525b" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </DarkCard>
        </div>
      )}
    </div>
  );
}

// ── Utilitários de UI (dark) ──────────────────────────────────────────────────

function DarkCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: "#18181b", border: "1px solid #27272a" }}
    >
      {children}
    </div>
  );
}

function DarkStatCard({
  icone, rotulo, valor, accentColor, href,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  accentColor: string;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className="w-fit rounded-xl p-2.5"
        style={{ background: `${accentColor}18`, color: accentColor }}
      >
        {icone}
      </div>
      <div className="min-w-0 w-full">
        <div className="text-xs font-medium leading-tight" style={{ color: "#71717a" }}>{rotulo}</div>
        <div className="text-lg font-bold text-white sm:text-xl">{valor}</div>
      </div>
    </>
  );
  const cls =
    "flex flex-col items-start gap-2 rounded-2xl p-4 transition hover:brightness-110 sm:flex-row sm:items-center sm:gap-4";
  const style = { background: "#18181b", border: "1px solid #27272a" };
  if (href) return <Link href={href} className={cls} style={style}>{inner}</Link>;
  return <div className={cls} style={style}>{inner}</div>;
}

function MiniStat({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl px-4 py-2.5 text-right" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      <div className="text-xs" style={{ color: "#71717a" }}>{label}</div>
      <div className="text-base font-bold" style={{ color: cor }}>{valor}</div>
    </div>
  );
}

function Chip({ children, cor, bg }: { children: React.ReactNode; cor: string; bg: string }) {
  return (
    <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ background: bg, color: cor }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, icone, cor }: { children: React.ReactNode; icone?: React.ReactNode; cor: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
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
