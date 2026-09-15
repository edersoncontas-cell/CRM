"use server";

import { revalidatePath } from "next/cache";
import { limparContatosIndesejados, type ResultadoLimpeza } from "@/lib/contatos-bloqueados";
import { registrarAudit } from "@/lib/audit";

export async function limparContatosIndesejadosAction(): Promise<ResultadoLimpeza> {
  const r = await limparContatosIndesejados();
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `Limpeza de contatos que não são clientes: ${r.clientes} cliente(s), ${r.conversas} conversa(s) e ${r.mensagens} mensagem(ns) apagados; ${r.bloqueados} telefone(s) bloqueado(s).`,
  }).catch(() => {});
  for (const p of ["/clientes", "/atendimento", "/orientador", "/dashboard", "/configuracoes", "/financeiro"]) revalidatePath(p);
  return r;
}
