"use server";

// Server actions da integração Google (Agenda + Contatos): desconectar e
// importar nomes dos contatos para clientes/conversas sem nome real.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { desconectarGoogle, listarContatosGoogle, lerTokensGoogle } from "@/lib/integrations/google";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { registrarAudit } from "@/lib/audit";

export async function desconectarGoogleAction(): Promise<{ ok: boolean }> {
  await desconectarGoogle();
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: "Google Agenda e Contatos desconectados." }).catch(() => {});
  revalidatePath("/configuracoes");
  return { ok: true };
}

// Nome genérico dado pelo pipeline quando o WhatsApp não manda o nome do contato.
const NOME_GENERICO = /^(contato\s+\d+|\+?\d[\d\s()-]{7,})$/i;

export async function importarContatosGoogleAction(): Promise<{ ok: boolean; erro?: string; total?: number; clientes?: number; conversas?: number }> {
  if (!(await lerTokensGoogle())) return { ok: false, erro: "Conecte a conta Google primeiro." };
  let contatos;
  try {
    contatos = await listarContatosGoogle();
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }

  let clientes = 0;
  let conversas = 0;
  for (const c of contatos) {
    for (const tel of c.telefones) {
      const variantes = phoneLookupVariants(tel);
      if (!variantes.length) continue;

      const semNome = await db.cliente.findMany({
        where: { telefone: { in: variantes } },
        select: { id: true, nome: true },
      });
      for (const cl of semNome) {
        if (!NOME_GENERICO.test(cl.nome.trim())) continue;
        await db.cliente.update({ where: { id: cl.id }, data: { nome: c.nome } });
        clientes++;
      }

      const convs = await db.whatsAppConversation.findMany({
        where: { externalPhone: { in: variantes }, isGroup: false, OR: [{ contactName: null }, { contactName: "" }] },
        select: { id: true },
      });
      for (const cv of convs) {
        await db.whatsAppConversation.update({ where: { id: cv.id }, data: { contactName: c.nome } });
        conversas++;
      }
    }
  }

  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `Importação de contatos do Google: ${contatos.length} contato(s) lido(s), ${clientes} cliente(s) e ${conversas} conversa(s) receberam nome.`,
  }).catch(() => {});
  for (const p of ["/clientes", "/atendimento", "/orientador", "/configuracoes"]) revalidatePath(p);
  return { ok: true, total: contatos.length, clientes, conversas };
}
