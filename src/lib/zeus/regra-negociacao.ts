// Regra de abertura automática de negociação (v3). Módulo PURO, sem banco nem
// IA, para ser testável.
//
// HOJE SÓ VALE PARA O RELATO DE VISITA do vendedor (voz e visitas do dia). A
// conversa do WhatsApp NÃO abre negociação sozinha desde a v46: ele não gostou
// do que a IA punha no funil, e agora transforma a conversa em oportunidade
// por um botão (lib/oportunidade-da-conversa.ts). Ver alimentarNegociacao.
//
// Antes bastava intenção + algo concreto (até um valor solto) — o funil
// enchia de card sem máquina. Agora a IA da conversa só "confirma" que é
// negociação quando levantou de fato:
//   1) QUAL máquina (categoria — retro, escavadeira, pá carregadeira, mini
//      escavadeira, mini carregadeira, motoniveladora/patrol — ou o modelo), E
//   2) mais um dado concreto: condição de pagamento (à vista, financiado,
//      consórcio…) OU visita já agendada.
// Suporte/assunto sem relação nunca abre; só curiosidade sem visita também não.

export type SinaisNegociacao = {
  intencao: "comprar" | "cotar" | "curiosidade" | "suporte" | "outro";
  ehProspectReal: boolean;
  maquina: string | null;
  categoriaMaquina: string | null;
  condicaoPagamento: string | null;
  dataVisita: Date | null;
};

export type MotivoNaoAbrir = "suporte_ou_outro" | "nao_e_prospect" | "sem_maquina" | "so_curiosidade" | "sem_pagamento_nem_visita";

// null = abre a negociação; senão, por que ainda não.
export function motivoNaoAbrirNegociacao(ex: SinaisNegociacao): MotivoNaoAbrir | null {
  if (ex.intencao === "suporte" || ex.intencao === "outro") return "suporte_ou_outro";
  if (!ex.ehProspectReal) return "nao_e_prospect";
  const temMaquina = !!(ex.maquina?.trim() || ex.categoriaMaquina?.trim());
  if (!temMaquina) return "sem_maquina";
  const temVisita = !!ex.dataVisita;
  if (ex.intencao === "curiosidade" && !temVisita) return "so_curiosidade";
  const temPagamento = !!ex.condicaoPagamento?.trim();
  if (!temPagamento && !temVisita) return "sem_pagamento_nem_visita";
  return null;
}

export function deveAbrirNegociacao(ex: SinaisNegociacao): boolean {
  return motivoNaoAbrirNegociacao(ex) === null;
}
