// A GUARDA DO ENVIO — a parte que fala com o banco.
//
// A regra pura mora em lib/envio-limites.ts (testada). Aqui ficam as três
// perguntas que só o banco responde:
//
//   · quantas mensagens já saíram hoje?
//   · quem pediu para sair da lista?
//   · quem nunca falou com a gente?
//
// A terceira é a mais importante. O que derruba número não é volume: é
// DENÚNCIA. Quem recebe promoção de um número desconhecido denuncia; quem já
// conversa com você, não. Foi o disparo para contato frio que restringiu o
// WhatsApp do vendedor por 24h.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { LIMITES_PADRAO, diaBrasilia, type LimitesEnvio } from "@/lib/envio-limites";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";

const CHAVE = "envio.limites.v1";

/** Limites gravados no banco, com o padrão conservador como reserva. */
export async function lerLimitesEnvio(): Promise<LimitesEnvio> {
  try {
    const bruto = await getConfig(CHAVE);
    if (!bruto) return LIMITES_PADRAO;
    const p = JSON.parse(bruto) as Partial<LimitesEnvio>;
    // Campo a campo, com o padrão preenchendo o que faltar: um JSON antigo ou
    // pela metade não pode desligar uma trava sem ninguém perceber.
    return {
      tetoDiario: Number.isFinite(p.tetoDiario) ? Math.max(0, Number(p.tetoDiario)) : LIMITES_PADRAO.tetoDiario,
      horaInicio: Number.isFinite(p.horaInicio) ? Number(p.horaInicio) : LIMITES_PADRAO.horaInicio,
      horaFim: Number.isFinite(p.horaFim) ? Number(p.horaFim) : LIMITES_PADRAO.horaFim,
      somenteDiasUteis: typeof p.somenteDiasUteis === "boolean" ? p.somenteDiasUteis : LIMITES_PADRAO.somenteDiasUteis,
      pausaMinMs: Number.isFinite(p.pausaMinMs) ? Number(p.pausaMinMs) : LIMITES_PADRAO.pausaMinMs,
      pausaMaxMs: Number.isFinite(p.pausaMaxMs) ? Number(p.pausaMaxMs) : LIMITES_PADRAO.pausaMaxMs,
    };
  } catch {
    return LIMITES_PADRAO;
  }
}

export async function gravarLimitesEnvio(l: LimitesEnvio): Promise<void> {
  await setConfig(CHAVE, JSON.stringify(l));
}

/**
 * Quantas mensagens o CRM já mandou hoje, somando TUDO: campanha, resposta
 * automática e mensagem que o vendedor escreveu na tela.
 *
 * Somar tudo é o ponto. O WhatsApp conta o número, não o motivo — separar o
 * teto por tipo de envio seria enganar a si mesmo.
 */
export async function enviadasHoje(agora: Date = new Date()): Promise<number> {
  const inicio = new Date(`${diaBrasilia(agora)}T00:00:00-03:00`);
  return db.whatsAppMessage.count({
    where: { direction: "OUT", origin: "CRM", sentAt: { gte: inicio } },
  }).catch(() => 0);
}

export type Elegibilidade = {
  /** Pode receber campanha. */
  liberados: string[];
  /** Pediu para sair da lista. */
  pediramSaida: string[];
  /** Nunca mandou mensagem — é aqui que mora a denúncia. */
  frios: string[];
  /** Sem telefone cadastrado. */
  semTelefone: string[];
};

const MESES_CONVERSA = 12;

/**
 * Separa quem pode receber campanha de quem não pode, e diz POR QUÊ.
 *
 * Devolver os motivos, e não só a lista limpa, é de propósito: a tela precisa
 * conseguir dizer ao vendedor "900 dos 1.298 nunca falaram com você". Sem essa
 * frase, ele acha que o CRM engoliu os contatos e manda na mão.
 */
export async function separarElegiveis(
  clienteIds: string[],
  agora: Date = new Date()
): Promise<Elegibilidade> {
  const saida: Elegibilidade = { liberados: [], pediramSaida: [], frios: [], semTelefone: [] };
  if (!clienteIds.length) return saida;

  const clientes = await db.cliente.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, telefone: true, naoPerturbe: true },
  });

  const corte = new Date(agora);
  corte.setMonth(corte.getMonth() - MESES_CONVERSA);

  // Quem JÁ MANDOU mensagem para a gente. Duas portas, porque nem toda
  // conversa está amarrada ao cadastro: pelo clienteId e pelo telefone.
  const variantes = new Map<string, string[]>();
  for (const c of clientes) if (c.telefone) variantes.set(c.id, phoneLookupVariants(c.telefone));
  const todosTelefones = [...variantes.values()].flat();

  const conversas = await db.whatsAppConversation.findMany({
    where: {
      isGroup: false,
      OR: [
        { clienteId: { in: clientes.map((c) => c.id) } },
        ...(todosTelefones.length ? [{ externalPhone: { in: todosTelefones } }] : []),
      ],
    },
    select: { id: true, clienteId: true, externalPhone: true },
  }).catch(() => []);

  const comEntrada = new Set(
    (await db.whatsAppMessage.findMany({
      where: {
        direction: "IN",
        sentAt: { gte: corte },
        conversationId: { in: conversas.map((c) => c.id) },
      },
      select: { conversationId: true },
      distinct: ["conversationId"],
    }).catch(() => [])).map((m) => m.conversationId)
  );

  const conversouPorCliente = new Set<string>();
  const porTelefone = new Map<string, string>();
  for (const [id, vars] of variantes) for (const v of vars) porTelefone.set(v, id);
  for (const conv of conversas) {
    if (!comEntrada.has(conv.id)) continue;
    const dono = conv.clienteId ?? porTelefone.get(conv.externalPhone) ?? null;
    if (dono) conversouPorCliente.add(dono);
  }

  for (const c of clientes) {
    if (!c.telefone) { saida.semTelefone.push(c.id); continue; }
    if (c.naoPerturbe) { saida.pediramSaida.push(c.id); continue; }
    if (!conversouPorCliente.has(c.id)) { saida.frios.push(c.id); continue; }
    saida.liberados.push(c.id);
  }
  return saida;
}

/** Marca o cliente como fora da lista de campanha. Conversa individual continua. */
export async function marcarNaoPerturbe(clienteId: string, motivo: string): Promise<void> {
  await db.cliente.update({
    where: { id: clienteId },
    data: { naoPerturbe: true, naoPerturbeEm: new Date(), naoPerturbeMotivo: motivo },
  }).catch((e) => console.error("[envio-guarda] naoPerturbe:", e));
}
