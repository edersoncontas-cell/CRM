"use server";

import { revalidatePath } from "next/cache";
import { atualizarAprendizadoOrientador, type AprendizadoOrientador } from "@/lib/zeus/orientador-aprendizado";
import { registrarAudit } from "@/lib/audit";

export async function atualizarAprendizadoOrientadorAction(): Promise<AprendizadoOrientador> {
  const r = await atualizarAprendizadoOrientador();
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: `Aprendizado do Orientador atualizado: ${r.amostra} negociação(ões) fechada(s) analisada(s), jeito de falar ${r.estiloAprendido ? "atualizado" : "sem mensagens suficientes ainda"}.`,
  }).catch(() => {});
  revalidatePath("/configuracoes");
  return r;
}
