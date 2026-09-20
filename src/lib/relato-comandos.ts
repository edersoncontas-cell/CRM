import { semAcento } from "@/lib/utils";

// O CAMPO DO RELATO TAMBÉM É UM COMANDO.
//
//   "Através do campo de preenchimento da visita, o sistema pode gerar ou
//    atualizar alguma negociação em andamento. (…) Que seja criar uma
//    negociação, que seja para mudar uma negociação de uma coluna para outra
//    nas negociações, seja para remarcar visitas, seja para agendar outra
//    visita, e etc."
//
// Quase tudo disso a leitura por IA do relato já fazia: criar e atualizar a
// negociação, agendar a próxima visita quando uma data é dita. O que faltava
// era mover a negociação de COLUNA — e essa é justamente a que não pode ser
// adivinhada.
//
// Por que aqui é regra escrita e não IA: mover card de coluna é ação com
// consequência visível no funil, e o vendedor tem de poder confiar que
// acontece quando ele mandou e NÃO acontece quando ele só narrou. A IA lendo
// "fiz a visita, foi boa" poderia concluir "então mova para Visita realizada";
// numa terça de sete visitas, isso vira o funil embaralhado sem ninguém saber
// por quê.
//
// A regra exige as três coisas, na ordem: um VERBO de mover, a preposição
// (para/pra) e o NOME DA COLUNA como ela se chama no funil. "Passa pra
// proposta enviada" move. "Fiz a visita realizada ontem" não move nada.

const VERBOS_MOVER = [
  "mover", "move", "mova", "mudar", "muda", "mude", "passar", "passa", "passe",
  "jogar", "joga", "jogue", "mandar", "manda", "mande", "colocar", "coloca",
  "coloque", "levar", "leva", "leve", "arrastar", "arrasta", "arraste",
  "avancar", "avanca", "avance", "puxar", "puxa", "transferir", "transfere",
];

const PREPOSICOES = ["para", "pra", "pro", "p/"];

/** As palavras de um texto, sem acento e sem pontuação. */
function palavras(s: string): string[] {
  return semAcento(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** A sequência `alvo` aparece em `partes` a partir de `desde`? Devolve a posição, ou -1. */
function acharSequencia(partes: string[], alvo: string[], desde = 0): number {
  if (!alvo.length) return -1;
  for (let i = desde; i + alvo.length <= partes.length; i++) {
    let bate = true;
    for (let j = 0; j < alvo.length; j++) {
      if (partes[i + j] !== alvo[j]) { bate = false; break; }
    }
    if (bate) return i;
  }
  return -1;
}

/**
 * Para qual coluna do funil o vendedor mandou mover? null quando ele não mandou.
 *
 * `colunas` são os títulos REAIS do funil deste CRM — eles podem ser
 * renomeados, então a lista vem do banco e nunca fica escrita aqui.
 *
 * Havendo mais de uma coluna citada, vence a de título mais longo: entre
 * "Visita" e "Visitas pendentes", quem escreveu "passa pra visitas pendentes"
 * quis a segunda.
 */
export function colunaDestinoDoRelato(relato: string, colunas: string[]): string | null {
  const partes = palavras(relato);
  if (partes.length < 3) return null;

  // Onde começa a ordem: depois de um verbo de mover seguido de preposição.
  let inicio = -1;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!VERBOS_MOVER.includes(partes[i])) continue;
    // A preposição vem logo depois, ou depois do que está sendo movido
    // ("passa o João pra proposta"): procura nas próximas palavras.
    for (let j = i + 1; j < Math.min(i + 6, partes.length); j++) {
      if (PREPOSICOES.includes(partes[j])) { inicio = j + 1; break; }
    }
    if (inicio >= 0) break;
  }
  if (inicio < 0) return null;

  let escolhida: string | null = null;
  let maior = 0;
  for (const titulo of colunas) {
    const alvo = palavras(titulo);
    if (!alvo.length) continue;
    if (acharSequencia(partes, alvo, inicio) < 0) continue;
    if (alvo.length > maior) { maior = alvo.length; escolhida = titulo; }
  }
  return escolhida;
}

/**
 * O relato pede para mover alguma coisa?
 *
 * Serve para a tela avisar quando ele mandou mover para uma coluna que não
 * existe — calar a boca aí seria pior: ele acharia que moveu.
 */
export function pareceOrdemDeMover(relato: string): boolean {
  const partes = palavras(relato);
  for (let i = 0; i < partes.length - 1; i++) {
    if (!VERBOS_MOVER.includes(partes[i])) continue;
    for (let j = i + 1; j < Math.min(i + 6, partes.length); j++) {
      if (PREPOSICOES.includes(partes[j])) return true;
    }
  }
  return false;
}
