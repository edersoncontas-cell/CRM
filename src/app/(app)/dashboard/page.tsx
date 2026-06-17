import { db } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { formatCurrency, diasDesde } from "@/lib/utils";
import { PipelineChart } from "@/components/charts";
import { resolverAlerta } from "@/lib/actions";
import { forecastValor, comissaoEstimada, classificarLead, COR_CLASSE } from "@/lib/insights";
import { ESTAGIOS, normalizarEstagio } from "@/lib/pipeline";
import { MotivacaoWidget, DicaVendas } from "@/components/MotivacaoWidget";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import Link from "next/link";
import {
  Target, TrendingUp, AlertTriangle, Clock, DollarSign, Users,
  Bell, Snowflake, CheckCircle2, ArrowRight, MessageCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Paleta dark ──────────────────────────────────────────────────────────────
// Surface:  #09090b (zinc-950) | Card: #18181b (zinc-900) | Border: #27272a
// Text:     #fafafa / #a1a1aa / #71717a
// Accents:  #BFDE4D agro | #22c55e green | #f59e0b amber | #f87171 red | #60a5fa blue
// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [metas, alertas, negociacoes, clientesCount, aguardando, clientesAguardando] = await Promise.all([
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
      orderBy: { ultimoContato: "asc" },
      take: 8,
    }),
  ]);

  const hoje = new Date();
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(hoje); fimDia.setHours(23, 59, 59, 999);
  const visitasHoje = await db.negociacao.count({
    where: { dataVisita: { gte: inicioDia, lte: fimDia }, status: { not: "perdida" } },
  });

  const hora = hoje.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const metasAbertas = metas.filter((m) => m.progresso < m.alvo).length;

  const valorPipeline = negociacoes.reduce((s, n) => s + (n.valor ?? 0), 0);
  const forecast = forecastValor(negociacoes);
  const comissao = comissaoEstimada(forecast);
  const leadsEsfriando = negociacoes.filter((n) => classificarLead(n).esfriando).slice(0, 6);
  const porEstagio = ESTAGIOS.map((e) => ({
    estagio: e.id,
    total: negociacoes.filter((n) => normalizarEstagio(n.estagio) === e.id).length,
  }));
  const aguardandoFiltrado = aguardando.filter((n) => diasDesde(n.ultimoContato) >= 3);
  const filaAguardando = aguardandoFiltrado.slice(0, 6);

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
            <MiniStat label="Forecast" valor={formatCurrency(forecast)} cor="#BFDE4D" />
            <MiniStat label="Comissão est." valor={formatCurrency(comissao)} cor="#4ade80" />
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
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        className="rounded-xl p-2.5"
        style={{ background: `${accentColor}18`, color: accentColor }}
      >
        {icone}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium" style={{ color: "#71717a" }}>{rotulo}</div>
        <div className="text-xl font-bold text-white">{valor}</div>
      </div>
    </>
  );
  const cls = "flex items-center gap-4 rounded-2xl p-4 transition hover:brightness-110";
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
