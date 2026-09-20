import { db } from "@/lib/db";
import { statusConexao } from "@/lib/zapi";
import { ultimoHeartbeat, zeusAtivo } from "@/lib/zeus/estado";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { iaHabilitada, provedorIANome, diagnosticoDaIA } from "@/lib/ai";
import { ChavesIACard } from "@/components/ChavesIACard";
import { lerChavesGravadas, origemDasChaves, mascarar, carregarChavesIA, lerSomenteGratuitos } from "@/lib/ai/chaves";
import { ONDE_PEGAR } from "@/lib/ai/provedores-status";
import { ZeusPainel, type ZeusEventoRow, type AuditRow } from "@/components/ZeusPainel";
import { ShieldCheck } from "lucide-react";
import { inicioDoDiaBrasilia } from "@/lib/utils";
import { calcularRitmoMetas } from "@/lib/metas";

export const dynamic = "force-dynamic";

// No modo gratuito TODOS os crons são disparados pelo agendador externo via
// /api/cron/tudo a cada ~15 min — a expectativa aqui precisa acompanhar isso
// (mesma tolerância de lib/zeus/tick.ts), senão o painel marca "parado" o dia
// inteiro sem motivo.
const CRONS_MONITORADOS = [
  { nome: "zeus-tick", minutosEsperados: 15 },
  { nome: "zeus-pipeline", minutosEsperados: 15 },
  { nome: "agnes-dispatch", minutosEsperados: 15 },
  { nome: "whatsapp-retry", minutosEsperados: 15 },
  { nome: "zeus-diario", minutosEsperados: 24 * 60 },
  { nome: "relatorio-diario", minutosEsperados: 24 * 60 },
  { nome: "radar-inovacao", minutosEsperados: 24 * 60 },
];

export default async function ZeusPage() {
  const inicioDia = inicioDoDiaBrasilia();

  const [status, ativo, , heartbeats, eventos, audits, mensagensHoje, acoesHoje, correcoes, alertasAbertos, rascunhos, demandasAuto, followUpsHoje, ritmo] = await Promise.all([
    statusConexao().catch(() => null),
    zeusAtivo(),
    getWaSettings(),
    Promise.all(CRONS_MONITORADOS.map(async (c) => ({ ...c, ultimo: await ultimoHeartbeat(c.nome) }))),
    db.zeusEvent.findMany({ orderBy: { criadoEm: "desc" }, take: 40 }),
    db.auditLog.findMany({ where: { origem: "zeus" }, orderBy: { criadoEm: "desc" }, take: 40 }),
    db.whatsAppMessage.count({ where: { processedAt: { gte: inicioDia } } }),
    db.auditLog.count({ where: { origem: "zeus", criadoEm: { gte: inicioDia } } }),
    db.zeusEvent.count({ where: { tipo: "fix" } }),
    db.alerta.count({ where: { resolvido: false } }),
    db.whatsAppMessage.count({ where: { isDraft: true, draftStatus: "PENDING" } }),
    db.tarefaKanban.count({ where: { coluna: "demandas", origem: { not: "manual" } } }),
    db.zeusEvent.count({ where: { tipo: "acao", criadoEm: { gte: inicioDia } } }),
    calcularRitmoMetas().catch(() => null),
  ]);

  // Chaves de IA: o que está gravado no CRM e de onde cada uma veio.
  //
  // O carregarChavesIA() é chamado AQUI, e não só no layout, porque no App
  // Router o layout e a página renderizam EM PARALELO — a página lia o
  // ambiente antes de o layout terminar de povoá-lo, e o card dizia "nenhum
  // provedor configurado" logo depois de o vendedor salvar a chave. É barato:
  // a leitura é cacheada por 30s.
  await carregarChavesIA().catch(() => {});
  const chavesGravadas = await lerChavesGravadas();
  const origens = await origemDasChaves();
  const soGratuitos = await lerSomenteGratuitos();
  const diag = diagnosticoDaIA();

  const eventosRows: ZeusEventoRow[] = eventos.map((e) => ({
    id: e.id, tipo: e.tipo, severidade: e.severidade, titulo: e.titulo, detalhe: e.detalhe, resolvido: e.resolvido, criadoEm: e.criadoEm.toISOString(),
  }));
  const auditRows: AuditRow[] = audits.map((a) => ({ id: a.id, acao: a.acao, descricao: a.descricao, criadoEm: a.criadoEm.toISOString() }));

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-4 p-4 sm:-m-6 sm:p-6 md:-m-8 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(191,222,77,0.15)", border: "1px solid rgba(191,222,77,0.3)" }}>
          <ShieldCheck size={24} style={{ color: "#BFDE4D" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">ZEUS — Centro de comando</h1>
          <p className="text-xs text-zinc-500">Governança autônoma 24/7 · saúde do sistema · higiene de dados · alertas</p>
        </div>
      </div>

      {/* Provedores de IA: a fila, e o botão de ligar um novo.
          Fica aqui porque é onde o vendedor vem quando algo parou. Ligar um
          segundo provedor é o que faz o Orientador não parar quando o
          primeiro bate no limite — e agora dá para fazer isso do celular,
          sem abrir a Vercel. Ver lib/ai/chaves.ts. */}
      <ChavesIACard
        linhas={diag.linhas.map((l) => ({
          id: l.id, nome: l.nome, chave: l.chave, configurado: l.configurado,
          gratuito: l.gratuito, posicao: l.posicao,
          origem: origens[l.id],
          mascarada: origens[l.id] === "crm" ? mascarar(chavesGravadas[l.id]) : null,
          onde: ONDE_PEGAR[l.id], bloqueado: l.bloqueado,
        }))}
        resumo={diag.resumo}
        risco={diag.risco}
        solucao={diag.solucao}
        somenteGratuitos={soGratuitos}
      />

      <ZeusPainel
        ativo={ativo}
        statusZapi={status ? { configurado: status.configurado, conectado: status.conectado, erro: status.erro ?? null } : null}
        heartbeats={heartbeats.map((h) => ({ nome: h.nome, minutosEsperados: h.minutosEsperados, ultimo: h.ultimo ? h.ultimo.toISOString() : null }))}
        iaConfigurada={iaHabilitada()}
        provedorIA={provedorIANome()}
        contadores={{ mensagensHoje, acoesHoje, correcoes, alertasAbertos }}
        hoje={{
          rascunhos, demandasAuto, followUpsHoje,
          meta: ritmo ? { situacao: ritmo.situacao, resumo: ritmo.resumo, vendasAno: ritmo.vendasAno, metaAnual: ritmo.metaAnual } : null,
        }}
        eventos={eventosRows}
        audits={auditRows}
      />
    </div>
  );
}
