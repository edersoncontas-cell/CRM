import { db } from "@/lib/db";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { CerebroGrafo, type NoGrafo } from "@/components/CerebroGrafo";
import { PainelRelatorio, PainelRadar, PainelMemoria } from "@/components/CentralCerebro";
import { SESSOES } from "@/lib/cerebro/sessoes";
import { lerRelatorios } from "@/lib/cerebro/relatorio-diario";
import { listarIdeias } from "@/lib/cerebro/radar";
import { buscarMemoriasAction } from "@/lib/cerebro/acoes";
import { lerParametros } from "@/lib/parametros";
import { TODAS_AULAS } from "@/lib/academia-trilha";
import { inicioDoDiaBrasilia } from "@/lib/utils";
import { Brain } from "lucide-react";

export const dynamic = "force-dynamic";

// Um número por sessão do CRM — é o que pulsa no nó do grafo.
async function contagens(): Promise<Record<string, { total: number; rotulo: string }>> {
  const inicioSemana = new Date(Date.now() - 7 * 86_400_000);
  const hoje = inicioDoDiaBrasilia();
  const amanha = inicioDoDiaBrasilia(new Date(), 1);

  const [
    negociacoes, clientes, conversas, visitasSemana, alertas, demandas, posts, maquinas, faturadasAno, analises,
  ] = await Promise.all([
    db.negociacao.count({ where: { status: "aberta" } }),
    db.cliente.count(),
    db.whatsAppConversation.count({ where: { isGroup: false, lastMessageAt: { gte: inicioSemana } } }),
    db.visita.count({ where: { data: { gte: hoje, lt: new Date(amanha.getTime() + 6 * 86_400_000) } } }),
    db.alerta.count({ where: { resolvido: false } }),
    db.tarefaKanban.count({ where: { coluna: "demandas" } }),
    db.postMarketing.count().catch(() => 0),
    db.maquina.count({ where: { proprio: true } }),
    db.negociacao.count({ where: { status: "ganha" } }),
    db.orientadorAnalise.count(),
  ]);

  return {
    negociacoes: { total: negociacoes, rotulo: "em aberto" },
    clientes: { total: clientes, rotulo: "na carteira" },
    whatsapp: { total: conversas, rotulo: "conversas na semana" },
    visitas: { total: visitasSemana, rotulo: "na semana" },
    alertas: { total: alertas, rotulo: "abertos" },
    demandas: { total: demandas, rotulo: "para fazer" },
    marketing: { total: posts, rotulo: "posts criados" },
    maquinas: { total: maquinas, rotulo: "máquinas na linha" },
    financeiro: { total: faturadasAno, rotulo: "vendas faturadas" },
    orientador: { total: analises, rotulo: "clientes lidos" },
    academia: { total: TODAS_AULAS.length, rotulo: "aulas na trilha" },
    dashboard: { total: faturadasAno, rotulo: "vendas no placar" },
  };
}

export default async function CerebroPage() {
  await garantirManutencaoSeNecessario();

  const [numeros, relatorios, ideias, memorias, audits, parametros] = await Promise.all([
    contagens().catch(() => ({}) as Record<string, { total: number; rotulo: string }>),
    lerRelatorios(14).catch(() => []),
    listarIdeias(undefined, 40).catch(() => []),
    buscarMemoriasAction("", 10).catch(() => []),
    db.auditLog.findMany({
      orderBy: { criadoEm: "desc" },
      take: 24,
      select: { id: true, descricao: true, criadoEm: true, origem: true },
    }),
    lerParametros().catch(() => null),
  ]);

  const nos: NoGrafo[] = SESSOES.map((s) => ({
    ...s,
    total: numeros[s.id]?.total ?? 0,
    rotuloTotal: numeros[s.id]?.rotulo ?? "",
  }));

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-4 p-4 sm:-m-6 sm:p-6 md:-m-8 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.35)" }}>
          <Brain size={24} style={{ color: "#38bdf8" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white sm:text-2xl">Central Inteligente</h1>
          <p className="text-[11px] leading-snug text-zinc-500 sm:text-xs">
            O Cérebro do {parametros?.nomeCrm ?? "CRM"} vê tudo, analisa tudo e conecta tudo: cada sessão manda o que aconteceu, ele devolve o que fazer.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <CerebroGrafo nos={nos} titulo="Cérebro" />
      </div>

      {/* items-start: um card com lista mais longa (mesmo já limitada, com
          "ver mais") nunca estica os vizinhos para a mesma altura — cada um
          fica do tamanho do próprio conteúdo. */}
      <div className="mb-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <PainelRelatorio inicial={relatorios} />
        <PainelRadar inicial={ideias} />
        <PainelMemoria inicial={memorias} />
      </div>

      <div className="rounded-2xl p-4" style={{ background: "#111a24", border: "1px solid #1e2a36" }}>
        <div className="mb-3 text-sm font-black text-white">O que o Cérebro fez</div>
        {audits.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhuma ação registrada ainda.</p>
        ) : (
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {audits.map((a) => (
              <div key={a.id} className="rounded-xl px-3 py-2 text-xs" style={{ background: "#0b1119" }}>
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: a.origem === "ia" || a.origem === "cerebro" ? "#38bdf8" : a.origem === "usuario" ? "#ffcb2d" : "#71809a" }}>
                    {a.origem === "ia" || a.origem === "cerebro" ? "Cérebro" : a.origem === "usuario" ? "Você" : "Sistema"}
                  </span>
                  <span className="shrink-0 text-zinc-600">{new Date(a.criadoEm).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="leading-relaxed text-zinc-400">{a.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
