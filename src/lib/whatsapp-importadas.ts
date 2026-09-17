// Conserto das conversas que vieram de arquivo exportado antes da correção do
// vínculo: elas nasceram com um telefone falso ("imp:nome") e sem cadastro, e
// por isso o CRM não reconhecia o contato nem deixava responder.
//
// Para cada uma, procura o cliente de mesmo nome:
//   • cliente com telefone e conversa real → move as mensagens para lá e
//     apaga a conversa órfã (é uma fusão, nada se perde);
//   • cliente com telefone e sem conversa → a própria conversa importada passa
//     a usar o telefone real e fica vinculada;
//   • cliente sem telefone → só vincula o cadastro;
//   • sem cliente de mesmo nome → fica como está (o vendedor decide).

import { db } from "@/lib/db";
import { chaveNome } from "@/lib/google-contatos-util";
import { acharConversa } from "@/lib/whatsapp-store";

export type ResumoImportadas = { total: number; comCliente: number; semCliente: number };
export type ResultadoReparo = { mescladas: number; vinculadas: number; semCadastro: number; mensagensMovidas: number };

const PREFIXO = "imp:";

async function clientePorNome(nome: string | null): Promise<{ id: string; telefone: string | null } | null> {
  const chave = nome ? chaveNome(nome) : null;
  if (!chave) return null;
  const candidatos = await db.cliente.findMany({ select: { id: true, nome: true, telefone: true } });
  const iguais = candidatos.filter((c) => chaveNome(c.nome) === chave);
  return iguais.length === 1 ? { id: iguais[0].id, telefone: iguais[0].telefone } : null;
}

export async function resumoImportadas(): Promise<ResumoImportadas> {
  const conversas = await db.whatsAppConversation.findMany({
    where: { externalPhone: { startsWith: PREFIXO } },
    select: { id: true, contactName: true },
  });
  let comCliente = 0;
  for (const c of conversas) if (await clientePorNome(c.contactName)) comCliente++;
  return { total: conversas.length, comCliente, semCliente: conversas.length - comCliente };
}

export async function repararImportadas(): Promise<ResultadoReparo> {
  const r: ResultadoReparo = { mescladas: 0, vinculadas: 0, semCadastro: 0, mensagensMovidas: 0 };
  const conversas = await db.whatsAppConversation.findMany({
    where: { externalPhone: { startsWith: PREFIXO } },
    select: { id: true, contactName: true },
  });

  for (const conv of conversas) {
    const cliente = await clientePorNome(conv.contactName);
    if (!cliente) { r.semCadastro++; continue; }

    if (!cliente.telefone) {
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { clienteId: cliente.id } });
      r.vinculadas++;
      continue;
    }

    const real = await acharConversa(cliente.telefone, null, false);
    if (real && real.id !== conv.id) {
      await mesclar(conv.id, real.id, cliente.id, r);
      continue;
    }

    await db.whatsAppConversation.update({
      where: { id: conv.id },
      data: { externalPhone: cliente.telefone.replace(/\D/g, "") || cliente.telefone, clienteId: cliente.id },
    });
    r.vinculadas++;
  }
  return r;
}

async function mesclar(origemId: string, destinoId: string, clienteId: string, r: ResultadoReparo) {
  // Não duplica o que já está na conversa de destino: a chave é a mesma da
  // importação (direção + instante + começo do texto).
  const chave = (m: { direction: string; sentAt: Date; body: string }) => `${m.direction}|${m.sentAt.getTime()}|${m.body.slice(0, 60)}`;
  const [origem, destino] = await Promise.all([
    db.whatsAppMessage.findMany({ where: { conversationId: origemId }, select: { id: true, direction: true, sentAt: true, body: true } }),
    db.whatsAppMessage.findMany({ where: { conversationId: destinoId }, select: { direction: true, sentAt: true, body: true } }),
  ]);
  const existentes = new Set(destino.map(chave));
  const mover = origem.filter((m) => !existentes.has(chave(m))).map((m) => m.id);
  if (mover.length) {
    await db.whatsAppMessage.updateMany({ where: { id: { in: mover } }, data: { conversationId: destinoId } });
    r.mensagensMovidas += mover.length;
  }

  const d = await db.whatsAppConversation.findUnique({ where: { id: destinoId }, select: { clienteId: true, lastMessageAt: true } });
  const maisNova = origem.reduce<Date | null>((a, m) => (!a || m.sentAt > a ? m.sentAt : a), null);
  await db.whatsAppConversation.update({
    where: { id: destinoId },
    data: {
      ...(d?.clienteId ? {} : { clienteId }),
      ...(maisNova && d && maisNova > d.lastMessageAt ? { lastMessageAt: maisNova } : {}),
    },
  });
  await db.whatsAppConversation.delete({ where: { id: origemId } });
  r.mescladas++;
}
