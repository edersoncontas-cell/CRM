import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatCurrency, diasDesde } from "@/lib/utils";
import { PipelineChart } from "@/components/charts";
import { resolverAlerta } from "@/lib/actions";
import Link from "next/link";
import {
  Target, TrendingUp, AlertTriangle, Clock, DollarSign, Users, Bell,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [metas, alertas, negociacoes, clientesCount, aguardando] = await Promise.all([
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
  ]);

  const valorPipeline = negociacoes.reduce((s, n) => s + (n.valor ?? 0), 0);
  const porEstagio = ["novo", "contato", "proposta", "negociacao", "fechamento"].map((e) => ({
    estagio: e,
    total: negociacoes.filter((n) => n.estagio === e).length,
  }));

  // "Aguardando resposta" = sem contato há 3+ dias
  const filaAguardando = aguardando
    .filter((n) => diasDesde(n.ultimoContato) >= 3)
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        titulo="Dashboard"
        subtitulo="Visão geral das suas metas e negociações"
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<DollarSign />} rotulo="Pipeline aberto" valor={formatCurrency(valorPipeline)} tom="text-green-600" />
        <Kpi icon={<TrendingUp />} rotulo="Negociações ativas" valor={String(negociacoes.length)} tom="text-brand-600" />
        <Kpi icon={<Users />} rotulo="Clientes" valor={String(clientesCount)} tom="text-amber-600" />
        <Kpi icon={<AlertTriangle />} rotulo="Alertas abertos" valor={String(alertas.length)} tom="text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Metas */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Target size={18} className="text-brand-600" /> Metas
          </div>
          <div className="space-y-4">
            {metas.map((m) => {
              const pct = Math.min(100, Math.round((m.progresso / m.alvo) * 100));
              return (
                <div key={m.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-600">{m.rotulo}</span>
                    <span className="font-medium text-slate-700">
                      {m.progresso}/{m.alvo}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-brand-500" : "bg-amber-500"}`}
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
        {/* Alertas anti-procrastinação */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Bell size={18} className="text-red-500" /> Alertas — clientes sem resposta
          </div>
          {alertas.length === 0 ? (
            <p className="text-sm text-slate-400">Tudo em dia! Nenhum cliente esquecido. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <Link href={`/clientes/${a.clienteId}`} className="text-sm font-medium text-slate-700 hover:text-brand-600">
                      {a.cliente.nome}
                    </Link>
                    <p className="text-xs text-slate-500">{a.mensagem}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tom={a.severidade === "alta" ? "red" : "yellow"}>{a.diasDesde}d</Badge>
                    <form action={resolverAlerta.bind(null, a.id)}>
                      <button className="text-xs text-brand-600 hover:underline">resolver</button>
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
            <Clock size={18} className="text-amber-500" /> Aguardando sua resposta
          </div>
          {filaAguardando.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma negociação parada. 👍</p>
          ) : (
            <ul className="space-y-2">
              {filaAguardando.map((n) => (
                <li key={n.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <Link href={`/clientes/${n.clienteId}`} className="text-sm font-medium text-slate-700 hover:text-brand-600">
                      {n.cliente.nome}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {n.maquinaModelo ?? "Sem máquina"} · {n.proximaAcao ?? "Retomar contato"}
                    </p>
                  </div>
                  <Badge tom="yellow">{diasDesde(n.ultimoContato)}d parado</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon, rotulo, valor, tom,
}: {
  icon: React.ReactNode; rotulo: string; valor: string; tom: string;
}) {
  return (
    <Card className="flex items-center gap-3">
      <div className={`rounded-lg bg-slate-100 p-2 ${tom}`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{rotulo}</div>
        <div className="text-xl font-bold text-slate-800">{valor}</div>
      </div>
    </Card>
  );
}
