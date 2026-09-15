// Contatos que não são clientes (contabilidade, bancos, financeiras, hotéis,
// restaurantes… — ver TERMOS/PALAVRAS_BLOQUEIO em lib/utils.ts):
//   - limparContatosIndesejados(): apaga do CRM tudo que bater com a regra —
//     cliente (com negociações, visitas, alertas, frota, análises), conversas
//     do WhatsApp (com as mensagens) e a auditoria ligada — e guarda o
//     telefone em ContatoBloqueado para nunca mais entrar. Roda na manutenção,
//     a cada hora (cron do Google Contatos) e pelo botão em Configurações.
//   - telefoneBloqueado()/bloquearContato(): usados na chegada de mensagens.

import { db } from "@/lib/db";
import { listarFiltroContatos } from "@/lib/filtro-contatos";
import { motivoBloqueioComListas } from "@/lib/utils";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";

export type ResultadoLimpeza = { clientes: number; conversas: number; mensagens: number; bloqueados: number };

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");

export async function telefoneBloqueado(telefone: string): Promise<boolean> {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return false;
  const b = await db.contatoBloqueado.findFirst({ where: { telefone: { in: variantes } }, select: { id: true } });
  return !!b;
}

export async function bloquearContato(telefone: string, nome: string | null, motivo: string | null): Promise<void> {
  const t = digitos(telefone);
  if (!t) return;
  await db.contatoBloqueado.upsert({ where: { telefone: t }, update: { nome: nome ?? undefined, motivo: motivo ?? undefined }, create: { telefone: t, nome, motivo } });
}

// Apaga só o que está ligado a UM telefone (usado na chegada de mensagem de
// contato bloqueado — barato, sem varrer o banco inteiro).
export async function apagarContatoPorTelefone(telefone: string): Promise<void> {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return;
  const clientes = await db.cliente.findMany({ where: { telefone: { in: variantes } }, select: { id: true } });
  const ids = clientes.map((c) => c.id);
  const conversas = await db.whatsAppConversation.findMany({ where: { OR: [{ externalPhone: { in: variantes } }, ...(ids.length ? [{ clienteId: { in: ids } }] : [])] }, select: { id: true } });
  if (conversas.length) await db.whatsAppConversation.deleteMany({ where: { id: { in: conversas.map((c) => c.id) } } });
  if (ids.length) {
    await db.auditLog.deleteMany({ where: { clienteId: { in: ids } } });
    await db.tarefaKanban.deleteMany({ where: { clienteId: { in: ids } } });
    await db.alertaOculto.deleteMany({ where: { clienteId: { in: ids } } });
    await db.cliente.deleteMany({ where: { id: { in: ids } } });
  }
}

export async function listarTelefonesBloqueados(): Promise<Set<string>> {
  const rows = await db.contatoBloqueado.findMany({ select: { telefone: true } });
  const set = new Set<string>();
  for (const r of rows) for (const v of phoneLookupVariants(r.telefone)) set.add(v);
  return set;
}

// Apaga do CRM todo cliente/conversa cujo nome bate com a regra de bloqueio
// (ou cujo telefone já está bloqueado). Idempotente; nunca lança.
export async function limparContatosIndesejados(): Promise<ResultadoLimpeza> {
  const r: ResultadoLimpeza = { clientes: 0, conversas: 0, mensagens: 0, bloqueados: 0 };
  try {
    const [clientes, conversas, bloqueadosAntes, listas] = await Promise.all([
      db.cliente.findMany({ select: { id: true, nome: true, telefone: true } }),
      db.whatsAppConversation.findMany({ where: { isGroup: false }, select: { id: true, contactName: true, externalPhone: true, clienteId: true } }),
      listarTelefonesBloqueados(),
      listarFiltroContatos(),
    ]);
    // Listas carregadas UMA vez e aplicadas com a função pura — a varredura
    // percorre todos os clientes/conversas, não dá para consultar por item.
    const motivo = (nome: string) => motivoBloqueioComListas(nome, listas.termos, listas.palavras);

    const telefonesAlvo = new Set<string>(bloqueadosAntes);
    const marcar = async (telefone: string | null, nome: string | null) => {
      const t = digitos(telefone);
      if (!t || telefonesAlvo.has(t)) return;
      for (const v of phoneLookupVariants(t)) telefonesAlvo.add(v);
      await bloquearContato(t, nome, nome ? motivo(nome) : null);
      r.bloqueados++;
    };

    // 1) Clientes com nome bloqueado → telefone vai para a lista.
    const clientesAlvo = clientes.filter((c) => motivo(c.nome) !== null);
    for (const c of clientesAlvo) await marcar(c.telefone, c.nome);
    // 2) Conversas com nome bloqueado → idem.
    const conversasNome = conversas.filter((c) => c.contactName && motivo(c.contactName) !== null);
    for (const c of conversasNome) await marcar(c.externalPhone, c.contactName);

    // 3) Tudo que tem telefone bloqueado também cai (mesmo com nome genérico).
    const idsClientes = new Set(clientesAlvo.map((c) => c.id));
    for (const c of clientes) if (c.telefone && phoneLookupVariants(c.telefone).some((v) => telefonesAlvo.has(v))) idsClientes.add(c.id);
    const idsConversas = new Set(conversasNome.map((c) => c.id));
    for (const c of conversas) {
      if (phoneLookupVariants(c.externalPhone).some((v) => telefonesAlvo.has(v))) idsConversas.add(c.id);
      if (c.clienteId && idsClientes.has(c.clienteId)) idsConversas.add(c.id);
    }

    if (idsConversas.size) {
      const ids = [...idsConversas];
      r.mensagens = (await db.whatsAppMessage.deleteMany({ where: { conversationId: { in: ids } } })).count;
      r.conversas = (await db.whatsAppConversation.deleteMany({ where: { id: { in: ids } } })).count;
    }
    if (idsClientes.size) {
      const ids = [...idsClientes];
      await db.auditLog.deleteMany({ where: { clienteId: { in: ids } } });
      await db.tarefaKanban.deleteMany({ where: { clienteId: { in: ids } } });
      await db.alertaOculto.deleteMany({ where: { clienteId: { in: ids } } });
      // Negociações, visitas, alertas, frota, análises, cadências e pós-venda caem em cascata.
      r.clientes = (await db.cliente.deleteMany({ where: { id: { in: ids } } })).count;
    }
  } catch (e) {
    console.error("[contatos-bloqueados] limpeza:", e);
  }
  return r;
}

export async function resumoBloqueio(): Promise<{ total: number; recentes: { nome: string | null; telefone: string; motivo: string | null; criadoEm: Date }[] }> {
  const [total, recentes] = await Promise.all([
    db.contatoBloqueado.count(),
    db.contatoBloqueado.findMany({ orderBy: { criadoEm: "desc" }, take: 8, select: { nome: true, telefone: true, motivo: true, criadoEm: true } }),
  ]);
  return { total, recentes };
}
