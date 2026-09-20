// Contato marcado como "Não é cliente": o Orientador para de orientar.
//
// Pedido do vendedor: "Para os contatos que eu selecionar que não é cliente, o
// orientador deixará apenas um resumo do contexto de toda conversa."
//
// Faz sentido de sobra. Num contato que não é cliente — o contador, o
// mecânico, o amigo que mandou um vídeo, o fornecedor — coaching de vendas é
// ruído: "próxima ação: ligar hoje até 18h para entender a necessidade de
// máquina" numa conversa com o contador é o painel mentindo. Mas jogar fora o
// histórico também não serve: o vendedor volta nessa conversa meses depois e
// precisa lembrar do que se tratava.
//
// Então sobra exatamente uma coisa: o resumo do que já foi conversado, do
// começo ao fim. Sem estágio de venda, sem temperatura, sem probabilidade de
// fechamento, sem próxima ação, sem ficha de negociação, sem alerta.
//
// De quebra é muito mais barato: uma chamada curta de texto puro no lugar da
// análise de 10 campos em JSON.
//
// Módulo puro de propósito (sem banco, sem rede): dá para testar o contrato
// inteiro sem subir nada.

import type { AnaliseOrientador } from "@/lib/zeus/orientador";
import { coachingVazio } from "@/lib/zeus/orientador-coaching";
import { FATOS_VAZIOS } from "@/lib/orientador-fatos";

// A pergunta "este contato é não-cliente?" mora em lib/cliente-status.ts, sem
// dependência nenhuma, porque o painel (componente de navegador) precisa dela
// tanto quanto este módulo.
export { soResumo, STATUS_NAO_CLIENTE } from "@/lib/cliente-status";

/** Teto do resumo guardado. Duas telas de celular já é bastante. */
export const LIMITE_RESUMO = 1200;

/**
 * Limpa o que o modelo devolveu: cerca de markdown, rótulo colado na frente
 * ("Resumo:"), aspas sobrando e linhas em branco no meio. O texto vai direto
 * para um card — tem de chegar limpo.
 */
export function limparResumo(bruto: string | null | undefined): string {
  let t = (bruto ?? "").trim();
  if (!t) return "";
  // ```md … ``` — acontece mesmo pedindo texto puro.
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  t = t.replace(/^(resumo|resumo da conversa|contexto)\s*[:\-—]\s*/i, "").trim();
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.slice(0, LIMITE_RESUMO).trim();
}

/**
 * O prompt do resumo. Curto e fechado: descrever o que houve, na ordem em que
 * houve, sem virar vendedor.
 *
 * A regra de não recomendar nada é explícita porque um modelo treinado a
 * ajudar tende a terminar com "sugiro retomar o contato" — que é exatamente o
 * que o vendedor pediu para sumir desses contatos.
 */
export function montarPromptResumoContato(args: {
  nomeContato: string;
  historico: string;
}): { system: string; user: string } {
  const system = [
    "Você resume conversas de WhatsApp para um vendedor de máquinas pesadas em uma revenda no Espírito Santo.",
    "",
    "Este contato foi marcado no CRM como NÃO É CLIENTE. Não é uma negociação: pode ser fornecedor, contador, mecânico, amigo, parente, prestador de serviço.",
    "",
    "Sua única tarefa é contar, em português do Brasil, o que já foi conversado com esta pessoa — do começo ao fim, na ordem em que aconteceu.",
    "",
    "REGRAS",
    "1. LEIA TUDO, da primeira mensagem à última. O resumo é da conversa INTEIRA, não só do final.",
    "2. Diga quem é a pessoa e qual é o assunto dela, quando a conversa deixar claro.",
    "3. Registre o que ficou combinado e o que ficou em aberto, se houver.",
    "4. NÃO dê conselho de venda, NÃO sugira próxima ação, NÃO avalie chance de fechar, NÃO cobre retorno. Este contato não é uma venda.",
    "5. NÃO invente nada. O que a conversa não disser, não entra.",
    "6. No máximo 8 linhas. Texto corrido ou tópicos curtos, sem título e sem markdown.",
  ].join("\n");

  const user = [
    `Contato: ${args.nomeContato || "sem nome"}`,
    "",
    "CONVERSA COMPLETA (mais antiga primeiro):",
    args.historico || "(sem mensagens)",
    "",
    "Escreva agora só o resumo.",
  ].join("\n");

  return { system, user };
}

/**
 * A análise que fica gravada para um contato "não é cliente": o resumo e mais
 * nada.
 *
 * Os outros campos existem porque são colunas obrigatórias da tabela, e vão
 * com valor neutro de propósito — o painel, ao ver o status, nem chega a
 * mostrá-los. Zerar aqui importa por um motivo concreto: um contato pode ter
 * sido analisado como negociação ANTES de ser marcado como não-cliente, e a
 * leitura antiga (estágio "Proposta", 70% de chance, próxima ação de
 * cobrança) continuaria no banco, pronta para reaparecer em qualquer relatório
 * ou lista que leia OrientadorAnalise sem olhar o status.
 */
export function analiseSoResumo(resumo: string): AnaliseOrientador {
  return {
    resumoNegociacao: limparResumo(resumo),
    estagioVenda: "Lead",
    perfilComprador: null,
    objecoes: [],
    probabilidadeFechamento: 0,
    probabilidadeExplicacao: "Contato marcado como não é cliente.",
    temperatura: "fria",
    proximaAcao: "",
    oportunidadesPerdidas: [],
    combinados: [],
    pendencias: [],
    coaching: coachingVazio(),
    alertas: [],
    conversaEncerrada: false,
    fatos: { ...FATOS_VAZIOS },
    pedidos: [],
  };
}
