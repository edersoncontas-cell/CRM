// A limpeza automática de "contatos que não são clientes" nunca apaga quem
// tem vida comercial no CRM (pura, testável).
//
// A limpeza roda sozinha (manutenção, e toda hora com o Google Contatos) e
// apaga pelo NOME: se ele bate com um termo da lista de bloqueio, some o
// cliente com negociações, visitas e pós-venda em cascata — sem volta. Um
// termo largo na lista ("central", "brasil") levava junto a "Terraplenagem
// Central" com a venda em andamento.
//
// Regra: quem tem negociação, visita, pós-venda ou compra registrada FICA.
// Só sai assim mesmo quando a decisão foi dele, à mão: asterisco no nome na
// agenda, ou "excluir" na lista de Clientes. Termo da lista não é decisão
// sobre aquela pessoa — é palpite sobre um nome.

import { MOTIVO_ASTERISCO, MOTIVO_EXCLUIDO_MANUAL } from "@/lib/utils";

export function decisaoDoVendedor(motivo: string | null | undefined): boolean {
  return motivo === MOTIVO_ASTERISCO || motivo === MOTIVO_EXCLUIDO_MANUAL;
}

/** A limpeza automática pode apagar este cliente? */
export function podeApagarNaLimpeza(args: { temHistorico: boolean; motivo: string | null | undefined }): boolean {
  if (!args.temHistorico) return true;
  return decisaoDoVendedor(args.motivo);
}
