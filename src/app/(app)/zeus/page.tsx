import { db } from "@/lib/db";
import { statusConexao } from "@/lib/zapi";
import { ultimoHeartbeat, zeusAtivo } from "@/lib/zeus/estado";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { iaHabilitada, provedorIANome } from "@/lib/ai";
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

  const [status, ativo, , heartbeats, eventos, audits, mensagensHoje, acoesHoje, correcoes, alertasAbertos, rascunhos, cadenciasAtivas, demandasAuto, followUpsHoje, ritmo] = await Promise.all([
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
    db.cadencia.count({ where: { ativa: true } }),
    db.tarefaKanban.count({ where: { coluna: "demandas", origem: { not: "manual" } } }),
    db.zeusEvent.count({ where: { tipo: "acao", criadoEm: { gte: inicioDia } } }),
    calcularRitmoMetas().catch(() => null),
  ]);

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

      <ZeusPainel
        ativo={ativo}
        statusZapi={status ? { configurado: status.configurado, conectado: status.conectado, erro: status.erro ?? null } : null}
        heartbeats={heartbeats.map((h) => ({ nome: h.nome, minutosEsperados: h.minutosEsperados, ultimo: h.ultimo ? h.ultimo.toISOString() : null }))}
        iaConfigurada={iaHabilitada()}
        provedorIA={provedorIANome()}
        contadores={{ mensagensHoje, acoesHoje, correcoes, alertasAbertos }}
        hoje={{
          rascunhos, cadenciasAtivas, demandasAuto, followUpsHoje,
          meta: ritmo ? { situacao: ritmo.situacao, resumo: ritmo.resumo, vendasAno: ritmo.vendasAno, metaAnual: ritmo.metaAnual } : null,
        }}
        eventos={eventosRows}
        audits={auditRows}
      />
    </div>
  );
}
