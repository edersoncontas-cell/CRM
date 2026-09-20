"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { excluirClienteDefinitivo } from "@/lib/contatos-bloqueados";
import { registrarAudit } from "@/lib/audit";
import { STATUS_NAO_CLIENTE } from "@/lib/cliente-status";
import { STATUS_VALIDOS, ROTULO_STATUS, MAX_POR_LOTE, type StatusCliente } from "@/lib/clientes-lote";

// AÇÕES EM LOTE NA LISTA DE CLIENTES.
//
//   "Coloque na sessão clientes a opção de selecionar eles, após selecionar
//    que apareça a opção de excluir contato do crm ou de marcar como sendo
//    cliente, potencial ou não cliente"
//
// Com 1.681 cadastros, arrumar um por um pelo ⋮ é trabalho de dias. Estas
// duas ações fazem o mesmo que o menu de um cadastro só, aplicado à seleção.

const PAGINAS = ["/clientes", "/dashboard", "/atendimento", "/orientador", "/negociacoes", "/configuracoes"];

// Rótulos, status válidos e o teto do lote moram em lib/clientes-lote.ts.

/**
 * Exclui os selecionados — DEFINITIVAMENTE, com lápide.
 *
 * Usa o mesmo caminho do ⋮ de um cadastro só (excluirClienteDefinitivo), para
 * o lote não ter um comportamento diferente do individual: cada um sai com a
 * conversa ligada e fica registrado para não voltar na sincronização do
 * Google.
 */
export async function excluirClientesEmLote(ids: string[]): Promise<{ ok: boolean; excluidos: number; erro?: string }> {
  const unicos = Array.from(new Set(ids)).filter(Boolean);
  if (!unicos.length) return { ok: false, excluidos: 0, erro: "Nenhum contato selecionado." };
  if (unicos.length > MAX_POR_LOTE) return { ok: false, excluidos: 0, erro: `Selecione no máximo ${MAX_POR_LOTE} por vez.` };

  const nomes: string[] = [];
  for (const id of unicos) {
    const r = await excluirClienteDefinitivo(id);
    if (r.ok) nomes.push(r.nome ?? id);
  }
  if (nomes.length) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `${nomes.length} contato(s) excluídos em lote: ${nomes.slice(0, 20).join(", ")}${nomes.length > 20 ? "…" : ""}. Nenhum volta pela sincronização do Google.`,
    }).catch(() => {});
  }
  for (const p of PAGINAS) revalidatePath(p);
  return { ok: true, excluidos: nomes.length };
}

/** Marca os selecionados como cliente, potencial ou "não é cliente". */
export async function definirStatusEmLote(ids: string[], status: StatusCliente): Promise<{ ok: boolean; alterados: number; erro?: string }> {
  const unicos = Array.from(new Set(ids)).filter(Boolean);
  if (!unicos.length) return { ok: false, alterados: 0, erro: "Nenhum contato selecionado." };
  if (!STATUS_VALIDOS.includes(status)) return { ok: false, alterados: 0, erro: "Status inválido." };
  if (unicos.length > MAX_POR_LOTE) return { ok: false, alterados: 0, erro: `Selecione no máximo ${MAX_POR_LOTE} por vez.` };

  const { count } = await db.cliente.updateMany({
    where: { id: { in: unicos } },
    // Marcar como "não é cliente" zera o jaComprou: quem não é cliente não
    // pode continuar contando como quem já comprou em relatório nenhum.
    data: status === STATUS_NAO_CLIENTE ? { status, jaComprou: false } : { status },
  });
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `${count} contato(s) marcados como "${ROTULO_STATUS[status]}" em lote.`,
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return { ok: true, alterados: count };
}
