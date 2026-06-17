import { db } from "@/lib/db";
import { Card, PageHeader, Badge, StatCard } from "@/components/ui";
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
  Bell, Snowflake, Percent, CheckCircle2, ArrowRight, MessageCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

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
    // Clientes que me mandaram mensagem e ainda aguardam meu retorno.
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
    <div>
      <PageHeader
        titulo="Dashboard"
        subtitulo="Visão geral das suas metas e negociações"
        acao={<BotaoAtualizar />}
      />

      {/* Hero do dia */}
      <div className="mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">
              ☀️ {saudacao}, Ederson!
            </div>
            <p className="mt-2 text-sm leading-relaxed text-brand-200">
              Você tem{" "}
              <span className="rounded-md bg-green-500/20 px-1.5 py-0.5 font-bold text-green-300">
                {visitasHoje} visita{visitasHoje !== 1 ? "s" : ""}
              </span>{" "}
              hoje,{" "}
              <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300">
                {aguardandoFiltrado.length} cliente{aguardandoFiltrado.length !== 1 ? "s" : ""}
              </span>{" "}
              esperando resposta e{" "}
              <span className={`rounded-md px-1.5 py-0.5 font-bold ${alertas.length > 0 ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
                {alertas.length} alerta{alertas.length !== 1 ? "s" : ""}
              </span>
              {" "}{alertas.length === 0 ? "✅ Tudo em dia!" : "para resolver."}
            </p>
            <p className="mt-1 text-xs text-brand-400">
              {metasAbertas > 0
                ? `Faltam ${metasAbertas} meta(s) para bater este período.`
                : "🎉 Todas as metas batidas!"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <MiniStat label="Forecast" valor={formatCurrency(forecast)} cor="text-agro-400" />
            <MiniStat label="Comissão est." valor={formatCurrency(comissao)} cor="text-green-400" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard href="/pipeline" icone={<DollarSign size={18} />} rotulo="Pipeline aberto" valor={formatCurrency(valorPipeline)} cor="green" />
        <StatCard href="/pipeline" icone={<TrendingUp size={18} />} rotulo="Negociações ativas" valor={String(negociacoes.length)} cor="blue" />
        <StatCard href="/clientes" icone={<Users size={18} />} rotulo="Clientes cadastrados" valor={String(clientesCount)} cor="amber" />
        <StatCard icone={<AlertTriangle size={18} />} rotulo="Alertas abertos" valor={String(alertas.length)} cor={alertas.length > 0 ? "red" : "green"} />
      </div>

      {/* Motivação + Dica */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MotivacaoWidget />
        <DicaVendas />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Metas */}
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-2 font-semibold text-slate-700">
            <Target size={17} className="text-brand-500" /> Metas do período
          </div>
          <div className="space-y-4">
            {metas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma meta configurada. Acesse Configurações para definir.</p>
            ) : metas.map((m) => {
              const pct = Math.min(100, Math.round((m.progresso / m.alvo) * 100));
              const cor = pct >= 100 ? "from-green-400 to-emerald-500" : pct >= 60 ? "from-brand-400 to-brand-500" : "from-amber-400 to-yellow-500";
              return (
                <div key={m.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{m.rotulo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{m.progresso}/{m.alvo}</span>
                      <span className={`text-xs font-bold ${pct >= 100 ? "text-emerald-600" : "text-slate-400"}`}>
                        {pct}%{pct >= 100 && " ✓"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${cor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Funil */}
        <Card>
          <div className="mb-4 font-semibold text-slate-700">Funil por estágio</div>
          <PipelineChart data={porEstagio} />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alertas */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Bell size={17} className="text-red-500" /> Clientes sem resposta
          </div>
          {alertas.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm text-green-700">Tudo em dia! Nenhum cliente esquecido.</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/clientes/${a.clienteId}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">
                      {a.cliente.nome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{a.mensagem}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.severidade === "alta" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {a.diasDesde}d
                    </span>
                    <form action={resolverAlerta.bind(null, a.id)}>
                      <button className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                        Resolver
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Aguardando resposta */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Clock size={17} className="text-amber-500" /> Aguardando sua resposta
          </div>
          {filaAguardando.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm text-green-700">Nenhuma negociação parada. Ótimo ritmo!</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {filaAguardando.map((n) => (
                <li key={n.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/clientes/${n.clienteId}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">
                      {n.cliente.nome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {n.maquinaModelo ?? "Sem máquina"} · {n.proximaAcao ?? "Retomar contato"}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    {diasDesde(n.ultimoContato)}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Clientes aguardando meu retorno (WhatsApp) */}
      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <MessageCircle size={17} className="text-emerald-500" /> Aguardando seu retorno no WhatsApp
            {clientesAguardando.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {clientesAguardando.length}
              </span>
            )}
            <Link href="/inbox" className="ml-auto text-xs font-semibold text-brand-600 hover:underline">
              Abrir WhatsApp →
            </Link>
          </div>
          {clientesAguardando.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm text-green-700">Nenhum cliente esperando resposta. Tudo respondido! 🎉</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clientesAguardando.map((c) => {
                const dias = c.ultimoContato ? diasDesde(c.ultimoContato) : 0;
                return (
                  <Link
                    key={c.id}
                    href="/inbox"
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{c.nome}</span>
                    <span className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${dias >= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {dias === 0 ? "hoje" : `${dias}d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Leads esfriando */}
      {leadsEsfriando.length > 0 && (
        <div className="mt-6">
          <Card>
            <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
              <Snowflake size={17} className="text-sky-500" /> Leads esfriando
              <span className="ml-auto text-xs text-slate-400">Estavam quentes e pararam</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {leadsEsfriando.map((n) => {
                const { classe } = classificarLead(n);
                return (
                  <Link
                    key={n.id}
                    href={`/clientes/${n.clienteId}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-brand-200 hover:bg-brand-50"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {n.cliente.nome}
                      </span>
                      <p className="text-xs text-slate-500">
                        {n.maquinaModelo ?? "—"} · {diasDesde(n.ultimoContato)}d sem contato
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                      <Badge tom={COR_CLASSE[classe]}>Lead {classe}</Badge>
                      <ArrowRight size={12} className="text-slate-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
      <div className="text-xs text-brand-300">{label}</div>
      <div className={`text-base font-bold ${cor}`}>{valor}</div>
    </div>
  );
}
