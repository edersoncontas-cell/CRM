// As chaves de IA guardadas NO PRÓPRIO CRM, não só na Vercel.
//
// Pedido do vendedor: "o que você consegue fazer para otimizar para que eu
// consiga usar despreocupado a ferramenta" — e, junto, a pergunta sobre me dar
// acesso à conta da Vercel dele.
//
// A resposta melhor para as duas é esta: tirar a Vercel do caminho. Trocar de
// provedor de IA deixa de exigir painel de hospedagem, variável de ambiente e
// novo deploy, e passa a ser colar a chave numa tela do CRM, do celular, em
// trinta segundos. Ninguém precisa de acesso à conta de ninguém.
//
// COMO CONVIVE COM AS VARIÁVEIS DE AMBIENTE
// A variável de ambiente GANHA da chave gravada aqui, sempre. Quem colocou uma
// chave na Vercel fez isso de propósito, e uma configuração salva no banco não
// pode sobrescrever silenciosamente a decisão de quem opera a hospedagem. O
// banco só PREENCHE o que está faltando.
//
// SOBRE GUARDAR CHAVE NO BANCO
// É o mesmo nível de confiança da variável de ambiente: quem abre o CRM já tem
// acesso a tudo o que a IA faria. Ainda assim, a tela nunca mostra a chave
// inteira (ver mascarar) e nada aqui vai para log.

import { db } from "@/lib/db";
import { CHAVE_PROVEDOR, ORDEM_PROVEDORES, type ProvedorId } from "@/lib/ai/provedores-status";

/** Prefixo das linhas de Configuracao que guardam chave de IA. */
const PREFIXO = "ia.chave.";

export const chaveConfig = (p: ProvedorId): string => `${PREFIXO}${p}`;

/**
 * Mostra a chave sem mostrar a chave: as quatro primeiras letras e as quatro
 * últimas. Serve para o vendedor conferir que colou a certa sem deixar a
 * chave inteira à vista numa tela que ele pode estar projetando ou printando.
 */
export function mascarar(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (v.length <= 12) return "•".repeat(v.length);
  return `${v.slice(0, 4)}${"•".repeat(8)}${v.slice(-4)}`;
}

/**
 * Uma chave digitada de verdade? Espaço, aspas coladas no copiar-colar e
 * texto de exemplo não valem.
 */
export function chaveParece(valor: string): boolean {
  const v = valor.trim().replace(/^["']|["']$/g, "");
  if (v.length < 15) return false;
  if (/^(sua[-_ ]?chave|cole|exemplo|xxx+|\.\.\.)$/i.test(v)) return false;
  return !/\s/.test(v);
}

/** Tira aspas e espaços do que veio do copiar-colar. */
export function limparChave(valor: string): string {
  return valor.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * SEM CACHE, de propósito.
 *
 * A primeira versão guardava as chaves em memória por 30 segundos. Parecia
 * inofensivo e não era: no Next, o módulo carregado pela SERVER ACTION e o
 * carregado pela PÁGINA não compartilham estado. A action salvava a chave e
 * limpava a SUA cópia do cache; a página continuava com a cópia velha, vazia,
 * e o card dizia "nenhum provedor configurado" por meio minuto — justamente
 * no instante em que o vendedor acabou de colar a chave e está olhando para a
 * tela esperando confirmação.
 *
 * O custo de não cachear é um SELECT numa tabela com meia dúzia de linhas,
 * uma vez por render e uma por chamada de IA. Trocar isso por "a tela mente
 * durante 30 segundos na hora da configuração" seria um péssimo negócio.
 */
export function esquecerCacheDeChaves(): void {
  // Mantida por compatibilidade com quem já chama: não há mais cache a limpar.
}

/** Lê as chaves gravadas no banco. Nunca lança: sem banco, devolve vazio. */
export async function lerChavesGravadas(): Promise<Partial<Record<ProvedorId, string>>> {
  try {
    const linhas = await db.configuracao.findMany({
      where: { chave: { startsWith: PREFIXO } },
      select: { chave: true, valor: true },
    });
    const chaves: Partial<Record<ProvedorId, string>> = {};
    for (const l of linhas) {
      const id = l.chave.slice(PREFIXO.length) as ProvedorId;
      if (ORDEM_PROVEDORES.includes(id) && l.valor.trim()) chaves[id] = l.valor.trim();
    }
    return chaves;
  } catch {
    return {};
  }
}

/**
 * Põe no ambiente as chaves que o vendedor salvou na tela, SEM sobrescrever
 * as que já vieram da hospedagem.
 *
 * É chamada no começo de toda chamada de IA (ver llmTexto), que é o funil
 * único por onde tudo passa. Assim provedoresDisponiveis(), que é síncrona e
 * lê process.env, enxerga as duas origens sem precisar virar assíncrona — o
 * que obrigaria a mexer em dezenas de pontos do CRM.
 */
export async function carregarChavesIA(): Promise<void> {
  const gravadas = await lerChavesGravadas();
  for (const id of ORDEM_PROVEDORES) {
    const nomeVar = CHAVE_PROVEDOR[id];
    if (process.env[nomeVar]) continue; // a hospedagem manda
    const valor = gravadas[id];
    if (valor) process.env[nomeVar] = valor;
  }
}

/** De onde veio a chave de cada provedor — para a tela explicar. */
export type OrigemChave = "hospedagem" | "crm" | null;

export async function origemDasChaves(): Promise<Record<ProvedorId, OrigemChave>> {
  const gravadas = await lerChavesGravadas();
  const saida = {} as Record<ProvedorId, OrigemChave>;
  for (const id of ORDEM_PROVEDORES) {
    // Lê o ambiente ANTES de carregarChavesIA ter misturado as origens? Não
    // dá para saber depois. Por isso a origem é decidida pelo banco: se a
    // chave está gravada no CRM E o ambiente tem o mesmo valor, veio do CRM.
    const doBanco = gravadas[id];
    const noAmbiente = process.env[CHAVE_PROVEDOR[id]];
    if (!noAmbiente && !doBanco) saida[id] = null;
    else if (doBanco && (!noAmbiente || noAmbiente === doBanco)) saida[id] = "crm";
    else saida[id] = "hospedagem";
  }
  return saida;
}
