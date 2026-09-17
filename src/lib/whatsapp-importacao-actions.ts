"use server";

// Preparação da importação de conversas do celular: liga o histórico completo
// na instância da Evolution e confere se ela já tem conversas guardadas.

import { provedorWhatsApp, ligarHistoricoCompleto, contarConversasGuardadas } from "@/lib/zapi";

export type PreparoImportacao = {
  provedor: "evolution" | "zapi" | null;
  historico: { ok: boolean; jaEstava: boolean; erro?: string } | null;
  conversasGuardadas: number;
};

export async function prepararImportacaoAction(): Promise<PreparoImportacao> {
  const provedor = provedorWhatsApp();
  if (provedor !== "evolution") {
    return { provedor, historico: null, conversasGuardadas: await contarConversasGuardadas() };
  }
  const [historico, conversasGuardadas] = await Promise.all([ligarHistoricoCompleto(), contarConversasGuardadas()]);
  return { provedor, historico, conversasGuardadas };
}
