// O que o vendedor conta ao Orientador, acumulado ao longo do tempo.
//
// Antes era UM texto só, trocado a cada salvamento. Isso ficou errado no
// momento em que a caixa passou a limpar depois de "Salvar e atualizar":
// escrever "máquina é a E145C" hoje e "vai financiar pelo Sicoob" amanhã
// apagaria a máquina. Agora cada salvamento ACRESCENTA uma entrada datada.
//
// A data importa para a IA: quando duas entradas se contradizem — "fechamos em
// 610 mil" e, duas semanas depois, "consegui fechar em 600" —, a mais nova é
// que vale. Sem data, o modelo teria de adivinhar a ordem.
//
// Módulo puro: sem banco e sem rede, para cada regra ter teste.

export type NotaVendedor = { em: string | null; texto: string };

/** Teto do conjunto. A nota inteira vai no prompt a cada análise; crescer sem
 *  fim custaria dinheiro e, pior, diluiria o que é recente no meio de coisa
 *  velha. Ao estourar, as entradas MAIS ANTIGAS saem. */
export const LIMITE_TOTAL = 6000;
export const LIMITE_ENTRADA = 4000;

/**
 * Lê o que está gravado.
 *
 * Aceita os dois formatos porque há nota antiga no banco: o novo é um JSON de
 * entradas; o antigo é texto puro, e vira uma entrada só, sem data.
 */
export function lerNotas(bruto: string | null | undefined): NotaVendedor[] {
  const t = (bruto ?? "").trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) {
        return arr
          .map((n): NotaVendedor => ({
            em: typeof n?.em === "string" ? n.em : null,
            texto: typeof n?.texto === "string" ? n.texto.trim() : "",
          }))
          .filter((n) => n.texto);
      }
    } catch {
      // Não era JSON: cai no formato antigo, abaixo.
    }
  }
  return [{ em: null, texto: t }];
}

/** Grava de volta. Lista vazia vira null, para o campo ficar limpo no banco. */
export function gravarNotas(notas: NotaVendedor[]): string | null {
  const limpas = notas.filter((n) => n.texto.trim());
  return limpas.length ? JSON.stringify(limpas) : null;
}

/** Soma dos textos — é o que pesa no prompt. */
function tamanho(notas: NotaVendedor[]): number {
  return notas.reduce((s, n) => s + n.texto.length, 0);
}

/**
 * Acrescenta um contexto novo. Devolve o valor pronto para gravar.
 *
 * Repetir a mesma frase não cria entrada nova: o vendedor clica duas vezes em
 * "Salvar e atualizar" com facilidade, e duas cópias do mesmo fato só ocupam
 * espaço no prompt.
 */
export function acrescentarNota(
  bruto: string | null | undefined,
  texto: string,
  agora: Date = new Date(),
): string | null {
  const novo = texto.trim().slice(0, LIMITE_ENTRADA);
  if (!novo) return gravarNotas(lerNotas(bruto));

  const notas = lerNotas(bruto);
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (notas.some((n) => igual(n.texto, novo))) return gravarNotas(notas);

  notas.push({ em: agora.toISOString(), texto: novo });

  // Estourou o teto: as mais antigas saem. A entrada recém-escrita nunca sai,
  // nem que ela sozinha passe do limite — é a que o vendedor acabou de dizer.
  while (notas.length > 1 && tamanho(notas) > LIMITE_TOTAL) notas.shift();
  return gravarNotas(notas);
}

/** Apaga uma entrada pelo índice. Existe porque um fato errado guardado como
 *  FATO envenena toda análise seguinte, e o vendedor precisa poder corrigir. */
export function removerNota(bruto: string | null | undefined, indice: number): string | null {
  const notas = lerNotas(bruto);
  if (indice < 0 || indice >= notas.length) return gravarNotas(notas);
  notas.splice(indice, 1);
  return gravarNotas(notas);
}

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(iso));

/**
 * Como o conjunto chega à IA: em ordem cronológica, cada um com a data, e com
 * o aviso de que o mais novo ganha do mais velho quando se contradisserem.
 */
export function textoParaPrompt(bruto: string | null | undefined): string | null {
  const notas = lerNotas(bruto);
  if (!notas.length) return null;
  const linhas = notas.map((n) => (n.em ? `[${dataCurta(n.em)}] ${n.texto}` : n.texto));
  if (notas.length === 1) return linhas[0];
  return [
    "Estes são os vários contextos que o vendedor foi escrevendo, do mais",
    "antigo para o mais novo. Quando dois se contradisserem, VALE O MAIS NOVO:",
    "",
    ...linhas,
  ].join("\n");
}
