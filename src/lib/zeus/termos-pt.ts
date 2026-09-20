// O vocabulário da casa, aplicado por código no texto que a IA devolve.
//
// "e outra excavadora? erro grotesco de português."
//
// Está certo: em português do Brasil é ESCAVADEIRA. "Excavadora" é espanhol, e
// os modelos escorregam nisso o tempo todo porque o material técnico de
// máquina pesada na internet é majoritariamente em espanhol e em inglês. O
// mesmo vale para "retroexcavadora", "cargadora", "compactadora".
//
// Pedir no prompt ajuda, mas não garante — e um erro desses na tela, na frente
// de quem vende máquina há anos, destrói a confiança no painel inteiro. Então
// a correção é feita por código, depois da resposta, onde é determinística.
//
// Só entram trocas em que a forma errada NÃO tem outro significado legítimo em
// português, para nunca estragar um texto correto. Módulo puro, com teste.

/**
 * Cada regra é [errado, certo]. A forma errada é escrita sem acento e em
 * minúscula; a comparação também, para pegar "Excavadora", "EXCAVADORA" e
 * "excavadora" de uma vez. A caixa da primeira letra do original é preservada.
 */
const TROCAS: [RegExp, string][] = [
  // Escavadeira e parentes — o erro reportado. "Sempre será escavadeira":
  // toda variante em -adora (do espanhol) e todo "ex-" cai aqui.
  [/\bretroexcavadoras\b/g, "retroescavadeiras"],
  [/\bretroexcavadora\b/g, "retroescavadeira"],
  [/\bretroescavadoras\b/g, "retroescavadeiras"],
  [/\bretroescavadora\b/g, "retroescavadeira"],
  [/\bretro\s?excavadeiras\b/g, "retroescavadeiras"],
  [/\bretro\s?excavadeira\b/g, "retroescavadeira"],
  [/\bexcavadoras\b/g, "escavadeiras"],
  [/\bexcavadora\b/g, "escavadeira"],
  [/\bexcavadeiras\b/g, "escavadeiras"],
  [/\bexcavadeira\b/g, "escavadeira"],
  [/\bescavadoras\b/g, "escavadeiras"],
  [/\bescavadora\b/g, "escavadeira"],
  // Pá carregadeira.
  [/\bcargadoras\b/g, "pás carregadeiras"],
  [/\bcargadora\b/g, "pá carregadeira"],
  [/\bpas?\s+carregadoras\b/g, "pás carregadeiras"],
  [/\bpa\s+carregadora\b/g, "pá carregadeira"],
  // Rolo compactador (no Brasil o rolo é compactador, não "compactadora").
  [/\bcompactadoras\b/g, "rolos compactadores"],
  [/\bcompactadora\b/g, "rolo compactador"],
  // Motoniveladora: "niveladora" solta é ambígua, fica de fora de propósito.
  [/\bmotoniveladoras?\s+de\s+motor\b/g, "motoniveladoras"],
  // Empréstimo do espanhol que aparece em condição de pagamento.
  [/\bfinanciacion\b/g, "financiamento"],
  [/\benganche\b/g, "entrada"],
  [/\bcuotas\b/g, "parcelas"],
  [/\bcuota\b/g, "parcela"],
  [/\bprestamo\b/g, "financiamento"],
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Devolve `certo` com a caixa da primeira letra copiada de `original`. */
function comACaixaDe(original: string, certo: string): string {
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return certo[0].toUpperCase() + certo.slice(1);
  }
  return certo;
}

/**
 * Corrige os termos do setor no texto que a IA devolveu.
 *
 * Trabalha sobre uma cópia sem acento e em minúscula só para ACHAR as
 * posições; o que é recortado e devolvido sai do texto original, para não
 * mexer no resto da acentuação.
 */
export function corrigirTermos(texto: string | null | undefined): string {
  const t = texto ?? "";
  if (!t.trim()) return t;

  // Índice de busca: mesma quantidade de caracteres do original (NFD sem as
  // marcas de acento pode encurtar, então o mapa é feito caractere a
  // caractere para as posições baterem).
  const busca = Array.from(t).map((c) => semAcento(c).toLowerCase() || c).join("");

  type Corte = { inicio: number; fim: number; certo: string };
  const cortes: Corte[] = [];
  for (const [re, certo] of TROCAS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(busca))) {
      const inicio = m.index;
      const fim = inicio + m[0].length;
      // Regras mais específicas vêm antes; não sobrepõe o que já foi marcado.
      if (cortes.some((c) => inicio < c.fim && fim > c.inicio)) continue;
      cortes.push({ inicio, fim, certo });
    }
  }
  if (!cortes.length) return t;

  cortes.sort((a, b) => a.inicio - b.inicio);
  let saida = "";
  let cursor = 0;
  for (const c of cortes) {
    saida += t.slice(cursor, c.inicio);
    saida += comACaixaDe(t.slice(c.inicio, c.fim), c.certo);
    cursor = c.fim;
  }
  return saida + t.slice(cursor);
}

/** Aplica a correção em cada texto de uma lista, descartando os vazios. */
export function corrigirTermosNaLista(lista: string[] | null | undefined): string[] {
  return (lista ?? []).map(corrigirTermos).filter((s) => s.trim().length > 0);
}
