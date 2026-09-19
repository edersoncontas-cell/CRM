// Regra PURA do relatório do fim do dia: o que é conversa de NEGÓCIO (venda
// de máquina) e o que é conversa informal.
//
// Pedido do vendedor: "só vai entrar no relatório conversa que realmente
// houve negociação — financiamento, máquinas, os modelos das máquinas, tudo
// que envolve a venda de máquinas. Conversa de contato informal não entra."
//
// Sem banco e sem IA: a classificação de base é determinística (dá para
// testar e roda de graça). A IA só entra depois, para escrever o texto do
// relatório com as conversas que esta regra já separou.

import { extrairMaquina, extrairCategoriaMaquina, extrairIntencao } from "@/lib/ai/heuristics";

export type ClasseConversa = "negocio" | "posvenda" | "informal";

export type ConversaDoDia = {
  conversaId: string;
  clienteId: string | null;
  nome: string;
  telefone: string;
  municipio: string | null;
  texto: string;          // mensagens do dia, uma por linha
  mensagens: number;
  recebidas: number;
  enviadas: number;
  primeiraVez: boolean;   // primeira conversa deste contato no CRM
  jaComprou: boolean;
};

export type ConversaClassificada = ConversaDoDia & {
  classe: ClasseConversa;
  motivo: string;         // por que entrou (ou não) no relatório
  maquina: string | null;
  categoria: string | null;
  temFinanciamento: boolean;
  temValor: boolean;
};

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Dinheiro da venda: financiamento, entrada, parcela, consórcio, à vista.
const TERMOS_FINANCIAMENTO = [
  "financiamento", "financiar", "financia", "finame", "bndes", "carencia", "carência",
  "entrada", "parcela", "parcelamento", "consorcio", "consórcio", "a vista", "à vista",
  "banco", "credito", "crédito", "juros", "taxa", "simulacao", "simulação", "aprovado",
  "cadastro", "boleto", "leasing", "cdc",
];

// Conversa de venda: preço, proposta, prazo, entrega, negociação.
const TERMOS_COMERCIAIS = [
  "preco", "preço", "valor", "quanto", "orcamento", "orçamento", "proposta", "cotacao", "cotação",
  "desconto", "condicao", "condição", "negociar", "negocio", "negócio", "comprar", "compra",
  "vender", "venda", "fechar", "fechamento", "entrega", "prazo", "frete", "nota fiscal",
  "faturar", "faturamento", "pedido", "troca", "avaliacao", "avaliação", "seminova", "usada",
  "demonstracao", "demonstração", "visita", "ficha tecnica", "ficha técnica", "garantia",
];

// Máquina: nome comum do equipamento (o modelo vem do catálogo, via heurística).
const TERMOS_MAQUINA = [
  "maquina", "máquina", "equipamento", "escavadeira", "retro", "retroescavadeira",
  "carregadeira", "pa carregadeira", "pá carregadeira", "motoniveladora", "patrol",
  "rolo", "compactador", "vibroacabadora", "pavimentadora", "fresadora", "minicarregadeira",
  "esteira", "caçamba", "cacamba", "lamina", "lâmina", "implemento",
];

// Pós-venda / assistência: é trabalho, mas não é negociação nova.
const TERMOS_POSVENDA = [
  "revisao", "revisão", "manutencao", "manutenção", "assistencia", "assistência", "tecnico",
  "técnico", "defeito", "quebrou", "quebrado", "vazamento", "pane", "oficina", "mecanico",
  "mecânico", "peca", "peça", "filtro", "oleo", "óleo", "garantia de fabrica",
];

function contem(texto: string, termos: string[]): string | null {
  const t = semAcento(texto);
  for (const termo of termos) {
    const alvo = semAcento(termo);
    if (t.includes(alvo)) return termo;
  }
  return null;
}

// Classifica UMA conversa do dia. Determinística e barata.
export function classificarConversa(c: ConversaDoDia): ConversaClassificada {
  const texto = c.texto ?? "";
  const maquina = extrairMaquina(texto);
  const categoria = extrairCategoriaMaquina(texto);
  const intencao = extrairIntencao(texto);
  const financiamento = contem(texto, TERMOS_FINANCIAMENTO);
  const comercial = contem(texto, TERMOS_COMERCIAIS);
  const maquinaTermo = contem(texto, TERMOS_MAQUINA);
  const posvenda = contem(texto, TERMOS_POSVENDA);

  const falaDeMaquina = !!(maquina || categoria || maquinaTermo);
  const falaDeDinheiro = !!(financiamento || comercial);

  const base = {
    ...c,
    maquina,
    categoria,
    temFinanciamento: !!financiamento,
    temValor: !!comercial,
  };

  // Financiamento sozinho já é assunto de venda (o cliente que pergunta de
  // entrada e parcela está negociando, mesmo sem citar o modelo).
  if (financiamento && (falaDeMaquina || intencao === "comprar" || intencao === "cotar")) {
    return { ...base, classe: "negocio", motivo: `financiamento (${financiamento})` };
  }
  if (falaDeMaquina && falaDeDinheiro) {
    return { ...base, classe: "negocio", motivo: maquina ? `modelo ${maquina}` : `máquina + ${comercial ?? financiamento}` };
  }
  if (maquina && (intencao === "comprar" || intencao === "cotar")) {
    return { ...base, classe: "negocio", motivo: `modelo ${maquina}` };
  }
  // Assistência/peça: é atendimento, não negociação nova.
  if (posvenda && falaDeMaquina) {
    return { ...base, classe: "posvenda", motivo: `pós-venda (${posvenda})` };
  }
  if (posvenda) return { ...base, classe: "posvenda", motivo: `pós-venda (${posvenda})` };
  return { ...base, classe: "informal", motivo: "sem assunto de venda de máquina" };
}

export type ResumoDia = {
  total: number;
  negocio: ConversaClassificada[];
  posvenda: ConversaClassificada[];
  informais: number;
  novos: number;      // contatos novos COM negociação
  carteira: number;   // clientes da carteira COM negociação
};

export function resumirDia(conversas: ConversaDoDia[]): ResumoDia {
  const classificadas = conversas.map(classificarConversa);
  const negocio = classificadas.filter((c) => c.classe === "negocio");
  const posvenda = classificadas.filter((c) => c.classe === "posvenda");
  return {
    total: conversas.length,
    negocio,
    posvenda,
    informais: classificadas.filter((c) => c.classe === "informal").length,
    novos: negocio.filter((c) => c.primeiraVez).length,
    carteira: negocio.filter((c) => !c.primeiraVez).length,
  };
}

// Texto do relatório (o mesmo que vai para o WhatsApp do vendedor). Sem IA:
// já é útil assim; a IA só reescreve por cima quando está disponível.
export function textoRelatorio(args: {
  dia: string;              // "19/09/2026"
  resumo: ResumoDia;
  visitasRealizadas: { cliente: string; municipio: string | null }[];
  visitasAmanha: { cliente: string; municipio: string | null; hora: string }[];
  faturadas: { cliente: string; maquina: string | null; valor: number | null }[];
  novasNegociacoes: { cliente: string; maquina: string | null }[];
}): string {
  const { resumo } = args;
  const linhas: string[] = [`Relatório do dia — ${args.dia}`, ""];

  if (resumo.negocio.length === 0) {
    linhas.push("Nenhuma conversa de negociação hoje.");
  } else {
    linhas.push(`Conversas de negociação: ${resumo.negocio.length} (${resumo.novos} contato(s) novo(s), ${resumo.carteira} da carteira)`);
    for (const c of resumo.negocio) {
      const onde = c.municipio ? ` (${c.municipio})` : "";
      const quem = c.primeiraVez ? "NOVO" : "carteira";
      const oque = [c.maquina ?? c.categoria, c.temFinanciamento ? "financiamento" : null].filter(Boolean).join(", ");
      linhas.push(`• ${c.nome}${onde} — ${quem}${oque ? ` · ${oque}` : ""} · ${c.mensagens} mensagem(ns)`);
    }
  }

  if (resumo.posvenda.length) {
    linhas.push("", `Pós-venda/assistência (não conta como negociação): ${resumo.posvenda.map((c) => c.nome).join(", ")}.`);
  }
  if (resumo.informais) {
    linhas.push(`Conversas informais no dia: ${resumo.informais} (fora do relatório).`);
  }

  if (args.faturadas.length) {
    linhas.push("", "Faturado hoje:");
    for (const f of args.faturadas) {
      const v = f.valor ? ` — R$ ${Math.round(f.valor).toLocaleString("pt-BR")}` : "";
      linhas.push(`• ${f.cliente}${f.maquina ? ` (${f.maquina})` : ""}${v}`);
    }
  }
  if (args.novasNegociacoes.length) {
    linhas.push("", `Negociações abertas hoje: ${args.novasNegociacoes.map((n) => `${n.cliente}${n.maquina ? ` (${n.maquina})` : ""}`).join("; ")}.`);
  }
  if (args.visitasRealizadas.length) {
    linhas.push("", `Visitas realizadas: ${args.visitasRealizadas.map((v) => `${v.cliente}${v.municipio ? ` (${v.municipio})` : ""}`).join("; ")}.`);
  }
  if (args.visitasAmanha.length) {
    linhas.push("", `Amanhã: ${args.visitasAmanha.map((v) => `${v.hora} ${v.cliente}${v.municipio ? ` (${v.municipio})` : ""}`).join("; ")}.`);
  }

  return linhas.join("\n");
}
