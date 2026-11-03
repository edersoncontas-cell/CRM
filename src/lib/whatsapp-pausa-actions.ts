"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { envioPausado, definirPausa } from "@/lib/whatsapp-pausa";
import { registrarAudit } from "@/lib/audit";
import { lerConfigAniversario } from "@/lib/aniversario-automatico";
import { lerParametros } from "@/lib/parametros";
import { lerLimitesEnvio } from "@/lib/envio-guarda";
import { descreverRitmo } from "@/lib/envio-limites";
import { PALAVRA_LIBERAR, confirmouLiberar } from "@/lib/whatsapp-pausa-regra";

// 03/11: o card voltou, agora no topo do Marketing (components/TravaEnvio.tsx).
// Ficou sem tela de 01/10 a 03/11 — e sem tela a trava nascia pausada e NUNCA
// podia ser liberada, então nenhuma campanha saía. Não liberar por outro
// caminho: a trava geral é esta.

export type ItemFila = { o_que: string; quantos: number; onde: string | null };

export type EstadoPausa = {
  pausado: boolean;
  /** Envios em massa que ainda não terminaram. */
  naFila: number;
  /** TUDO que voltaria a sair se ele liberasse — uma linha por caminho. */
  fila: ItemFila[];
  /** "Sai no ritmo de 5 por hora… das 8h às 18h, em dias úteis." */
  ritmo: string;
};

/**
 * O que ainda sairia se o envio fosse liberado, em um lugar só.
 *
 * Existe porque ele perguntou "tem outros na fila?" e a resposta estava
 * espalhada: campanha numa tela, mensagem com erro em outra, aniversário e
 * briefing em lugar nenhum. Quem precisa somar cinco telas para saber se o
 * número está seguro não soma — arrisca.
 *
 * São CINCO os caminhos que mandam mensagem neste CRM (os crons que chamam
 * envio): campanha programada, reenvio do que falhou, parabéns de
 * aniversário, briefing diário e a resposta automática do ZEUS. Todos passam
 * pela trava geral; esta lista diz o que cada um tem engatilhado.
 */
export async function lerPausaAction(): Promise<EstadoPausa> {
  const [pausado, naFila, falhadas, aniv, params, lim] = await Promise.all([
    envioPausado(),
    db.envioProgramado.count({ where: { status: { in: ["pendente", "enviando"] } } }).catch(() => 0),
    // retryCount < 3 é a condição do cron de reenvio: acima disso ele desiste,
    // então essas já não saem mais e não devem assustar.
    db.whatsAppMessage.count({
      where: { direction: "OUT", sendStatus: "FAILED", isDraft: false, retryCount: { lt: 3 } },
    }).catch(() => 0),
    lerConfigAniversario().catch(() => ({ ativo: false, texto: "" })),
    lerParametros().catch(() => null),
    lerLimitesEnvio(),
  ]);

  const fila: ItemFila[] = [];
  if (naFila > 0) {
    fila.push({ o_que: `${naFila} envio(s) em massa sem terminar`, quantos: naFila, onde: "/marketing" });
  }
  if (falhadas > 0) {
    fila.push({ o_que: `${falhadas} mensagem(ns) com erro na fila de reenvio`, quantos: falhadas, onde: null });
  }
  if (aniv.ativo) {
    fila.push({ o_que: "Parabéns de aniversário automático está LIGADO", quantos: 0, onde: "/marketing" });
  }
  if (params?.whatsappBriefing) {
    fila.push({ o_que: "Briefing diário no seu próprio número está ligado", quantos: 0, onde: "/configuracoes" });
  }
  return { pausado, naFila, fila, ritmo: descreverRitmo(0, lim) };
}

/**
 * Liberar ou pausar o envio.
 *
 * Liberar é ato consciente e por isso exige a confirmação por escrito
 * (digitar LIBERAR): foi um "pode mandar" implícito que derrubou o número duas
 * vezes. A exigência é conferida AQUI, no servidor, e não só na tela — uma tela
 * antiga, ou qualquer chamada direta, não libera sem a palavra. Pausar, ao
 * contrário, é imediato e sem pergunta: na hora do aperto ninguém deve ter que
 * responder nada.
 */
export async function definirPausaAction(
  pausar: boolean,
  confirmacao?: string,
): Promise<{ ok: boolean; pausado: boolean; erro?: string }> {
  if (!pausar && !confirmouLiberar(confirmacao)) {
    return { ok: false, pausado: await envioPausado(), erro: `Para liberar, digite ${PALAVRA_LIBERAR} na caixa.` };
  }
  try {
    await definirPausa(pausar);
  } catch (e) {
    console.error("[trava-envio] gravar:", e);
    // Falha ao gravar: o estado real é o que o banco ainda tem — e na dúvida,
    // pausado (envioPausado devolve true quando não consegue ler).
    return { ok: false, pausado: await envioPausado(), erro: "Não consegui gravar (banco sem resposta). Nada mudou." };
  }
  await registrarAudit({
    acao: "trava_envio_alterada", origem: "usuario",
    descricao: pausar
      ? "Envio de WhatsApp PAUSADO: nenhuma mensagem sai do CRM."
      : "Envio de WhatsApp LIBERADO pelo vendedor.",
  }).catch(() => {});
  revalidatePath("/configuracoes");
  revalidatePath("/marketing");
  return { ok: true, pausado: pausar };
}
