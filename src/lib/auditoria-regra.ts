// Regras da tela de Auditoria (puras, testáveis).
//
// O defeito: o registro tem cinco origens (ia, usuario, sistema, zeus,
// cerebro — lib/audit.ts), mas a tela só contava três. Tudo o que o ZEUS e o
// Cérebro fizeram sozinhos ficava fora de "Ações da IA", não tinha filtro e
// aparecia com o selo "sistema".

import type { AcaoAudit, OrigemAudit } from "@/lib/audit";

/** Tudo o que a IA fez sozinha, venha de onde vier. */
export const ORIGENS_IA: readonly OrigemAudit[] = ["ia", "zeus", "cerebro"];

export function ehOrigemIA(origem: string): boolean {
  return (ORIGENS_IA as readonly string[]).includes(origem);
}

export function rotuloOrigem(origem: string): string {
  if (origem === "zeus") return "IA · ZEUS";
  if (origem === "cerebro") return "IA · Cérebro";
  if (origem === "ia") return "IA";
  if (origem === "usuario") return "usuário";
  return "sistema";
}

/** O filtro da tela: "ia" pega as três origens da IA. */
export function filtroDeOrigem(origem: string | undefined): string | { in: string[] } | undefined {
  if (!origem) return undefined;
  return origem === "ia" ? { in: [...ORIGENS_IA] } : origem;
}

/** Soma os contadores do banco nos três grupos da tela. Origem desconhecida conta como sistema. */
export function contarPorGrupo(contadores: { origem: string; total: number }[]): { ia: number; usuario: number; sistema: number } {
  const r = { ia: 0, usuario: 0, sistema: 0 };
  for (const c of contadores) {
    if (ehOrigemIA(c.origem)) r.ia += c.total;
    else if (c.origem === "usuario") r.usuario += c.total;
    else r.sistema += c.total;
  }
  return r;
}

// Record<AcaoAudit, …>: ação nova no lib/audit.ts sem rótulo aqui não compila
// — é o que impede a tela de voltar a mostrar o código cru da ação.
export const ROTULO_ACAO: Record<AcaoAudit, string> = {
  cliente_criado: "Cliente criado",
  cliente_atualizado: "Cliente atualizado",
  negociacao_criada: "Negociação criada",
  negociacao_atualizada: "Negociação atualizada",
  negociacao_ganha: "Venda fechada",
  negociacao_perdida: "Venda perdida",
  visita_detectada: "Visita detectada",
  conversa_analisada: "Conversa analisada",
  conversa_classificada: "Conversa classificada",
  campanha_enviada: "Campanha enviada",
  post_gerado: "Post gerado",
  mensagem_enviada: "Mensagem enviada",
  perfil_atualizado: "Perfil atualizado",
  modo_fim_de_semana: "Modo fim de semana",
  tarefa_criada: "Tarefa criada",
  zeus_ativo_alterado: "ZEUS ligado/desligado",
  chave_ia_alterada: "Chave de IA alterada",
  dados_provisorio_trazidos: "Dados do banco provisório trazidos",
  area_atuacao_alterada: "Área de atuação alterada",
  offline_sincronizado: "Subiu do modo sem sinal",
};

export function rotuloAcao(acao: string): string {
  return (ROTULO_ACAO as Record<string, string>)[acao] ?? acao;
}
