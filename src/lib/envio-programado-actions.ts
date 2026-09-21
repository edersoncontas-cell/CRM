"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checarAgendamento, quandoPorExtenso, MAX_CLIENTES_POR_ENVIO } from "@/lib/envio-programado";
import { registrarAudit } from "@/lib/audit";

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
): Promise<{ ok: boolean; erro?: string; quandoTexto?: string }> {
  const ids = Array.from(new Set(clienteIds)).filter(Boolean);
  if (!ids.length) return { ok: false, erro: "Nenhum cliente selecionado." };
  if (ids.length > MAX_CLIENTES_POR_ENVIO) return { ok: false, erro: `No máximo ${MAX_CLIENTES_POR_ENVIO} clientes por envio.` };
  const corpo = (texto ?? "").trim();
  if (!corpo && !midiaId) return { ok: false, erro: "Escreva a mensagem ou anexe um arquivo." };

  const check = checarAgendamento(diaISO, horaHM);
  if (!check.ok) return { ok: false, erro: check.erro };

  try {
    await db.envioProgramado.create({
      data: { quando: check.quando, texto: corpo, clienteIds: ids, midiaId: midiaId || null },
    });
  } catch (e) {
    console.error("[envio-programado] gravar:", e);
    return { ok: false, erro: "Não deu para programar o envio." };
  }

  await registrarAudit({
    acao: "mensagem_enviada", origem: "usuario",
    descricao: `Mensagem programada para ${ids.length} cliente(s) em ${quandoPorExtenso(check.quando)}.`,
  }).catch(() => {});

  revalidatePath("/marketing");
  return { ok: true, quandoTexto: quandoPorExtenso(check.quando) };
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

/** Cancelar só vale para o que ainda não saiu — mensagem enviada não volta. */
export async function cancelarEnvioProgramadoAction(id: string): Promise<{ ok: boolean; erro?: string }> {
  const r = await db.envioProgramado.updateMany({
    where: { id, status: "pendente" },
    data: { status: "cancelado", processadoEm: new Date() },
  }).catch(() => ({ count: 0 }));
  if (!r.count) return { ok: false, erro: "Este envio já saiu ou já estava cancelado." };
  revalidatePath("/marketing");
  return { ok: true };
}
