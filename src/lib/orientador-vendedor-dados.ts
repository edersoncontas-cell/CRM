// Os FATOS do vendedor, contados no banco.
//
// A régua do diagnóstico mora em orientador-vendedor.ts (puro e testado); aqui
// é só a contagem. Separado de propósito: é a conta que muda quando o schema
// muda, e a régua não pode ser refeita junto.

import { db } from "@/lib/db";
import { criarCategorizadorColunas, ehFunilAberto, type CategoriaColuna } from "@/lib/pipeline";
import { DIAS_PARADA, type FatosVendedor } from "@/lib/orientador-vendedor";

/** Janela padrão: um ano fecha o ciclo de sazonalidade da safra e da obra. */
export const MESES_JANELA = 12;

// A ORDEM das fases. Uma negociação que está em NEGOCIAÇÃO já passou por
// PROPOSTA, mesmo que ninguém tenha arrastado o card por lá — e uma que
// faturou passou por todas. Sem esta escada, a venda rápida (oportunidade
// direto para faturado, que acontece com cliente antigo) apareceria como se
// tivesse furado o funil, e a taxa de passagem viria menor que a real.
const NIVEL: Record<CategoriaColuna, number> = {
  em_negociacao: 1, banco: 2, negociacao: 3, confirmada: 3, perdida: 0, outro: 0,
};

/** Até onde esta negociação chegou: 1 oportunidade, 2 proposta, 3 negociação, 4 faturado. */
export function nivelAlcancado(cat: CategoriaColuna, status: string): number {
  if (status === "ganha") return 4;
  // A perdida parou na fase em que estava quando morreu — o estágio dela é a
  // coluna VENDA PERDIDA, que não diz nada sobre até onde chegou. Sem saber,
  // conta como oportunidade: preferir o número menor mantém a taxa honesta
  // (nunca infla passagem que não houve).
  if (status === "perdida" && NIVEL[cat] === 0) return 1;
  return NIVEL[cat] || 1;
}

/** Uma pergunta de verdade, não um "?" solto nem "tudo bem?" de saudação. */
export function temPergunta(texto: string): boolean {
  const t = (texto ?? "").trim();
  if (!t.includes("?")) return false;
  // Precisa de conteúdo antes da interrogação: "?" e "??" sozinhos são
  // estranhamento, não pergunta de diagnóstico.
  return t.replace(/[?\s]/g, "").length >= 8;
}

export async function contarFatosVendedor(agora: Date = new Date()): Promise<FatosVendedor> {
  const desde = new Date(agora);
  desde.setMonth(desde.getMonth() - MESES_JANELA);
  const corteParada = new Date(agora);
  corteParada.setDate(corteParada.getDate() - DIAS_PARADA);

  const [colunas, negociacoes, visitasRealizadas, mensagens] = await Promise.all([
    db.colunaFunil.findMany({ select: { titulo: true, papel: true, probabilidade: true } }),
    // Tudo que ENTROU no período (para as taxas de passagem) e tudo que ainda
    // está aberto (para o follow-up), mesmo que tenha entrado antes.
    db.negociacao.findMany({
      where: { OR: [{ criadoEm: { gte: desde } }, { status: "aberta" }] },
      select: { id: true, estagio: true, status: true, valor: true, criadoEm: true, motivoPerda: true, ultimoContato: true, atualizadoEm: true },
    }),
    db.visita.count({ where: { status: "realizada", data: { gte: desde } } }),
    // Só o que ELE mandou pelo CRM. A resposta automática do ZEUS não conta:
    // ela não diz nada sobre o jeito dele de conduzir conversa.
    db.whatsAppMessage.findMany({
      where: { direction: "OUT", origin: "CRM", sentAt: { gte: desde } },
      select: { body: true },
      take: 5000,
    }).catch(() => []),
  ]);

  const categorizar = criarCategorizadorColunas(colunas);

  const noPeriodo = negociacoes.filter((n) => n.criadoEm >= desde);
  let chegaramProposta = 0, chegaramNegociacao = 0, faturadas = 0;
  for (const n of noPeriodo) {
    const nivel = nivelAlcancado(categorizar(n.estagio), n.status);
    if (nivel >= 2) chegaramProposta++;
    if (nivel >= 3) chegaramNegociacao++;
    if (nivel >= 4) faturadas++;
  }

  const perdidasNoPeriodo = noPeriodo.filter((n) => n.status === "perdida");
  const perdidasPorMotivo: Record<string, number> = {};
  let perdidasSemMotivo = 0;
  let valorPerdido = 0;
  for (const n of perdidasNoPeriodo) {
    const chave = (n.motivoPerda ?? "").split(":")[0].trim() || "nao_informado";
    perdidasPorMotivo[chave] = (perdidasPorMotivo[chave] ?? 0) + 1;
    if (chave === "nao_informado") perdidasSemMotivo++;
    valorPerdido += n.valor ?? 0;
  }

  // Abertas de verdade: estágio que bate com uma coluna aberta de hoje.
  // Negociação órfã (coluna renomeada no passado) não aparece no funil e não
  // pode contar como "esfriando" — ele não teria nem como achar o card.
  const abertas = negociacoes.filter((n) => n.status === "aberta" && ehFunilAberto(categorizar(n.estagio)));
  const abertasParadas = abertas.filter((n) => (n.ultimoContato ?? n.atualizadoEm) < corteParada).length;

  return {
    meses: MESES_JANELA,
    criadas: noPeriodo.length,
    chegaramProposta, chegaramNegociacao, faturadas,
    perdidas: perdidasNoPeriodo.length,
    perdidasPorMotivo, perdidasSemMotivo, valorPerdido,
    abertas: abertas.length, abertasParadas,
    mensagensEnviadas: mensagens.length,
    mensagensComPergunta: mensagens.filter((m) => temPergunta(m.body)).length,
    visitasRealizadas,
  };
}
