"use server";

// Server actions da cadência de 7 toques (tela do cliente).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { iniciarCadencia, encerrarCadencia, cadenciaDoCliente, type TipoCadencia, type CadenciaResumo } from "@/lib/cadencias";
import { registrarAudit } from "@/lib/audit";

const TIPOS: TipoCadencia[] = ["construtora", "pedreira", "cafe", "prefeitura", "locadora", "geral"];

export async function iniciarCadenciaAction(clienteId: string, tipo: string): Promise<{ ok: boolean; erro?: string; cadencia?: CadenciaResumo | null }> {
  const t = (TIPOS.includes(tipo as TipoCadencia) ? tipo : "geral") as TipoCadencia;
  const r = await iniciarCadencia(clienteId, t);
  if (!r.ok) return { ok: false, erro: r.erro };
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/alertas");
  return { ok: true, cadencia: await cadenciaDoCliente(clienteId) };
}

export async function encerrarCadenciaAction(id: string): Promise<{ ok: boolean; cadencia?: CadenciaResumo | null }> {
  const c = await db.cadencia.findUnique({ where: { id }, select: { clienteId: true, cliente: { select: { nome: true } } } });
  if (!c) return { ok: false };
  await encerrarCadencia(id, "manual");
  await db.alerta.updateMany({ where: { clienteId: c.clienteId, tipo: "cadencia", resolvido: false }, data: { resolvido: true } }).catch(() => {});
  await registrarAudit({ acao: "cliente_atualizado", origem: "usuario", descricao: `Cadência de 7 toques encerrada manualmente para ${c.cliente.nome}.`, entidade: "Cliente", entidadeId: c.clienteId, clienteId: c.clienteId }).catch(() => {});
  revalidatePath(`/clientes/${c.clienteId}`);
  revalidatePath("/alertas");
  return { ok: true, cadencia: await cadenciaDoCliente(c.clienteId) };
}
