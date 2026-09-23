"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarExclusaoConversa, limparRastroDeClientes } from "@/lib/whatsapp-corte";
import { registrarAudit } from "@/lib/audit";

// Excluir VÁRIAS conversas de uma vez.
//
// Existe por dois motivos, e os dois vieram de olhar o que já havia:
//
// 1. A tela mandava um DELETE por conversa, todos em paralelo. Com "selecionar
//    todas" isso viraria centenas de requisições ao mesmo tempo — o servidor
//    engasga e parte some sem ninguém saber quais. Aqui é uma chamada só, em
//    lotes, com a conta do que saiu.
//
// 2. "apagando as conversas quero que as mensagens não sigam". Apagar a
//    conversa já apaga as mensagens dela (o banco tem cascata). O que NÃO
//    parava era o envio em massa: ele guarda a lista por CLIENTE, não por
//    conversa. Com a conversa apagada e o cliente ainda na lista, a rodada
//    seguinte criaria a conversa de novo e mandaria. Por isso o cliente sai
//    dos envios que ainda não terminaram, no mesmo movimento.

/** Quantas conversas por lote. Cada uma é um DELETE com cascata. */
const LOTE = 25;

export type ResultadoExclusao = {
  ok: boolean;
  excluidas: number;
  /** Clientes tirados de envios em massa que ainda não terminaram. */
  tiradosDeEnvio: number;
  erro?: string;
};

export async function excluirConversasAction(ids: string[]): Promise<ResultadoExclusao> {
  const lista = Array.from(new Set(ids)).filter(Boolean);
  if (!lista.length) return { ok: true, excluidas: 0, tiradosDeEnvio: 0 };

  try {
    const convs = await db.whatsAppConversation.findMany({
      where: { id: { in: lista } },
      select: { id: true, externalPhone: true, lid: true, isGroup: true, clienteId: true },
    });
    if (!convs.length) return { ok: true, excluidas: 0, tiradosDeEnvio: 0 };

    let excluidas = 0;
    for (let i = 0; i < convs.length; i += LOTE) {
      const lote = convs.slice(i, i + LOTE);
      const r = await db.whatsAppConversation.deleteMany({ where: { id: { in: lote.map((c) => c.id) } } });
      excluidas += r.count;
      // O registro de exclusão é o que impede a conversa de voltar por
      // importação de histórico. Best-effort: falhar aqui não pode desfazer
      // o que já foi apagado.
      for (const c of lote) await registrarExclusaoConversa(c).catch(() => {});
    }

    const clientes = convs.map((c) => c.clienteId).filter((x): x is string => !!x);
    const tiradosDeEnvio = await tirarDosEnviosPendentes(clientes);
    if (clientes.length) await limparRastroDeClientes([...new Set(clientes)]).catch(() => {});

    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `${excluidas} conversa(s) excluída(s) do CRM${tiradosDeEnvio ? ` · ${tiradosDeEnvio} cliente(s) tirado(s) de envio em massa que ainda não terminou` : ""}.`,
    }).catch(() => {});

    revalidatePath("/atendimento");
    return { ok: true, excluidas, tiradosDeEnvio };
  } catch (e) {
    console.error("[excluir-conversas]", e);
    return { ok: false, excluidas: 0, tiradosDeEnvio: 0, erro: "Não deu para excluir agora." };
  }
}

/**
 * Tira estes clientes de todo envio em massa que ainda não terminou.
 *
 * Sem isto, apagar a conversa não impede nada: o envio guarda clienteIds, a
 * rodada seguinte recria a conversa e manda. É o pedido "apagando as conversas
 * quero que as mensagens não sigam" virando código.
 *
 * O cursor (enviadosAte) é recalculado junto: ele é uma POSIÇÃO na lista, e
 * encurtar a lista sem mexer nele faria o envio pular gente que ainda não
 * recebeu — ou repetir para quem já recebeu.
 */
async function tirarDosEnviosPendentes(clienteIds: string[]): Promise<number> {
  const alvo = new Set(clienteIds);
  if (!alvo.size) return 0;
  const envios = await db.envioProgramado.findMany({
    where: { status: { in: ["pendente", "enviando"] } },
    select: { id: true, clienteIds: true, enviadosAte: true },
  }).catch(() => []);

  let tirados = 0;
  for (const e of envios) {
    const antes = e.clienteIds;
    const jaEnviados = antes.slice(0, Math.max(0, e.enviadosAte));
    const restantes = antes.slice(Math.max(0, e.enviadosAte));
    const restantesLimpos = restantes.filter((id) => !alvo.has(id));
    const removidos = restantes.length - restantesLimpos.length;
    if (!removidos) continue;
    tirados += removidos;
    // A parte já enviada fica intacta e o cursor continua apontando para o
    // fim dela — só a fila da frente encurta.
    const nova = [...jaEnviados, ...restantesLimpos];
    await db.envioProgramado.update({
      where: { id: e.id },
      data: { clienteIds: nova, enviadosAte: jaEnviados.length },
    }).catch(() => {});
  }
  return tirados;
}
