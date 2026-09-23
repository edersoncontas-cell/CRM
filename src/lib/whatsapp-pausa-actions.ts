"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { envioPausado, definirPausa } from "@/lib/whatsapp-pausa";
import { registrarAudit } from "@/lib/audit";
import { lerConfigAniversario } from "@/lib/aniversario-automatico";
import { lerParametros } from "@/lib/parametros";

export type ItemFila = { o_que: string; quantos: number; onde: string | null };

export type EstadoPausa = {
  pausado: boolean;
  /** Envios em massa que ainda não terminaram. */
  naFila: number;
  /** TUDO que voltaria a sair se ele liberasse — uma linha por caminho. */
  fila: ItemFila[];
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
  const [pausado, naFila, falhadas, aniv, params] = await Promise.all([
    envioPausado(),
    db.envioProgramado.count({ where: { status: { in: ["pendente", "enviando"] } } }).catch(() => 0),
    // retryCount < 3 é a condição do cron de reenvio: acima disso ele desiste,
    // então essas já não saem mais e não devem assustar.
    db.whatsAppMessage.count({
      where: { direction: "OUT", sendStatus: "FAILED", isDraft: false, retryCount: { lt: 3 } },
    }).catch(() => 0),
    lerConfigAniversario().catch(() => ({ ativo: false, texto: "" })),
    lerParametros().catch(() => null),
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
  return { pausado, naFila, fila };
}

/**
 * Liberar ou pausar o envio.
 *
 * Liberar é ato consciente e por isso exige a confirmação por escrito na tela:
 * foi um "pode mandar" implícito que derrubou o número duas vezes. Pausar, ao
 * contrário, é imediato e sem pergunta — na hora do aperto ninguém deve ter
 * que responder nada.
 */
export async function definirPausaAction(pausar: boolean): Promise<{ ok: boolean; pausado: boolean }> {
  await definirPausa(pausar);
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: pausar
      ? "Envio de WhatsApp PAUSADO: nenhuma mensagem sai do CRM."
      : "Envio de WhatsApp LIBERADO pelo vendedor.",
  }).catch(() => {});
  revalidatePath("/configuracoes");
  revalidatePath("/marketing");
  return { ok: true, pausado: pausar };
}
