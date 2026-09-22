"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";
import { MOTIVOS_PERDA, rotuloMotivoPerda } from "@/lib/pipeline";

// Preencher o motivo de uma perda que ficou sem justificativa.
//
// A seção acusa quais são; sem um jeito de corrigir ali mesmo, a acusação
// viraria só uma cobrança. Ele está olhando a lista — é ali que ele lembra o
// que aconteceu, não abrindo negociação por negociação.

export async function registrarMotivoPerdaAction(
  negociacaoId: string,
  motivoId: string,
  nota: string,
): Promise<{ ok: boolean; erro?: string }> {
  // O id tem que ser um dos motivos conhecidos: o ranking agrupa pela chave,
  // e texto livre no lugar dela criaria uma "categoria" com um item só.
  if (!MOTIVOS_PERDA.some((m) => m.id === motivoId)) return { ok: false, erro: "Motivo inválido." };
  const limpa = nota.trim().slice(0, 300);
  const motivo = limpa ? `${motivoId}: ${limpa}` : motivoId;

  const neg = await db.negociacao.findUnique({
    where: { id: negociacaoId },
    select: { id: true, status: true, clienteId: true, maquinaModelo: true, cliente: { select: { nome: true } } },
  }).catch(() => null);
  if (!neg) return { ok: false, erro: "Negociação não encontrada." };
  if (neg.status !== "perdida") return { ok: false, erro: "Esta negociação não está como perdida." };

  await db.negociacao.update({ where: { id: negociacaoId }, data: { motivoPerda: motivo } });
  await registrarAudit({
    acao: "negociacao_perdida",
    origem: "usuario",
    descricao: `Motivo da perda informado depois: ${neg.maquinaModelo ?? "máquina"} para ${neg.cliente.nome} — ${rotuloMotivoPerda(motivo)}`,
    entidade: "Negociacao",
    entidadeId: negociacaoId,
    clienteId: neg.clienteId,
  }).catch(() => {});

  revalidatePath("/vendas-perdidas");
  revalidatePath("/dashboard");
  return { ok: true };
}
