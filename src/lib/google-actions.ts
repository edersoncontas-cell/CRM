"use server";

// Server actions da integração Google (Agenda + Contatos): desconectar,
// sincronizar a lista de clientes com o Google Contatos e ligar/desligar o
// envio dos clientes do CRM para o Google.

import { revalidatePath } from "next/cache";
import { desconectarGoogle } from "@/lib/integrations/google";
import { sincronizarContatosGoogle, definirEnvioParaGoogle, type ResumoSincronizacao } from "@/lib/google-contatos";
import { registrarAudit } from "@/lib/audit";

export async function desconectarGoogleAction(): Promise<{ ok: boolean }> {
  await desconectarGoogle();
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: "Google Agenda e Contatos desconectados." }).catch(() => {});
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function sincronizarContatosGoogleAction(): Promise<ResumoSincronizacao> {
  const r = await sincronizarContatosGoogle();
  if (r.ok) {
    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `Sincronização com o Google Contatos: ${r.lidos} contato(s) lido(s), ${r.criados} cliente(s) novo(s), ${r.atualizados} atualizado(s), ${r.enviados} enviado(s) ao Google.`,
    }).catch(() => {});
  }
  for (const p of ["/clientes", "/atendimento", "/orientador", "/configuracoes", "/dashboard"]) revalidatePath(p);
  return r;
}

export async function definirEnvioContatosGoogleAction(ativo: boolean): Promise<{ ok: boolean }> {
  await definirEnvioParaGoogle(ativo);
  revalidatePath("/configuracoes");
  revalidatePath("/clientes");
  return { ok: true };
}
