"use server";

// O que o vendedor sabe do cliente e a conversa do WhatsApp nunca vai contar:
// "quem decide é o filho", "a obra parou por chuva", "ele já comprou duas
// nossas", "não gosta de ligação, só mensagem". Fica para sempre no histórico
// do cliente e entra no contexto do Orientador e do Cérebro.

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { registrarAudit } from "@/lib/audit";
import {
  lerRegrasNegocio, adicionarRegraNegocio, removerRegraNegocio, type RegraNegocio,
} from "@/lib/contexto-negocio";

export type NotaContexto = { id: string; texto: string; origem: string; criadoEm: string };

export async function listarContextoClienteAction(clienteId: string): Promise<NotaContexto[]> {
  const linhas = await db.notaContextoCliente.findMany({
    where: { clienteId },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });
  return linhas.map((n) => ({ id: n.id, texto: n.texto, origem: n.origem, criadoEm: n.criadoEm.toISOString() }));
}

export async function adicionarContextoClienteAction(clienteId: string, texto: string): Promise<{ ok: boolean; nota?: NotaContexto; erro?: string }> {
  const t = texto.trim();
  if (!t) return { ok: false, erro: "Escreva a informação." };
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const n = await db.notaContextoCliente.create({
    data: { clienteId, texto: t.slice(0, 2_000), origem: "vendedor" },
  });
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario", clienteId,
    descricao: `Contexto adicionado a ${cliente.nome}: ${t.slice(0, 120)}`,
  }).catch(() => {});
  revalidatePath("/orientador");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, nota: { id: n.id, texto: n.texto, origem: n.origem, criadoEm: n.criadoEm.toISOString() } };
}

export async function removerContextoClienteAction(id: string): Promise<{ ok: boolean }> {
  const n = await db.notaContextoCliente.findUnique({ where: { id }, select: { clienteId: true } });
  await db.notaContextoCliente.delete({ where: { id } }).catch(() => null);
  if (n) revalidatePath(`/clientes/${n.clienteId}`);
  revalidatePath("/orientador");
  return { ok: true };
}

// ── Regras do negócio (a realidade deste vendedor) ─────────────────────────
export async function listarRegrasNegocioAction(): Promise<RegraNegocio[]> {
  return lerRegrasNegocio();
}

export async function adicionarRegraNegocioAction(texto: string, area: RegraNegocio["area"] = "tudo"): Promise<RegraNegocio[]> {
  const regras = await adicionarRegraNegocio(texto.trim(), area);
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Regra do negócio adicionada: ${texto.slice(0, 120)}` }).catch(() => {});
  revalidatePath("/academia");
  revalidatePath("/configuracoes");
  return regras;
}

export async function removerRegraNegocioAction(id: string): Promise<RegraNegocio[]> {
  const regras = await removerRegraNegocio(id);
  revalidatePath("/academia");
  revalidatePath("/configuracoes");
  return regras;
}
