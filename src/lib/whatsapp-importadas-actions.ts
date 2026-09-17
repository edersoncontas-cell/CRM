"use server";

import { revalidatePath } from "next/cache";
import { registrarAudit } from "@/lib/audit";
import { resumoImportadas, repararImportadas, type ResumoImportadas, type ResultadoReparo } from "@/lib/whatsapp-importadas";

const PAGINAS = ["/atendimento", "/clientes", "/orientador", "/configuracoes"];

export async function lerImportadasAction(): Promise<ResumoImportadas> {
  return resumoImportadas();
}

export async function repararImportadasAction(): Promise<ResultadoReparo> {
  const r = await repararImportadas();
  if (r.mescladas + r.vinculadas > 0) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `Conversas importadas consertadas: ${r.vinculadas} vinculada(s) ao cadastro, ${r.mescladas} juntada(s) à conversa real (${r.mensagensMovidas} mensagem(ns) movidas).`,
    }).catch(() => {});
    for (const p of PAGINAS) revalidatePath(p);
  }
  return r;
}
