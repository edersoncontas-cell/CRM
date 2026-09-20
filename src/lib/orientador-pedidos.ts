// PEDIDOS que o vendedor faz ao Orientador pela caixa de contexto.
//
// A caixa nasceu para guardar FATO ("fechamos em 610 mil"). Mas o vendedor
// também escreve ORDEM: "Wadson não é construtora, ele é o proprietário da
// empresa BWB que já está no nosso funil, vincular todas essas informações na
// proposta que já está em negociação". Isso não é um fato a registrar — é uma
// coisa a FAZER, e ficava parada no texto.
//
// Aqui fica o vocabulário do que o Orientador pode executar, e a validação do
// que ele devolve. Módulo puro: sem banco, sem rede, com teste.
//
// PRINCÍPIO: pedido nunca executa sozinho. O Orientador ENTENDE e PROPÕE; o
// vendedor confirma com um clique. Unir dois cadastros mexe em negociação,
// visita e histórico de um cliente real — se a IA entender errado o nome da
// empresa, o estrago é grande e silencioso. Proposta + confirmação custa um
// clique e elimina essa classe inteira de acidente.

/** O que o Orientador sabe executar hoje. */
export const TIPOS_PEDIDO = ["vincular_cliente"] as const;
export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

export type PedidoOrientador = {
  tipo: TipoPedido;
  /** O nome como o vendedor escreveu ("BWB", "Construtora Litoral"). */
  alvo: string;
  /** Por que o Orientador entendeu assim — aparece na tela antes de confirmar. */
  motivo: string;
};

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/**
 * Valida o bloco "pedidos" da resposta do Orientador.
 *
 * Estreito de propósito: tipo fora da lista, alvo vazio ou alvo genérico é
 * descartado. Um pedido mal formado vira nenhum pedido — melhor não propor
 * nada do que propor unir o cliente com "a empresa".
 */
export function normalizarPedidos(bruto: unknown): PedidoOrientador[] {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const saida: PedidoOrientador[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const tipo = texto(p.tipo, 40).toLowerCase();
    if (!TIPOS_PEDIDO.includes(tipo as TipoPedido)) continue;
    const alvo = texto(p.alvo ?? p.cliente ?? p.empresa, 120);
    if (!alvoUtil(alvo)) continue;
    const chave = `${tipo}|${alvo.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ tipo: tipo as TipoPedido, alvo, motivo: texto(p.motivo, 300) });
    if (saida.length >= 3) break; // um pedido por vez é o normal; 3 é folga
  }
  return saida;
}

// Palavras que não identificam ninguém. Sem isto, "vincular à empresa dele"
// viraria uma busca por "empresa" e acharia qualquer coisa.
const GENERICOS = new Set([
  "empresa", "a empresa", "o cliente", "cliente", "construtora", "firma",
  "ele", "ela", "mesmo", "outro", "outra", "n/a", "null", "-", "?",
]);

export function alvoUtil(alvo: string): boolean {
  const a = alvo.trim().toLowerCase();
  if (a.length < 2) return false;
  if (GENERICOS.has(a)) return false;
  // Precisa ter letra: "123" ou "--" não é nome de cliente.
  return /\p{L}/u.test(a);
}

/** A frase que o vendedor lê antes de confirmar. Sem jargão. */
export function descreverPedido(p: PedidoOrientador, nomeAtual: string): string {
  if (p.tipo === "vincular_cliente") {
    return `Passar esta conversa de "${nomeAtual}" para o cliente "${p.alvo}", levando junto as negociações, visitas, alertas e todo o histórico.`;
  }
  return p.alvo;
}

/**
 * Escolhe, entre os clientes encontrados na busca, qual é o alvo.
 *
 * Devolve `null` quando há dúvida — dois cadastros parecidos não podem ser
 * desempatados por chute quando a consequência é fundir cliente de verdade.
 * Nesse caso a tela pede para o vendedor escolher.
 */
export function escolherAlvo<T extends { id: string; nome: string }>(
  alvo: string,
  candidatos: T[],
  excluirId?: string | null,
): { escolhido: T | null; ambiguos: T[] } {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const a = norm(alvo);
  const lista = candidatos.filter((c) => c.id !== excluirId);
  if (!lista.length) return { escolhido: null, ambiguos: [] };

  const exatos = lista.filter((c) => norm(c.nome) === a);
  if (exatos.length === 1) return { escolhido: exatos[0], ambiguos: [] };
  if (exatos.length > 1) return { escolhido: null, ambiguos: exatos };

  // Sem nome idêntico: aceita quem CONTÉM o alvo como palavra inteira —
  // "BWB" casa com "BWB Construções", mas não com "Bwbra Ltda".
  const re = new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const contem = lista.filter((c) => re.test(norm(c.nome)));
  if (contem.length === 1) return { escolhido: contem[0], ambiguos: [] };
  return { escolhido: null, ambiguos: contem.slice(0, 6) };
}

/** Para gravar na coluna. Lista vazia vira null, deixando o campo limpo. */
export function guardarPedidos(pedidos: PedidoOrientador[]): string | null {
  return pedidos.length ? JSON.stringify(pedidos) : null;
}

/** Lê de volta o que está gravado, tolerando lixo. */
export function lerPedidos(bruto: string | null | undefined): PedidoOrientador[] {
  if (!bruto?.trim()) return [];
  try {
    return normalizarPedidos(JSON.parse(bruto));
  } catch {
    return [];
  }
}
