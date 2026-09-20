// Unificação de conversas duplicadas do WhatsApp.
//
// Por que isto existe: até a correção da trava por identidade, um álbum de
// mídias (que chega em vários webhooks ao mesmo tempo) podia criar uma
// conversa por mídia do MESMO contato — a lista aparecia com o nome repetido,
// cada linha com uma foto ou vídeo, e ao abrir uma delas só tinha uma mídia.
// A causa está corrigida, mas as conversas que já nasceram partidas continuam
// no banco: é isto que junta tudo de volta numa conversa só.
//
// Idempotente: sem duplicata, não mexe em nada.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { chavesDeIdentidade, somenteDigitos } from "@/lib/whatsapp-routing";

export type ResultadoUnificacao = {
  gruposUnificados: number;
  conversasRemovidas: number;
  mensagensMovidas: number;
};

type ConvResumo = {
  id: string;
  externalPhone: string;
  lid: string | null;
  isGroup: boolean;
  contactName: string | null;
  groupName: string | null;
  status: string;
  category: string | null;
  categoryConfirmed: boolean;
  aiActive: boolean;
  encerrada: boolean;
  lastMessageAt: Date;
  lastAccessedAt: Date | null;
  contactPhotoUrl: string | null;
  agnesScheduledAt: Date | null;
  clienteId: string | null;
  createdAt: Date;
};

const CAMPOS = {
  id: true, externalPhone: true, lid: true, isGroup: true, contactName: true, groupName: true,
  status: true, category: true, categoryConfirmed: true, aiActive: true, encerrada: true,
  lastMessageAt: true, lastAccessedAt: true, contactPhotoUrl: true, agnesScheduledAt: true,
  clienteId: true, createdAt: true,
} as const;

function pareceNumero(s: string | null): boolean {
  if (!s) return true;
  return /^[\d\s+\-().]{6,}$/.test(s.trim());
}

// externalPhone que na verdade é o @lid — não dá para responder por ele.
function ehApenasLid(c: ConvResumo): boolean {
  return !!c.lid && c.externalPhone === somenteDigitos(c.lid);
}

/** Agrupa as conversas que são do MESMO contato, pelas chaves de identidade. */
export function agruparPorIdentidade(convs: ConvResumo[]): ConvResumo[][] {
  // União por chave: duas conversas ficam no mesmo grupo se dividem qualquer
  // chave — o telefone canônico OU o @lid. É o que junta a conversa que
  // nasceu só com o @lid com a que nasceu com o número real.
  const pai = new Map<string, string>();
  const acha = (x: string): string => {
    let r = x;
    while (pai.get(r) !== r) r = pai.get(r)!;
    let c = x;
    while (pai.get(c) !== c) { const p = pai.get(c)!; pai.set(c, r); c = p; }
    return r;
  };
  const une = (a: string, b: string) => { const ra = acha(a); const rb = acha(b); if (ra !== rb) pai.set(ra, rb); };

  for (const c of convs) pai.set(c.id, c.id);
  const porChave = new Map<string, string>();
  for (const c of convs) {
    for (const chave of chavesDeIdentidade({ phone: c.externalPhone, lid: c.lid, isGroup: c.isGroup })) {
      const dono = porChave.get(chave);
      if (dono) une(c.id, dono);
      else porChave.set(chave, c.id);
    }
  }

  const grupos = new Map<string, ConvResumo[]>();
  for (const c of convs) {
    const r = acha(c.id);
    const g = grupos.get(r);
    if (g) g.push(c); else grupos.set(r, [c]);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/**
 * Escolhe qual conversa SOBREVIVE. Regra: primeiro uma que dê para responder
 * (telefone de verdade, não o @lid); entre elas, a mais antiga — é a que tem o
 * histórico e, normalmente, o cliente já vinculado.
 */
export function escolherSobrevivente(grupo: ConvResumo[]): ConvResumo {
  const ordenado = [...grupo].sort((a, b) => {
    const ta = ehApenasLid(a) ? 1 : 0;
    const tb = ehApenasLid(b) ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return ordenado[0];
}

/** Junta os campos do grupo na conversa que sobrevive, sem perder informação. */
export function fundirCampos(sobrevivente: ConvResumo, grupo: ConvResumo[]): Prisma.WhatsAppConversationUpdateInput {
  const outros = grupo.filter((c) => c.id !== sobrevivente.id);
  const patch: Prisma.WhatsAppConversationUpdateInput = {};

  // Telefone: se o sobrevivente só tem o @lid, pega o número real de alguém.
  if (ehApenasLid(sobrevivente)) {
    const comTelefone = outros.find((c) => !ehApenasLid(c));
    if (comTelefone) patch.externalPhone = comTelefone.externalPhone;
  }
  if (!sobrevivente.lid) {
    const comLid = outros.find((c) => c.lid);
    if (comLid) patch.lid = comLid.lid;
  }
  if (!sobrevivente.clienteId) {
    const comCliente = outros.find((c) => c.clienteId);
    if (comCliente) patch.clienteId = comCliente.clienteId;
  }
  if (pareceNumero(sobrevivente.contactName)) {
    const comNome = outros.find((c) => !pareceNumero(c.contactName));
    if (comNome) patch.contactName = comNome.contactName;
  }
  if (!sobrevivente.groupName) {
    const comGrupo = outros.find((c) => c.groupName);
    if (comGrupo) patch.groupName = comGrupo.groupName;
  }
  if (!sobrevivente.contactPhotoUrl) {
    const comFoto = outros.find((c) => c.contactPhotoUrl);
    if (comFoto) patch.contactPhotoUrl = comFoto.contactPhotoUrl;
  }
  if (!sobrevivente.category) {
    const comCat = outros.find((c) => c.category);
    if (comCat) { patch.category = comCat.category; patch.categoryConfirmed = comCat.categoryConfirmed; }
  }
  if (sobrevivente.status === "UNASSIGNED") {
    const comStatus = outros.find((c) => c.status !== "UNASSIGNED");
    if (comStatus) patch.status = comStatus.status;
  }

  // Data mais recente de mensagem e de acesso mandam.
  const maiorMsg = grupo.reduce((m, c) => (c.lastMessageAt > m ? c.lastMessageAt : m), sobrevivente.lastMessageAt);
  if (maiorMsg > sobrevivente.lastMessageAt) patch.lastMessageAt = maiorMsg;
  const acessos = grupo.map((c) => c.lastAccessedAt).filter((d): d is Date => !!d);
  if (acessos.length) {
    const maiorAcesso = acessos.reduce((m, d) => (d > m ? d : m));
    if (!sobrevivente.lastAccessedAt || maiorAcesso > sobrevivente.lastAccessedAt) patch.lastAccessedAt = maiorAcesso;
  }
  // Nascimento: a conversa unificada começa quando começou a mais antiga.
  const maisAntiga = grupo.reduce((m, c) => (c.createdAt < m ? c.createdAt : m), sobrevivente.createdAt);
  if (maisAntiga < sobrevivente.createdAt) patch.createdAt = maisAntiga;

  // IA ligada em qualquer uma → fica ligada. "Encerrada" só se TODAS estavam:
  // basta uma pendente para a conversa continuar pendente.
  if (!sobrevivente.aiActive && outros.some((c) => c.aiActive)) patch.aiActive = true;
  if (sobrevivente.encerrada && !grupo.every((c) => c.encerrada)) patch.encerrada = false;

  // Agendamento da Agnes: vale o mais cedo que estiver pendente.
  const agendas = grupo.map((c) => c.agnesScheduledAt).filter((d): d is Date => !!d);
  if (agendas.length) {
    const maisCedo = agendas.reduce((m, d) => (d < m ? d : m));
    if (!sobrevivente.agnesScheduledAt || maisCedo < sobrevivente.agnesScheduledAt) patch.agnesScheduledAt = maisCedo;
  }

  // O resumo do relatório foi feito sobre um pedaço só da conversa: invalida,
  // senão o PDF sairia contando metade da história.
  patch.resumoRelatorio = null;
  patch.resumoRelatorioEm = null;

  return patch;
}

export async function unificarConversasDuplicadas(): Promise<ResultadoUnificacao> {
  const convs = (await db.whatsAppConversation.findMany({ select: CAMPOS })) as ConvResumo[];
  const grupos = agruparPorIdentidade(convs);
  const saida: ResultadoUnificacao = { gruposUnificados: 0, conversasRemovidas: 0, mensagensMovidas: 0 };

  for (const grupo of grupos) {
    const sobrevivente = escolherSobrevivente(grupo);
    const perdedores = grupo.filter((c) => c.id !== sobrevivente.id).map((c) => c.id);
    const patch = fundirCampos(sobrevivente, grupo);

    await db.$transaction(async (tx) => {
      const movidas = await tx.whatsAppMessage.updateMany({
        where: { conversationId: { in: perdedores } },
        data: { conversationId: sobrevivente.id },
      });
      // Apaga ANTES de atualizar o telefone: o externalPhone que vai para o
      // sobrevivente pode ser justamente o de um perdedor, e o índice único
      // recusaria os dois existindo ao mesmo tempo.
      await tx.whatsAppConversation.deleteMany({ where: { id: { in: perdedores } } });
      await tx.whatsAppConversation.update({ where: { id: sobrevivente.id }, data: patch });
      saida.mensagensMovidas += movidas.count;
    });

    saida.gruposUnificados += 1;
    saida.conversasRemovidas += perdedores.length;
  }

  return saida;
}
