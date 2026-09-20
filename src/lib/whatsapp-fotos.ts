// A FOTO DE PERFIL DO WHATSAPP NA LISTA DE CONVERSAS.
//
//   "Consegue por a foto de perfil igual está no whatsapp? Se sim, atualize
//    isso."
//
// Consegue, e faltava pouco: a coluna (WhatsAppConversation.contactPhotoUrl), o
// avatar que já sabe mostrar a imagem e cair nas iniciais quando ela falha, e
// até a função que pergunta a foto ao provedor (zapi.fotoPerfil) já existiam.
// O que não existia era alguém CHAMANDO — então a coluna ficava nula em quase
// todas as conversas e o CRM mostrava iniciais para tudo.
//
// De onde vem a foto, na ordem do mais barato para o mais caro:
//
//   1. a LISTA DE CONVERSAS do provedor (listarChats), que já traz
//      profilePicUrl de cada chat. É a mesma chamada que o cron já faz para
//      sincronizar os nomes — custo zero a mais.
//   2. uma pergunta POR CONTATO (fotoPerfil), só para quem sobrou sem foto, e
//      poucas por rodada. Perguntar 400 fotos de uma vez é pedir para o
//      provedor começar a recusar.
//
// Por que a foto é REESCRITA quando muda, e não só preenchida quando está
// vazia: a URL do WhatsApp é temporária (pps.whatsapp.net com token). Guardada
// para sempre, ela expira, o navegador não carrega mais a imagem e o avatar cai
// nas iniciais de novo — a foto "desapareceria" sozinha depois de um tempo.
// Reescrever quando o provedor devolve outra URL é o que mantém a foto viva.

import { db } from "@/lib/db";
import { listarChats, fotoPerfil } from "@/lib/zapi";
import { isGroupChatId, phoneLookupVariants } from "@/lib/whatsapp-routing";

export type ResultadoFotos = {
  /** Conversas que ganharam (ou renovaram) a foto. */
  atualizadas: number;
  /** Quantas vieram da lista do provedor, sem chamada extra. */
  daLista: number;
  /** Quantas exigiram uma pergunta por contato. */
  individuais: number;
  /** Conversas que continuam sem foto (contato sem foto ou perfil fechado). */
  semFoto: number;
};

// Teto de perguntas individuais por rodada, e o tempo máximo gasto nelas. O
// cron do vigia roda de 5 em 5 minutos: 20 por rodada cobrem algumas centenas
// de conversas em menos de duas horas, sem atropelar o provedor.
const MAX_INDIVIDUAIS = 20;
const PRAZO_INDIVIDUAIS_MS = 15_000;
const PAUSA_ENTRE_PERGUNTAS_MS = 150;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ChatComFoto = { phone: string; isGroup?: boolean; photo?: string | null };

/**
 * Índice telefone → foto, montado a partir da lista de conversas do provedor.
 *
 * O mesmo contato aparece com número em formatos diferentes (com e sem o 55,
 * com e sem o nono dígito), por isso cada chat entra sob TODAS as variantes do
 * número — é o mesmo casamento que a sincronização de nomes faz. Quando duas
 * entradas caem na mesma variante, vale a primeira: a lista chega ordenada da
 * conversa mais recente para a mais antiga, e é a mais recente que tem a foto
 * boa.
 */
export function mapaDeFotos(chats: ChatComFoto[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const chat of chats) {
    if (!chat.photo) continue;
    const chave = chat.isGroup || isGroupChatId(chat.phone) ? chat.phone : chat.phone.replace(/\D/g, "");
    if (!chave) continue;
    for (const v of phoneLookupVariants(chave)) {
      if (!mapa.has(v)) mapa.set(v, chat.photo);
    }
  }
  return mapa;
}

/** A foto deste número no índice, testando as variantes do telefone. */
export function fotoDoTelefone(mapa: Map<string, string>, telefone: string): string | undefined {
  for (const v of phoneLookupVariants(telefone)) {
    const url = mapa.get(v);
    if (url) return url;
  }
  return undefined;
}

/**
 * Põe nas conversas do CRM a foto de perfil que está no WhatsApp.
 *
 * Idempotente: rodar de novo sem nada ter mudado no WhatsApp não escreve nada.
 * Nunca lança — a foto é enfeite útil, não pode derrubar o cron que cuida da
 * conexão.
 */
export async function sincronizarFotosDosContatos(): Promise<ResultadoFotos> {
  const saida: ResultadoFotos = { atualizadas: 0, daLista: 0, individuais: 0, semFoto: 0 };

  type ConvFoto = { id: string; externalPhone: string; isGroup: boolean; contactPhotoUrl: string | null };
  const conversas: ConvFoto[] = await db.whatsAppConversation.findMany({
    select: { id: true, externalPhone: true, isGroup: true, contactPhotoUrl: true },
    orderBy: { lastMessageAt: "desc" },
    take: 600,
  }).catch((e) => {
    console.error("[whatsapp-fotos] não deu para ler as conversas:", e);
    return [] as ConvFoto[];
  });
  if (!conversas.length) return saida;

  // ── 1. o que a lista do provedor já entrega ───────────────────────────────
  const chats = await listarChats(1, 100_000).catch((e) => {
    console.error("[whatsapp-fotos] não deu para ler a lista do provedor:", e);
    return [];
  });
  const fotoPorVariante = mapaDeFotos(chats);

  const semFoto: ConvFoto[] = [];
  for (const c of conversas) {
    const url = fotoDoTelefone(fotoPorVariante, c.externalPhone);
    if (!url) {
      if (!c.contactPhotoUrl) semFoto.push(c);
      continue;
    }
    if (url === c.contactPhotoUrl) continue; // nada mudou: nem toca no banco
    await gravar(c.id, url);
    saida.atualizadas += 1;
    saida.daLista += 1;
  }

  // ── 2. quem sobrou, uma pergunta por contato (poucas, com pausa) ──────────
  // Grupo fica de fora: a foto do grupo não vem por este endpoint, e o avatar
  // de grupo já tem o desenho próprio.
  const alvos = semFoto.filter((c) => !c.isGroup).slice(0, MAX_INDIVIDUAIS);
  const limite = Date.now() + PRAZO_INDIVIDUAIS_MS;
  for (const c of alvos) {
    if (Date.now() > limite) break;
    const url = await fotoPerfil(c.externalPhone).catch(() => null);
    if (url) {
      await gravar(c.id, url);
      saida.atualizadas += 1;
      saida.individuais += 1;
    } else {
      saida.semFoto += 1;
    }
    await dormir(PAUSA_ENTRE_PERGUNTAS_MS);
  }
  saida.semFoto += Math.max(0, semFoto.length - alvos.length);

  return saida;
}

async function gravar(id: string, url: string): Promise<void> {
  await db.whatsAppConversation.update({ where: { id }, data: { contactPhotoUrl: url } }).catch(() => {});
}
