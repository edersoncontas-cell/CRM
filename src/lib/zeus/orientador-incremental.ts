// Análise INCREMENTAL: atualizar o que já existe em vez de reler tudo.
//
// Ideia do vendedor, e é a arquitetura certa: "se você configurar para que a
// IA atualize o contexto baseado na última conversa mantendo o que já está
// preenchido, ao invés do contexto da conversa toda, conseguimos resolver
// essa questão?"
//
// Sim. A conta:
//
//   HOJE (conversa inteira a cada análise)     INCREMENTAL
//     instruções        640                      instruções        500
//     histórico       3.475                      estado anterior   600
//     saída           1.400                      mensagens novas   300
//     ------------------------                   saída           1.400
//     TOTAL           5.515  (teto: 6.000)       ------------------------
//                                                TOTAL           2.800
//
// Metade do teto, com folga. E há um segundo ganho, menos óbvio e talvez mais
// importante: o estado acumulado PRESERVA O COMEÇO da conversa. A janela
// cortada jogava fora justamente a qualificação — qual obra, qual prazo, quem
// decide — que mora nas primeiras mensagens. No incremental, o que foi
// entendido lá atrás continua no estado para sempre.
//
// O RISCO, DITO COM TODAS AS LETRAS: DERIVA.
// Se a IA escrever algo errado no estado, isso PERSISTE — nada relê a fonte
// para corrigir. As invenções reportadas ("cliente enviou documentos",
// "Wadson da construtora") virariam permanentes em vez de serem refeitas a
// cada análise. Por isso o incremental NÃO é absoluto:
//
//   • "Reanalisar" na mão SEMPRE relê a conversa inteira. É o botão do
//     vendedor para dizer "esqueça o que você achou e olhe de novo".
//   • A cada LIMITE_INCREMENTAIS análises seguidas, uma releitura completa
//     acontece sozinha, para o estado não se afastar da verdade sem limite.
//
// Módulo puro (sem banco, sem rede), com teste.

import type { AnaliseOrientador } from "@/lib/zeus/orientador";
import { CABECALHO_NOTA_VENDEDOR } from "@/lib/zeus/orientador-prompt";

/**
 * Quantas análises incrementais seguidas antes de uma releitura completa.
 *
 * Dez é o equilíbrio: cobre uma semana boa de conversa sem releitura, e ainda
 * assim a deriva nunca passa de dez passos sem correção.
 */
export const LIMITE_INCREMENTAIS = 10;

/** O que fica gravado do estado anterior, para mandar de volta à IA. */
export type EstadoAnterior = {
  resumoNegociacao: string;
  estagioVenda: string;
  temperatura: string;
  probabilidadeFechamento: number;
  proximaAcao: string;
  maquina: string | null;
  valor: number | null;
  pagamento: string | null;
  municipio: string | null;
  entrada: string | null;
  observacao: string | null;
  visitaRealizada: boolean | null;
};

/**
 * Decide se esta análise pode ser incremental.
 *
 * Exige as três coisas: existir estado anterior, existir mensagem nova, e não
 * ter estourado o limite de incrementais seguidas. Sem qualquer uma delas, a
 * releitura completa é o caminho — e é o caminho seguro.
 */
export function podeSerIncremental(args: {
  temEstadoAnterior: boolean;
  mensagensNovas: number;
  incrementaisSeguidas: number;
  /** "Reanalisar" apertado na mão: o vendedor quer uma leitura nova. */
  forcarCompleta: boolean;
}): boolean {
  if (args.forcarCompleta) return false;
  if (!args.temEstadoAnterior) return false;
  if (args.mensagensNovas <= 0) return false;
  return args.incrementaisSeguidas < LIMITE_INCREMENTAIS;
}

/** Monta o estado que vai no prompt, a partir da análise já gravada. */
export function estadoDaAnalise(a: {
  resumoNegociacao: string | null;
  estagioVenda: string;
  temperatura: string;
  probabilidadeFechamento: number | null;
  proximaAcao: string | null;
}, negociacao: {
  marca: string | null; maquinaModelo: string | null; valor: number | null;
  tipoPagamento: string | null; entradaValor: number | null;
  entradaPercentual: number | null; observacao: string | null;
} | null, municipio: string | null, visitaRealizada: boolean | null): EstadoAnterior {
  const maquina = [negociacao?.marca, negociacao?.maquinaModelo].filter(Boolean).join(" ") || null;
  const entrada = negociacao?.entradaPercentual
    ? `${negociacao.entradaPercentual}%`
    : negociacao?.entradaValor
      ? `R$ ${negociacao.entradaValor.toLocaleString("pt-BR")}`
      : null;
  return {
    resumoNegociacao: a.resumoNegociacao ?? "",
    estagioVenda: a.estagioVenda,
    temperatura: a.temperatura,
    probabilidadeFechamento: a.probabilidadeFechamento ?? 50,
    proximaAcao: a.proximaAcao ?? "",
    maquina,
    valor: negociacao?.valor ?? null,
    pagamento: negociacao?.tipoPagamento ?? null,
    municipio,
    entrada,
    observacao: negociacao?.observacao ?? null,
    visitaRealizada,
  };
}

/**
 * O prompt do incremental.
 *
 * A regra central — e é a que o vendedor pediu — está em maiúsculas de
 * propósito: MANTENHA o que já está preenchido. O modelo tem tendência a
 * reescrever tudo do zero, e reescrever do zero com pouca informação é como o
 * estado se degrada: um campo que estava certo vira null porque as três
 * mensagens novas não falavam dele.
 */
export function montarPromptIncremental(args: {
  estado: EstadoAnterior;
  mensagensNovas: string;
  contextoCliente: string;
  notaVendedor?: string | null;
}): { system: string; user: string } {
  const system = `Você é um gerente de vendas de máquinas pesadas (New Holland Construction e Dynapac)
acompanhando conversas de WhatsApp de um vendedor de campo no Espírito Santo.

Esta negociação JÁ FOI ANALISADA. Você vai receber o ESTADO ATUAL dela e as MENSAGENS NOVAS
que chegaram desde então. Sua tarefa é ATUALIZAR o estado — não refazê-lo do zero.

A REGRA MAIS IMPORTANTE
MANTENHA tudo o que já está preenchido, a menos que as mensagens novas digam o contrário.
Campo preenchido que as mensagens novas não mencionam CONTINUA COMO ESTÁ. Nunca devolva null
nem string vazia num campo que já tinha valor: o valor veio de algo que foi conversado antes e
que você não está vendo agora. Esvaziar um campo por falta de menção é apagar o que a
negociação já tem.

O QUE MUDAR
- Só mexa num campo quando as mensagens novas trouxerem informação sobre ele.
- O resumo você ATUALIZA: mantenha o que continua verdade e acrescente o que mudou.
- A próxima ação você REESCREVE, porque ela é sempre sobre o momento atual.
- Estágio, temperatura e probabilidade: mexa se as mensagens novas justificarem.

REGRAS QUE NÃO SE NEGOCIAM
- NUNCA invente. Se as mensagens novas não dizem, não escreva.
- ANEXO só existe quando a linha traz "[enviou um documento/uma foto/um áudio]", e vale para o
  lado que aparece na linha. Anexo do vendedor NUNCA vira "o cliente mandou".
- Nome de empresa é rótulo, NÃO diz o ramo dela.
- Português do Brasil: ESCAVADEIRA (nunca "excavadora"), retroescavadeira, pá carregadeira,
  rolo compactador, entrada, parcelas, financiamento.

RESPONDA SÓ COM ESTE JSON, sem texto em volta:
{
  "resumoNegociacao": string,
  "estagioVenda": "Lead"|"Qualificação"|"Proposta"|"Negociação"|"Fechamento"|"Pós-venda"|"Perdido",
  "temperatura": "muito_quente"|"quente"|"morna"|"fria",
  "probabilidadeFechamento": number,
  "proximaAcao": string,
  "conversaEncerrada": boolean,
  "alertas": string[],
  "fatos": {
    "marca": "New Holland"|"Dynapac"|null,
    "maquinaModelo": string|null,
    "valor": number|null,
    "condicaoPagamento": "avista"|"financiamento"|"consorcio"|"crd_pme"|null,
    "municipio": string|null,
    "visitaRealizada": boolean|null,
    "entradaValor": number|null,
    "entradaPercentual": number|null,
    "observacao": string|null
  },
  "pedidos": [{"tipo":"vincular_cliente","alvo":string,"motivo":string}]
}
Em "fatos", repita o que já está no estado quando as mensagens novas não mudarem nada.

## Cliente
${args.contextoCliente}`;

  const nota = args.notaVendedor?.trim() ?? "";
  const user = [
    nota ? `${CABECALHO_NOTA_VENDEDOR}\n${nota}\n` : "",
    `=== ESTADO ATUAL DA NEGOCIAÇÃO (mantenha o que não mudou) ===\n${JSON.stringify(args.estado, null, 2)}`,
    `=== MENSAGENS NOVAS (só estas chegaram desde a última análise) ===\n${args.mensagensNovas}`,
  ].filter(Boolean).join("\n\n");

  return { system, user };
}

/**
 * A rede de proteção, em código.
 *
 * O prompt PEDE para manter o que está preenchido; isto GARANTE. Modelo é
 * pedido, não contrato — e num incremental o preço de ele desobedecer é alto:
 * o campo esvaziado some do estado e nunca mais volta, porque a próxima
 * análise parte deste estado já empobrecido. A degradação seria silenciosa e
 * cumulativa.
 *
 * Regra: campo vazio no novo + preenchido no anterior = fica o anterior.
 */
export function mesclarIncremental(
  anterior: AnaliseOrientador,
  novo: AnaliseOrientador,
): AnaliseOrientador {
  const texto = (n: string, a: string) => (n.trim() ? n : a);
  const numero = (n: number | null, a: number | null) => (n != null && n !== 0 ? n : a);

  return {
    ...novo,
    resumoNegociacao: texto(novo.resumoNegociacao, anterior.resumoNegociacao),
    // A próxima ação é sempre sobre o AGORA: se o modelo devolveu uma nova,
    // ela manda; se veio vazia, a anterior ainda é o melhor palpite.
    proximaAcao: texto(novo.proximaAcao, anterior.proximaAcao),
    probabilidadeExplicacao: texto(novo.probabilidadeExplicacao, anterior.probabilidadeExplicacao),
    perfilComprador: novo.perfilComprador ?? anterior.perfilComprador,
    objecoes: novo.objecoes.length ? novo.objecoes : anterior.objecoes,
    oportunidadesPerdidas: novo.oportunidadesPerdidas.length ? novo.oportunidadesPerdidas : anterior.oportunidadesPerdidas,
    combinados: novo.combinados.length ? novo.combinados : anterior.combinados,
    pendencias: novo.pendencias.length ? novo.pendencias : anterior.pendencias,
    // O coaching não vem no incremental (não está no contrato): o anterior
    // continua valendo, em vez de a tela perder a leitura que já tinha.
    coaching: anterior.coaching,
    fatos: {
      marca: novo.fatos.marca ?? anterior.fatos.marca,
      maquinaModelo: novo.fatos.maquinaModelo ?? anterior.fatos.maquinaModelo,
      valor: numero(novo.fatos.valor, anterior.fatos.valor),
      condicaoPagamento: novo.fatos.condicaoPagamento ?? anterior.fatos.condicaoPagamento,
      municipio: novo.fatos.municipio ?? anterior.fatos.municipio,
      visitaRealizada: novo.fatos.visitaRealizada ?? anterior.fatos.visitaRealizada,
      entradaValor: numero(novo.fatos.entradaValor, anterior.fatos.entradaValor),
      entradaPercentual: numero(novo.fatos.entradaPercentual, anterior.fatos.entradaPercentual),
      observacao: novo.fatos.observacao ?? anterior.fatos.observacao,
    },
  };
}
