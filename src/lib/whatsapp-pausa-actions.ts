"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { envioPausado, definirPausa } from "@/lib/whatsapp-pausa";
import { registrarAudit } from "@/lib/audit";

export type EstadoPausa = { pausado: boolean; naFila: number };

export async function lerPausaAction(): Promise<EstadoPausa> {
  const [pausado, naFila] = await Promise.all([
    envioPausado(),
    db.envioProgramado.count({ where: { status: { in: ["pendente", "enviando"] } } }).catch(() => 0),
  ]);
  return { pausado, naFila };
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
