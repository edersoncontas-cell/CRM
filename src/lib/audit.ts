import { db } from "@/lib/db";

export type AcaoAudit =
  | "cliente_criado"
  | "cliente_atualizado"
  | "negociacao_criada"
  | "negociacao_atualizada"
  | "negociacao_ganha"
  | "negociacao_perdida"
  | "visita_detectada"
  | "conversa_analisada"
  | "conversa_classificada"
  | "campanha_enviada"
  | "post_gerado"
  | "mensagem_enviada"
  | "perfil_atualizado"
  | "modo_fim_de_semana"
  | "tarefa_criada"
  | "zeus_ativo_alterado"
  // Chave de provedor de IA ligada/trocada/apagada pela tela do CRM. O
  // registro guarda o FATO e o provedor, nunca o valor da chave.
  | "chave_ia_alterada";

export type OrigemAudit = "ia" | "usuario" | "sistema" | "zeus" | "cerebro";

interface AuditOpts {
  acao: AcaoAudit;
  origem?: OrigemAudit;
  descricao: string;
  entidade?: string;
  entidadeId?: string;
  clienteId?: string;
  extra?: Record<string, unknown>;
}

export async function registrarAudit(opts: AuditOpts): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        acao: opts.acao,
        origem: opts.origem ?? "ia",
        descricao: opts.descricao,
        entidade: opts.entidade ?? null,
        entidadeId: opts.entidadeId ?? null,
        clienteId: opts.clienteId ?? null,
        extra: opts.extra ? JSON.stringify(opts.extra) : null,
      },
    });
  } catch {
    // Audit failure never breaks the main flow
  }
}
