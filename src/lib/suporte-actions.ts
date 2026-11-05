"use server";

import { revalidatePath } from "next/cache";
import { setConfig } from "@/lib/config";
import { registrarAudit } from "@/lib/audit";
import { mudarStatusTicket } from "@/lib/suporte";
import { CHAVE_RECURSO_SUPORTE, statusValido } from "@/lib/suporte-regra";

export async function mudarStatusTicketAction(id: string, status: string): Promise<{ ok: boolean; erro?: string }> {
  if (!statusValido(status)) return { ok: false, erro: "Status inválido." };
  try {
    const ok = await mudarStatusTicket(id, status);
    if (!ok) return { ok: false, erro: "Pedido não encontrado." };
    revalidatePath("/suporte");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar o status. Tente de novo." };
  }
}

export async function ligarSuporteAction(ligar: boolean): Promise<{ ok: boolean; erro?: string }> {
  try {
    await setConfig(CHAVE_RECURSO_SUPORTE, ligar ? "ligado" : "desligado");
    await registrarAudit({
      acao: "perfil_atualizado", origem: "usuario",
      descricao: ligar ? "Suporte e sugestões ligado em Configurações." : "Suporte e sugestões desligado em Configurações.",
    }).catch(() => {});
    // O botão flutuante está no layout: todas as telas mudam.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar. O banco não respondeu." };
  }
}
