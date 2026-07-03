"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { registrarAudit } from "@/lib/audit";
import { definirZeusAtivo, zeusAtivo } from "@/lib/zeus/estado";
import { executarZeusTick, type ResumoTick } from "@/lib/zeus/tick";

// Kill-switch global do ZEUS (item 7 da Fase 4: autonomia com governança).
export async function alternarZeusAtivoAction(ativo: boolean): Promise<{ ok: boolean }> {
  await definirZeusAtivo(ativo);
  await registrarAudit({
    acao: "zeus_ativo_alterado",
    origem: "usuario",
    descricao: ativo ? "ZEUS reativado pelo vendedor." : "ZEUS pausado pelo vendedor (kill-switch).",
  });
  revalidatePath("/zeus");
  return { ok: true };
}

// Modo auditoria do auto-responder (mesmo toggle já usado em /atendimento).
export async function alternarAuditModeAction(auditMode: boolean): Promise<{ ok: boolean }> {
  const s = await getWaSettings();
  await db.whatsAppSettings.update({ where: { id: s.id }, data: { auditMode } });
  revalidatePath("/zeus");
  revalidatePath("/atendimento");
  return { ok: true };
}

// Botão "Forçar tick" — roda a mesma função do cron, sob demanda.
export async function forcarZeusTickAction(): Promise<ResumoTick> {
  const resumo = await executarZeusTick();
  revalidatePath("/zeus");
  return resumo;
}

export async function resolverZeusEventoAction(id: string): Promise<{ ok: boolean }> {
  await db.zeusEvent.update({ where: { id }, data: { resolvido: true } });
  revalidatePath("/zeus");
  return { ok: true };
}

export async function statusZeusAction(): Promise<{ ativo: boolean }> {
  return { ativo: await zeusAtivo() };
}
