"use server";

import { revalidatePath } from "next/cache";
import { registrarAudit } from "@/lib/audit";
import {
  dataCorteWhatsApp, definirDataCorte, contarConversasAnteriores, apagarConversasAnteriores, type ResultadoLimpezaConversas,
} from "@/lib/whatsapp-corte";
import { inicioDoDiaBrasilia, diaBrasiliaISO } from "@/lib/whatsapp-corte-regra";

export type EstadoCorte = { dia: string | null; conversasAnteriores: number };

const PAGINAS = ["/atendimento", "/central", "/configuracoes", "/dashboard"];

function validarDia(dia: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("Data inválida.");
  return dia;
}

export async function lerEstadoCorteAction(): Promise<EstadoCorte> {
  const corte = await dataCorteWhatsApp();
  return { dia: corte ? diaBrasiliaISO(corte) : null, conversasAnteriores: corte ? await contarConversasAnteriores(corte) : 0 };
}

export async function contarConversasAnterioresAction(dia: string): Promise<number> {
  return contarConversasAnteriores(inicioDoDiaBrasilia(validarDia(dia)));
}

export async function definirDataCorteAction(dia: string | null): Promise<EstadoCorte> {
  const corte = dia ? inicioDoDiaBrasilia(validarDia(dia)) : null;
  await definirDataCorte(corte);
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: corte ? `WhatsApp: mensagens anteriores a ${dia} não entram mais no CRM.` : "WhatsApp: data de corte removida.",
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return lerEstadoCorteAction();
}

export async function apagarConversasAnterioresAction(dia: string): Promise<ResultadoLimpezaConversas> {
  const corte = inicioDoDiaBrasilia(validarDia(dia));
  const r = await apagarConversasAnteriores(corte);
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `WhatsApp: ${r.conversas} conversa(s) anteriores a ${dia} apagadas (${r.clientesAfetados} cliente(s) sem conversa, alertas resolvidos).`,
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return r;
}
