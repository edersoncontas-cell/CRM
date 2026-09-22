// A LEITURA COM IA por cima do diagnóstico.
//
// O diagnóstico de orientador-vendedor.ts continua sendo a base e funciona
// sozinho, sem IA nenhuma. Isto aqui é uma CAMADA por cima: pega os mesmos
// números já medidos e escreve a conversa que um gerente bom teria com ele.
//
// Duas decisões que valem o comentário:
//
//   1. A IA NÃO recebe o banco, recebe os FATOS JÁ CONTADOS. Ela não conta
//      nada, não estima nada e não tem de onde inventar número: tudo que pode
//      citar já está escrito no pedido. Modelo de linguagem inventa número com
//      uma facilidade assustadora, e um número inventado numa tela dessas
//      destrói a confiança em tudo que o CRM diz.
//   2. É SOB DEMANDA, num botão. Ele paga só o Gemini Plus — tela que chama
//      IA sozinha a cada carregamento gasta cota dele sem ele pedir. E a
//      resposta fica guardada: enquanto os números não mudarem, reler não
//      custa chamada nova.
//
// O montador do pedido é puro de propósito (tem teste): o que dá para provar
// aqui é que todo número que a IA pode citar chega junto e que a proibição de
// inventar está no texto. A resposta do provedor, não — depende de rede.

import type { DiagnosticoVendedor, FatosVendedor } from "@/lib/orientador-vendedor";
import { MOTIVOS_PERDA } from "@/lib/pipeline";

export const CHAVE_LEITURA = "vendedor.leitura.v1";

export type LeituraIA = {
  texto: string;
  em: string;
  /** Assinatura dos números que geraram esta leitura. */
  assinatura: string;
};

/**
 * Assinatura dos fatos. Muda quando o retrato muda — e é só nessa hora que
 * vale gastar uma chamada nova. Sem isto, cada abertura da tela gastaria cota
 * para reescrever a mesma coisa com outras palavras.
 */
export function assinaturaDosFatos(f: FatosVendedor): string {
  const motivos = Object.entries(f.perdidasPorMotivo).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(",");
  return [
    f.criadas, f.chegaramProposta, f.chegaramNegociacao, f.faturadas,
    f.perdidas, f.perdidasSemMotivo, f.abertas, f.abertasParadas,
    f.mensagensEnviadas, f.mensagensComPergunta, f.visitasRealizadas, motivos,
  ].join("|");
}

const SYSTEM = `Você é gerente de vendas experiente em MÁQUINAS PESADAS (New Holland Construction e rolos Dynapac) no sul do Espírito Santo. Está conversando com Ederson, vendedor da sua equipe, sobre o desempenho dele.

COMO FALAR
- Português do Brasil, direto, de gerente para vendedor. Trate por "você".
- Sem jargão de coach, sem "potencializar", "alavancar", "mindset", "jornada".
- Nada de elogio vazio. Se for elogiar, elogie um número.
- Frases curtas. Ele lê isso no celular, entre uma visita e outra.

REGRA QUE NÃO SE QUEBRA
- Use SOMENTE os números que estão no pedido. Não calcule médias novas, não estime, não compare com "o mercado" nem com outros vendedores — você não tem esses dados.
- Se quiser citar um número, ele tem que estar escrito no pedido, igual.
- Não invente cliente, máquina, cidade, valor ou episódio. Você não viu as conversas dele, só os números.
- Não repita a lista de números como relatório: ela já está na tela acima. Seu trabalho é dizer o que ela SIGNIFICA e o que fazer.

O QUE ESCREVER (nesta ordem, sem títulos, sem bullet, 4 parágrafos curtos)
1. O que os números dizem do jeito dele de vender — a leitura que ele não faria sozinho.
2. A causa mais provável do principal problema, explicada com a realidade de venda de máquina (ciclo longo, decisão familiar ou societária, financiamento, safra, obra parada).
3. Uma coisa concreta para fazer nas próximas duas semanas. Uma só, específica, do tamanho de quem trabalha sozinho na rua.
4. Uma frase de fechamento, sem bajulação.

Máximo de 220 palavras no total.`;

/** Descreve os fatos em texto, para a IA não ter de onde inventar número. */
export function fatosEmTexto(f: FatosVendedor, d: DiagnosticoVendedor): string {
  const l: string[] = [];
  l.push(`JANELA: últimos ${f.meses} meses.`);
  l.push(`FUNIL: ${f.criadas} negociações entraram; ${f.chegaramProposta} chegaram a proposta; ${f.chegaramNegociacao} chegaram a negociação com crédito encaminhado; ${f.faturadas} faturaram.`);
  if (d.taxaGeral !== null) l.push(`CONVERSÃO GERAL: ${Math.round(d.taxaGeral * 100)}% do que entra fatura.`);
  if (d.gargalo) l.push(`GARGALO (a passagem mais fraca): ${d.gargalo.de} para ${d.gargalo.para}, ${Math.round(d.gargalo.taxa * 100)}% passam.`);
  l.push(`PERDAS: ${f.perdidas} no período.`);
  const motivos = Object.entries(f.perdidasPorMotivo)
    .filter(([k]) => k !== "nao_informado")
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${MOTIVOS_PERDA.find((m) => m.id === k)?.label ?? k}: ${v}`);
  if (motivos.length) l.push(`MOTIVOS DAS PERDAS: ${motivos.join("; ")}.`);
  if (f.perdidasSemMotivo) l.push(`PERDAS SEM MOTIVO REGISTRADO: ${f.perdidasSemMotivo}.`);
  l.push(`CARTEIRA ABERTA: ${f.abertas} negociações abertas, ${f.abertasParadas} sem contato há mais de 21 dias.`);
  l.push(`CONVERSA: ele mandou ${f.mensagensEnviadas} mensagens pelo CRM; ${f.mensagensComPergunta} tinham pergunta.`);
  l.push(`CAMPO: ${f.visitasRealizadas} visitas realizadas.`);
  l.push(`PERFIL QUE O CRM CALCULOU: ${d.perfil.titulo} — ${d.perfil.descricao}`);
  if (d.sinais.length) {
    l.push("SINAIS, do mais grave ao menos grave:");
    for (const s of d.sinais) l.push(`- [${s.gravidade}] ${s.titulo}: ${s.fato}`);
  }
  return l.join("\n");
}

/** O pedido completo. Puro: dá para conferir o que a IA vai receber. */
export function montarPedido(
  f: FatosVendedor,
  d: DiagnosticoVendedor,
  regrasDoNegocio: string[],
): { system: string; user: string } {
  // As regras da casa entram no SYSTEM, não no USER: são restrição de
  // comportamento, e no meio dos dados a IA as trata como mais um fato e
  // sugere justamente o que o vendedor já disse que não faz (aceitar máquina
  // como entrada, por exemplo).
  const regras = regrasDoNegocio.map((r) => `- ${r}`).join("\n");
  const system = regras
    ? `${SYSTEM}\n\nA REALIDADE DESTE NEGÓCIO (o que o vendedor já disse que vale aqui — nunca sugira o contrário disto):\n${regras}`
    : SYSTEM;
  return { system, user: fatosEmTexto(f, d) };
}

/**
 * Limpa a resposta: modelo gosta de abrir com "Claro!", pôr título em markdown
 * e fechar com pergunta de atendente. Nada disso cabe numa tela de diagnóstico.
 */
export function limparResposta(bruto: string): string {
  return (bruto ?? "")
    .replace(/^\s*(claro|certo|beleza|perfeito|com certeza|ótimo)[!,.:]?\s*/i, "")
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n\n")
    .trim();
}
