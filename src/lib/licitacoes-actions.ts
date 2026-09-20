"use server";

import { revalidatePath } from "next/cache";
import { atualizarLicitacoes, type LicitacoesGuardadas } from "@/lib/licitacoes";

/**
 * Manda o robô das licitações rodar AGORA.
 *
 * Sem isto, a única forma de rebuscar era esperar a passada de 6 horas do
 * cron — e quando o painel parecia errado não havia como olhar de novo nem
 * como saber se ele tinha rodado. O resultado volta para a tela com o
 * diagnóstico por modalidade: quantos editais foram lidos e o que falhou.
 */
export async function atualizarLicitacoesAction(): Promise<LicitacoesGuardadas> {
  const r = await atualizarLicitacoes();
  revalidatePath("/dashboard");
  return r;
}
