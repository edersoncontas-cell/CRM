"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checarAgendamento, quandoPorExtenso, MAX_CLIENTES_POR_ENVIO } from "@/lib/envio-programado";
import { registrarAudit } from "@/lib/audit";
import { separarElegiveis } from "@/lib/envio-guarda";
import { motivosDeFora } from "@/lib/envio-limites";

// Agendar, listar e cancelar a mensagem em massa marcada para sair mais tarde.
// A regra de data/hora (fuso de Brasília) e o teto da lista moram em
// lib/envio-programado.ts, que é puro e testado ("use server" não pode exportar
// constante). O disparo é o cron /api/cron/mensagens-programadas, que manda a
// lista grande em ondas até terminar.

export type EnvioProgramadoLista = {
  id: string;
  quando: string;
  quandoTexto: string;
  texto: string;
  total: number;
  status: string;
  temAnexo: boolean;
  enviados: number;
  falhas: number;
  erro: string | null;
};

export async function programarEnvioAction(
  clienteIds: string[],
  texto: string,
  midiaId: string | null,
  diaISO: string,
  horaHM: string,
): Promise<{ ok: boolean; erro?: string; quandoTexto?: string; aviso?: string }> {
  const ids = Array.from(new Set(clienteIds)).filter(Boolean);
  if (!ids.length) return { ok: false, erro: "Nenhum cliente selecionado." };
  if (ids.length > MAX_CLIENTES_POR_ENVIO) return { ok: false, erro: `No máximo ${MAX_CLIENTES_POR_ENVIO} clientes por envio.` };

  // A peneira acontece AQUI, antes de gravar: o envio guarda só quem pode
  // receber. Deixar contato frio na lista para pular depois daria um envio que
  // "saiu para 1.298" e entregou 400 — e o número do vendedor pagaria a conta.
  //
  // Quem nunca mandou mensagem é o maior gatilho de denúncia, e denúncia
  // derruba WhatsApp muito mais rápido que volume. Foi o que restringiu o
  // número por 24h.
  const elegiveis = await separarElegiveis(ids);
  const cortados = elegiveis.frios.length + elegiveis.pediramSaida.length + elegiveis.semTelefone.length;
  if (!elegiveis.liberados.length) {
    const partes = motivosDeFora({
      frios: elegiveis.frios.length,
      pediramSaida: elegiveis.pediramSaida.length,
      semTelefone: elegiveis.semTelefone.length,
    });
    return { ok: false, erro: `Ninguém desta lista pode receber campanha: ${partes}.` };
  }
  const corpo = (texto ?? "").trim();
  if (!corpo && !midiaId) return { ok: false, erro: "Escreva a mensagem ou anexe um arquivo." };

  const check = checarAgendamento(diaISO, horaHM);
  if (!check.ok) return { ok: false, erro: check.erro };

  try {
    await db.envioProgramado.create({
      data: { quando: check.quando, texto: corpo, clienteIds: elegiveis.liberados, midiaId: midiaId || null },
    });
  } catch (e) {
    console.error("[envio-programado] gravar:", e);
    return { ok: false, erro: "Não deu para programar o envio." };
  }

  await registrarAudit({
    acao: "mensagem_enviada", origem: "usuario",
    descricao: `Mensagem programada para ${elegiveis.liberados.length} cliente(s) em ${quandoPorExtenso(check.quando)}${cortados ? ` (${cortados} fora da campanha)` : ""}.`,
  }).catch(() => {});

  revalidatePath("/marketing");
  // O aviso não é enfeite: sem ele o vendedor escolhe 1.298, vê "programado" e
  // acha que os 1.298 vão receber.
  const aviso = cortados
    ? `${elegiveis.liberados.length} ${elegiveis.liberados.length === 1 ? "vai" : "vão"} receber. `
      + `Ficam de fora ${motivosDeFora({
          frios: elegiveis.frios.length,
          pediramSaida: elegiveis.pediramSaida.length,
          semTelefone: elegiveis.semTelefone.length,
        })} — mandar para quem nunca falou com você é o que derruba o número.`
    : undefined;
  return { ok: true, quandoTexto: quandoPorExtenso(check.quando), aviso };
}

export async function listarEnviosProgramadosAction(): Promise<EnvioProgramadoLista[]> {
  try {
    const rows = await db.envioProgramado.findMany({
      orderBy: { quando: "asc" },
      take: 50,
      where: { OR: [{ status: "pendente" }, { processadoEm: { gte: new Date(Date.now() - 7 * 86_400_000) } }] },
    });
    return rows.map((r) => ({
      id: r.id,
      quando: r.quando.toISOString(),
      quandoTexto: quandoPorExtenso(r.quando),
      texto: r.texto,
      total: r.clienteIds.length,
      status: r.status,
      temAnexo: !!r.midiaId,
      enviados: r.enviados,
      falhas: r.falhas,
      erro: r.erro,
    }));
  } catch (e) {
    console.error("[envio-programado] listar:", e);
    return [];
  }
}

/**
 * Cancelar. Vale para o que ainda não saiu E para o que está saindo.
 *
 * Isto é a correção do defeito que custou o segundo bloqueio do número: o
 * cancelamento só pegava status "pendente", e um envio grande passa o dia em
 * "enviando" entre uma onda e outra. O vendedor clicava em cancelar, a tela
 * respondia "este envio já saiu" — e a rodada seguinte continuava mandando,
 * porque a retomada de trava presa reassume justamente o que está em
 * "enviando". Cancelar não cancelava nada.
 *
 * O que já foi entregue não volta; o que falta da lista para de sair.
 */
export async function cancelarEnvioProgramadoAction(id: string): Promise<{ ok: boolean; erro?: string }> {
  const r = await db.envioProgramado.updateMany({
    where: { id, status: { in: ["pendente", "enviando"] } },
    data: { status: "cancelado", processadoEm: new Date() },
  }).catch(() => ({ count: 0 }));
  if (!r.count) return { ok: false, erro: "Este envio já terminou ou já estava cancelado." };
  revalidatePath("/marketing");
  return { ok: true };
}

/**
 * O botão de pânico: cancela TODOS os envios que ainda não terminaram.
 *
 * Existe porque, no dia do bloqueio, cancelar um por um não adiantou — e
 * quando o número está caindo não é hora de caçar item por item numa lista.
 */
export async function cancelarTodosEnviosAction(): Promise<{ ok: boolean; cancelados: number }> {
  const r = await db.envioProgramado.updateMany({
    where: { status: { in: ["pendente", "enviando"] } },
    data: { status: "cancelado", processadoEm: new Date() },
  }).catch(() => ({ count: 0 }));
  await registrarAudit({
    acao: "mensagem_enviada", origem: "usuario",
    descricao: `Envios em massa cancelados de uma vez: ${r.count} envio(s) interrompido(s).`,
  }).catch(() => {});
  revalidatePath("/marketing");
  return { ok: true, cancelados: r.count };
}
