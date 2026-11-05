// Suporte e sugestões — leitura e gravação no banco. Só servidor.
// Regras puras (validação, limites, prompt pronto) em lib/suporte-regra.ts.

import { cache } from "react";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import {
  CHAVE_RECURSO_SUPORTE, recursoLigado, assuntoDe, gerarPromptPronto, LIMITES,
  type NovoTicketEntrada, type AnexoEntrada, type LadoMensagem, type StatusTicket,
} from "@/lib/suporte-regra";

/** O recurso está ligado? Banco fora do ar ou erro = desligado. Memoizado por requisição. */
export const suporteLigado = cache(async (): Promise<boolean> => {
  try {
    return recursoLigado(await getConfig(CHAVE_RECURSO_SUPORTE));
  } catch {
    return false;
  }
});

/** Pedidos novos (ainda sem análise). Erro ou tabela ausente = null (a tela não mostra número falso). */
export async function contarTicketsNovos(): Promise<number | null> {
  try {
    return await db.ticket.count({ where: { status: "novo" } });
  } catch {
    return null;
  }
}

export async function ticketsNaUltimaHora(): Promise<number> {
  return db.ticket.count({ where: { criadoEm: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
}

type AnexoValido = AnexoEntrada & { tamanho: number };

export async function criarTicket(e: NovoTicketEntrada, anexos: AnexoValido[]): Promise<{ id: string; assunto: string }> {
  return db.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        assunto: assuntoDe(e.descricao),
        descricao: e.descricao,
        porQueImporta: e.porQue,
        tela: e.tela,
        contexto: e.contexto,
        mensagens: {
          create: {
            lado: "vendedor",
            texto: e.porQue ? `${e.descricao}\n\nPor que é importante: ${e.porQue}` : e.descricao,
            anexos: { create: anexos.map((a) => ({ mimeType: a.mimeType, nome: a.nome, tamanho: a.tamanho, base64: a.base64 })) },
          },
        },
      },
    });
    const promptPronto = gerarPromptPronto({
      id: t.id, descricao: e.descricao, porQue: e.porQue, tela: e.tela, anexos: anexos.length, criadoEm: t.criadoEm,
    });
    await tx.ticket.update({ where: { id: t.id }, data: { promptPronto } });
    return { id: t.id, assunto: t.assunto };
  });
}

export async function responderTicket(ticketId: string, lado: LadoMensagem, texto: string, anexos: AnexoValido[]): Promise<boolean> {
  const existe = await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } });
  if (!existe) return false;
  await db.$transaction([
    db.ticketMensagem.create({
      data: {
        ticketId, lado, texto: texto.slice(0, LIMITES.resposta),
        anexos: { create: anexos.map((a) => ({ mimeType: a.mimeType, nome: a.nome, tamanho: a.tamanho, base64: a.base64 })) },
      },
    }),
    // O vendedor voltou a escrever num pedido fechado: reabre para análise.
    db.ticket.update({
      where: { id: ticketId },
      data: {
        atualizadoEm: new Date(),
        ...(lado === "vendedor" && (existe.status === "implementado" || existe.status === "descartado") ? { status: "novo" } : {}),
      },
    }),
  ]);
  return true;
}

export async function mudarStatusTicket(id: string, status: StatusTicket): Promise<boolean> {
  const r = await db.ticket.updateMany({ where: { id }, data: { status, atualizadoEm: new Date() } });
  return r.count > 0;
}

export type TicketLista = Awaited<ReturnType<typeof listarTickets>>[number];

/** Lista com conversa e dados dos anexos — nunca o base64. */
export async function listarTickets() {
  return db.ticket.findMany({
    orderBy: { atualizadoEm: "desc" },
    take: 100,
    select: {
      id: true, assunto: true, descricao: true, porQueImporta: true, tela: true, status: true,
      promptPronto: true, criadoEm: true, atualizadoEm: true,
      mensagens: {
        orderBy: { criadoEm: "asc" },
        select: {
          id: true, lado: true, texto: true, criadoEm: true,
          anexos: { select: { id: true, nome: true, mimeType: true, tamanho: true } },
        },
      },
    },
  });
}

export async function lerAnexo(id: string) {
  return db.ticketAnexo.findUnique({ where: { id }, select: { mimeType: true, nome: true, base64: true } });
}
