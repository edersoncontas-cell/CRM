import { db } from "@/lib/db";
import { statusConexao } from "@/lib/zapi";
import { ultimoHeartbeat, zeusAtivo } from "@/lib/zeus/estado";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { ZeusPainel, type ZeusEventoRow, type AuditRow } from "@/components/ZeusPainel";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const CRONS_MONITORADOS = [
  { nome: "zeus-tick", minutosEsperados: 5 },
  { nome: "zeus-pipeline", minutosEsperados: 1 },
  { nome: "agnes-dispatch", minutosEsperados: 1 },
  { nome: "whatsapp-retry", minutosEsperados: 5 },
  { nome: "zeus-diario", minutosEsperados: 24 * 60 },
];

export default async function ZeusPage() {
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);

  const [status, ativo, settings, heartbeats, eventos, audits, mensagensHoje, acoesHoje, correcoes, alertasAbertos] = await Promise.all([
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
  ]);

  const eventosRows: ZeusEventoRow[] = eventos.map((e) => ({
    id: e.id, tipo: e.tipo, severidade: e.severidade, titulo: e.titulo, detalhe: e.detalhe, resolvido: e.resolvido, criadoEm: e.criadoEm.toISOString(),
  }));
  const auditRows: AuditRow[] = audits.map((a) => ({ id: a.id, acao: a.acao, descricao: a.descricao, criadoEm: a.criadoEm.toISOString() }));

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
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
        auditMode={settings.auditMode}
        statusZapi={status ? { configurado: status.configurado, conectado: status.conectado, erro: status.erro ?? null } : null}
        heartbeats={heartbeats.map((h) => ({ nome: h.nome, minutosEsperados: h.minutosEsperados, ultimo: h.ultimo ? h.ultimo.toISOString() : null }))}
        anthropicConfigurado={!!process.env.ANTHROPIC_API_KEY}
        contadores={{ mensagensHoje, acoesHoje, correcoes, alertasAbertos }}
        eventos={eventosRows}
        audits={auditRows}
      />
    </div>
  );
}
