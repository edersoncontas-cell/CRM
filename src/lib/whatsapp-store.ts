// Camada de dados do WhatsApp novo (Prisma). Usada pelo webhook e pela UI.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildConvMatch, phoneLookupVariants, chavesDeIdentidade, hash32, somenteDigitos } from "@/lib/whatsapp-routing";
import { chaveNome } from "@/lib/google-contatos-util";

const STATUS_RANK: Record<string, number> = { QUEUED: 0, FAILED: 0, SENT: 1, UNCONFIRMED: 1, DELIVERED: 2, READ: 3 };

/**
 * Retorna true se a string parece ser um número de telefone (só dígitos, +, -, espaços, parênteses).
 * Usada para proteger nomes reais de serem sobrescritos por números vindos da Z-API.
 */
function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

/**
 * Decide se o nome novo é melhor que o atual.
 * Regras:
 *  - Novo vazio/null → nunca atualiza
 *  - Novo parece número → nunca atualiza (mesmo se atual também for número)
 *  - Atual null/vazio → sempre atualiza com nome real
 *  - Atual parece número e novo é nome real → atualiza
 *  - Atual já é nome real → preserva (não sobrescreve)
 */
function deveAtualizarNome(atual: string | null, novo: string | null): boolean {
  if (!novo || !novo.trim()) return false;
  if (pareceNumeroTelefone(novo)) return false;           // Novo é número → nunca usa
  if (!atual || !atual.trim()) return true;               // Atual vazio → usa o novo
  if (pareceNumeroTelefone(atual)) return true;           // Atual é número, novo é nome → atualiza
  return false;                                            // Atual já é nome real → preserva
}

async function acharClienteIdCom(tx: ClientePrisma, phone: string): Promise<string | null> {
  const variants = phoneLookupVariants(phone);
  if (!variants.length) return null;
  const c = await tx.cliente.findFirst({ where: { telefone: { in: variants } }, select: { id: true } });
  return c?.id ?? null;
}

export async function acharConversa(phone: string, lid: string | null, isGroup: boolean) {
  const where = buildConvMatch({ phone, lid, isGroup }) as Prisma.WhatsAppConversationWhereInput;
  return db.whatsAppConversation.findFirst({ where, orderBy: { lastMessageAt: "desc" } });
}

// Namespace das travas, para não esbarrar em outro advisory lock do sistema.
const TRAVA_CONVERSA = 0x5747;

type ClientePrisma = Prisma.TransactionClient | typeof db;

export async function acharOuCriarConversa(args: {
  phone: string; lid: string | null; isGroup: boolean;
  contactName?: string | null; groupName?: string | null; photoUrl?: string | null;
}) {
  // Tudo dentro de uma transação com trava por IDENTIDADE DO CONTATO. Sem
  // isto, um álbum de mídias (que chega em vários webhooks simultâneos) fazia
  // os eventos não acharem a conversa ao mesmo tempo e criarem uma cada um —
  // era isso que enchia a lista com o mesmo contato repetido, cada linha com
  // uma mídia. O índice único não resolvia porque as chaves eram diferentes
  // entre si, embora do mesmo contato.
  //
  // A trava some sozinha no fim da transação (xact), inclusive se der erro —
  // não tem como ficar presa.
  return db.$transaction(async (tx) => {
    for (const chave of chavesDeIdentidade(args)) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRAVA_CONVERSA}::int, ${hash32(chave)}::int)`;
    }
    return resolverConversa(tx, args);
  });
}

async function resolverConversa(tx: ClientePrisma, args: {
  phone: string; lid: string | null; isGroup: boolean;
  contactName?: string | null; groupName?: string | null; photoUrl?: string | null;
}) {
  const where = buildConvMatch(args) as Prisma.WhatsAppConversationWhereInput;
  let conv = await tx.whatsAppConversation.findFirst({ where, orderBy: { lastMessageAt: "desc" } });
  if (conv) {
    const patch: Prisma.WhatsAppConversationUpdateInput = {};

    // Atualiza lid se ainda não tem
    if (!args.isGroup && args.lid && !conv.lid) patch.lid = args.lid;

    // Atualiza foto se ainda não tem
    if (args.photoUrl && !conv.contactPhotoUrl) patch.contactPhotoUrl = args.photoUrl;

    // ✅ CORREÇÃO PRINCIPAL: atualiza contactName se:
    //   - Atual é null/vazio (nunca teve nome) → preenche com o nome recebido
    //   - Atual parece número → substitui por nome real
    //   NUNCA sobrescreve nome real com número ou com null
    if (!args.isGroup && deveAtualizarNome(conv.contactName, args.contactName ?? null)) {
      patch.contactName = args.contactName;
    }
    if (args.isGroup && deveAtualizarNome(conv.groupName, args.groupName ?? null)) {
      patch.groupName = args.groupName;
    }

    // Conversa que nasceu só com o @lid guarda no externalPhone os DÍGITOS DO
    // LID, que não são um telefone — não dá para responder por ali. Quando o
    // provedor enfim manda o número real (senderPn), promove. Se o número real
    // já estiver em outra conversa, deixa quieto: a unificação junta as duas.
    if (!args.isGroup && conv.lid && conv.externalPhone === somenteDigitos(conv.lid)
        && args.phone && args.phone !== conv.externalPhone) {
      patch.externalPhone = args.phone;
    }

    if (Object.keys(patch).length) {
      try {
        conv = await tx.whatsAppConversation.update({ where: { id: conv.id }, data: patch });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && patch.externalPhone) {
          delete patch.externalPhone;
          if (Object.keys(patch).length) {
            conv = await tx.whatsAppConversation.update({ where: { id: conv.id }, data: patch });
          }
        } else throw e;
      }
    }
    return { conv, criada: false };
  }

  // Conversa nova: cria com os dados disponíveis
  const clienteId = !args.isGroup ? await acharClienteIdCom(tx, args.phone) : null;
  try {
    conv = await tx.whatsAppConversation.create({
      data: {
        externalPhone: args.phone,
        lid: args.isGroup ? null : args.lid,
        isGroup: args.isGroup,
        contactName: args.contactName && !pareceNumeroTelefone(args.contactName) ? args.contactName : null,
        groupName: args.groupName ?? null,
        contactPhotoUrl: args.photoUrl ?? null,
        clienteId,
        lastMessageAt: new Date(),
      },
    });
    return { conv, criada: true };
  } catch (e) {
    // Rede de segurança: a trava acima já serializa a criação, mas se por
    // algum motivo dois create do MESMO texto ainda se cruzarem, o
    // @@unique([externalPhone]) rejeita o segundo — e aqui a gente pega a
    // conversa que o outro acabou de criar em vez de estourar o webhook.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existente = await tx.whatsAppConversation.findFirst({
        where: buildConvMatch(args) as Prisma.WhatsAppConversationWhereInput,
        orderBy: { lastMessageAt: "desc" },
      });
      if (existente) return { conv: existente, criada: false };
    }
    throw e;
  }
}

// Para importação de arquivo (export do WhatsApp): casa pelo NOME, pois o
// arquivo não traz telefone. Se não existir, cria uma conversa "só histórico"
// com um telefone sintético (envio fica desabilitado até casar com o número real).
export function telefoneSinteticoImportacao(name: string): string {
  return "imp:" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

export async function acharOuCriarConversaPorNome(name: string, isGroup: boolean) {
  const existente = await db.whatsAppConversation.findFirst({
    where: isGroup
      ? { isGroup: true, groupName: { equals: name, mode: "insensitive" } }
      : { isGroup: false, contactName: { equals: name, mode: "insensitive" } },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existente) return existente;

  // Cliente com o MESMO NOME (sem acento/caixa/pontuação). O arquivo exportado
  // não traz telefone, e antes o código procurava o cliente passando o nome
  // para uma busca por telefone — nunca achava ninguém, e toda conversa
  // importada nascia sem cadastro e com telefone falso: era por isso que o
  // WhatsApp do CRM não reconhecia o contato e não deixava responder.
  const cliente = !isGroup ? await acharClientePorNome(name) : null;

  // Cliente encontrado e com telefone: a conversa dele é a de verdade. Usa a
  // que já existe (o histórico entra na conversa certa) ou cria uma com o
  // telefone REAL, para dar para responder por ali.
  if (cliente?.telefone) {
    const existentePorTelefone = await acharConversa(cliente.telefone, null, false);
    if (existentePorTelefone) {
      if (!existentePorTelefone.clienteId) {
        await db.whatsAppConversation.update({ where: { id: existentePorTelefone.id }, data: { clienteId: cliente.id } });
      }
      return existentePorTelefone;
    }
    return db.whatsAppConversation.create({
      data: {
        externalPhone: cliente.telefone.replace(/\D/g, "") || cliente.telefone,
        isGroup: false,
        contactName: name,
        clienteId: cliente.id,
        lastMessageAt: new Date(0),
      },
    });
  }

  const sintetico = telefoneSinteticoImportacao(name);
  return db.whatsAppConversation.create({
    data: {
      externalPhone: sintetico,
      isGroup,
      contactName: isGroup ? null : name,
      groupName: isGroup ? name : null,
      clienteId: cliente?.id ?? null,
      lastMessageAt: new Date(0),
    },
  });
}

async function acharClientePorNome(nome: string): Promise<{ id: string; telefone: string | null } | null> {
  const chave = chaveNome(nome);
  if (!chave) return null;
  const exato = await db.cliente.findFirst({
    where: { nome: { equals: nome.trim(), mode: "insensitive" } },
    select: { id: true, telefone: true },
  });
  if (exato) return exato;
  // Sem acerto exato, compara normalizado (acento/pontuação não contam).
  const candidatos = await db.cliente.findMany({ select: { id: true, nome: true, telefone: true } });
  const iguais = candidatos.filter((c) => chaveNome(c.nome) === chave);
  // Dois clientes com o mesmo nome: não dá para escolher sozinho — deixa sem
  // vínculo em vez de pendurar o histórico no cliente errado.
  if (iguais.length !== 1) return null;
  return { id: iguais[0].id, telefone: iguais[0].telefone };
}

// Insere mensagens importadas, sem duplicar (chave = direção|timestamp|primeiros
// 60 chars). Ainda pode descartar duas mensagens LEGÍTIMAS iguais no mesmo
// instante e mesma direção (raro) — aceitável para importação de histórico.
export async function importarMensagens(
  conversationId: string,
  msgs: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>,
  isGroup: boolean,
): Promise<number> {
  if (!msgs.length) return 0;
  const existentes = await db.whatsAppMessage.findMany({ where: { conversationId }, select: { sentAt: true, body: true, direction: true } });
  const chaves = new Set(existentes.map((e) => `${e.direction}|${e.sentAt.getTime()}|${e.body.slice(0, 60)}`));

  const novas = msgs.filter((m) => {
    const corpo = isGroup && m.sender && !m.fromMe ? `${m.sender}: ${m.body}` : m.body;
    const direction = m.fromMe ? "OUT" : "IN";
    return !chaves.has(`${direction}|${new Date(m.sentAt).getTime()}|${corpo.slice(0, 60)}`);
  });
  if (!novas.length) return 0;

  await db.whatsAppMessage.createMany({
    data: novas.map((m) => ({
      conversationId,
      direction: m.fromMe ? "OUT" : "IN",
      body: isGroup && m.sender && !m.fromMe ? `${m.sender}: ${m.body}` : m.body,
      senderName: isGroup ? m.sender : null,
      sentAt: new Date(m.sentAt),
      origin: m.fromMe ? "EXTERNAL" : null,
    })),
  });

  const ultima = new Date(msgs.reduce((a, b) => (new Date(b.sentAt) > new Date(a.sentAt) ? b : a)).sentAt);
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { lastMessageAt: true } });
  if (conv && ultima > conv.lastMessageAt) {
    await db.whatsAppConversation.update({ where: { id: conversationId }, data: { lastMessageAt: ultima } });
  }
  return novas.length;
}

export async function definirFotoSeVazia(conversationId: string, photoUrl: string | null) {
  if (!photoUrl) return;
  await db.whatsAppConversation.updateMany({
    where: { id: conversationId, contactPhotoUrl: null },
    data: { contactPhotoUrl: photoUrl },
  });
}

export type NovaMensagem = {
  direction: "IN" | "OUT";
  body: string;
  sentAt?: Date;
  senderName?: string | null;
  operatorDisplayName?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  transcript?: string | null;
  zapiMessageId?: string | null;
  origin?: string | null;
  sendStatus?: string | null;
  isDraft?: boolean;
  draftStatus?: string | null;
};

export async function inserirMensagem(conversationId: string, m: NovaMensagem) {
  const msg = await db.whatsAppMessage.create({
    data: {
      conversationId,
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt ?? new Date(),
      senderName: m.senderName ?? null,
      operatorDisplayName: m.operatorDisplayName ?? null,
      mediaUrl: m.mediaUrl ?? null,
      mediaType: m.mediaType ?? null,
      mediaName: m.mediaName ?? null,
      transcript: m.transcript ?? null,
      zapiMessageId: m.zapiMessageId ?? null,
      origin: m.origin ?? null,
      sendStatus: m.sendStatus ?? null,
      isDraft: m.isDraft ?? false,
      draftStatus: m.draftStatus ?? null,
    },
  });
  // Mensagem nova (enviada ou recebida) reabre a conversa: "marcar como
  // respondido" pausa relatórios/pendências só até a próxima mensagem.
  await db.whatsAppConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: msg.sentAt, ...(m.isDraft ? {} : { encerrada: false }) },
  });
  return msg;
}

export async function existeZapiId(zapiMessageId?: string | null): Promise<boolean> {
  if (!zapiMessageId) return false;
  return !!(await db.whatsAppMessage.findFirst({ where: { zapiMessageId }, select: { id: true } }));
}

export async function acharEcoRecente(conversationId: string, body: string) {
  const desde = new Date(Date.now() - 5 * 60 * 1000);
  const cands = await db.whatsAppMessage.findMany({
    where: { conversationId, direction: "OUT", sentAt: { gte: desde } },
    orderBy: { sentAt: "desc" }, take: 12,
  });
  const norm = (s: string) => s.replace(/^\*[^*]+:\*\n/, "").trim();
  const alvo = norm(body);
  return cands.find((m) => norm(m.body) === alvo) ?? null;
}

export async function atualizarStatusEntrega(ids: string[], novo: string) {
  if (!ids.length) return;
  const rank = STATUS_RANK[novo] ?? 0;
  const msgs = await db.whatsAppMessage.findMany({ where: { zapiMessageId: { in: ids } } });
  for (const m of msgs) {
    const atual = STATUS_RANK[m.sendStatus ?? ""] ?? -1;
    if (rank > atual) await db.whatsAppMessage.update({ where: { id: m.id }, data: { sendStatus: novo } });
  }
}

export async function curarZapiId(msgId: string, zapiMessageId: string) {
  await db.whatsAppMessage.update({ where: { id: msgId }, data: { zapiMessageId } });
}
