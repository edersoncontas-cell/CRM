// Regra de abertura automática de negociação a partir da conversa do
// WhatsApp (v3). Módulo PURO, sem banco nem IA, para ser testável.
//
// Antes bastava intenção + algo concreto (até um valor solto) — o funil
// enchia de card sem máquina. Agora a IA da conversa só "confirma" que é
// negociação quando levantou de fato:
//   1) QUAL máquina (categoria — retro, escavadeira, pá carregadeira, mini
//      escavadeira, mini carregadeira, motoniveladora/patrol — ou o modelo), E
//   2) mais um dado concreto: condição de pagamento (à vista, financiado,
//      consórcio…) OU visita já agendada.
// Suporte/assunto sem relação nunca abre; só curiosidade sem visita também não.
// Não existe mais etapa de confirmar/descartar no Orientador: o card nasce
// direto no funil — para tirar, é no próprio funil.

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
