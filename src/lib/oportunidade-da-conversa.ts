// "Transformar em oportunidade": a conversa do WhatsApp vira negociação no
// funil QUANDO O VENDEDOR MANDA, levando junto o que o Orientador já guardou.
//
// Antes a IA abria a negociação sozinha (regra "máquina + pagamento ou
// visita" no pipeline do WhatsApp). Ele não gostou do que aparecia no funil:
// card que ele não pediu, e sem o conteúdo da conversa. Agora a IA só LÊ — e
// o que ela leu (fatos, resumo, combinados, pendências) fica guardado na
// análise do Orientador até ele apertar o botão na conversa.
//
// Módulo PURO, sem banco nem IA: dá para testar cada regra.

import { normalizarFatos, FATOS_VAZIOS, type FatosNegociacao } from "@/lib/orientador-fatos";
import { lerFatosDaNota } from "@/lib/nota-fatos";
import type { NotaVendedor } from "@/lib/orientador-notas";
import { papelDaColuna, ESTAGIO_INICIAL } from "@/lib/pipeline";

/** Teto do texto que vai para a negociação (cabe no card sem virar um livro). */
export const LIMITE_RESUMO_CONVERSA = 4000;

/**
 * Lê os fatos guardados na análise (coluna JSON). Qualquer coisa estranha
 * vira "não sabe" — nunca derruba a tela. A cidade não é validada aqui porque
 * não vai para a negociação (o cadastro do cliente já cuida dela).
 */
export function lerFatosGuardados(bruto: unknown): FatosNegociacao {
  return normalizarFatos(bruto, (n) => (typeof n === "string" && n.trim() ? n.trim() : null));
}

/**
 * Junta a leitura nova com a guardada: o que a leitura nova trouxe ganha; o
 * que ela deixou em branco fica como estava. Uma leitura que não falou de
 * pagamento não pode apagar o pagamento que a anterior achou.
 */
export function somarFatos(guardados: FatosNegociacao, novos: FatosNegociacao): FatosNegociacao {
  const r = { ...guardados };
  for (const k of Object.keys(FATOS_VAZIOS) as (keyof FatosNegociacao)[]) {
    const v = novos[k];
    if (v !== null && v !== undefined && v !== "") (r as Record<string, unknown>)[k] = v;
  }
  return r;
}

/** O que o vendedor escreveu nas notas vale mais que a leitura da IA (ele esteve lá). Mais recente por último. */
export function fatosComNotas(base: FatosNegociacao, notas: NotaVendedor[]): FatosNegociacao {
  return notas.reduce((acc, n) => somarFatos(acc, lerFatosDaNota(n.texto)), base);
}

export type AnaliseParaResumo = {
  resumoNegociacao: string | null;
  perfilComprador: string | null;
  combinados: string[];
  pendencias: string[];
  objecoes: string[];
  atualizadoEm: Date | string | null;
};

const lista = (titulo: string, itens: string[]) => {
  const limpos = itens.map((i) => i.trim()).filter(Boolean);
  return limpos.length ? `${titulo}\n${limpos.map((i) => `• ${i}`).join("\n")}` : null;
};

function dataBR(d: Date | string | null): string | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * O texto que vai para a negociação: resumo, perfil, o que já foi combinado,
 * o que está pendente, objeções e o que o vendedor contou ao Orientador.
 * Nada guardado = null (a negociação nasce sem o bloco, e a tela diz isso).
 */
export function montarResumoConversa(a: AnaliseParaResumo | null, notas: NotaVendedor[]): string | null {
  const partes: (string | null)[] = [];
  if (a) {
    const resumo = a.resumoNegociacao?.trim();
    if (resumo) partes.push(resumo);
    if (a.perfilComprador?.trim()) partes.push(`Perfil do comprador: ${a.perfilComprador.trim()}`);
    partes.push(lista("Já combinado:", a.combinados ?? []));
    partes.push(lista("Pendente:", a.pendencias ?? []));
    partes.push(lista("Objeções:", a.objecoes ?? []));
  }
  partes.push(lista("O que você contou ao Orientador:", notas.map((n) => n.texto)));
  const corpo = partes.filter((p): p is string => !!p).join("\n\n");
  if (!corpo) return null;
  const quando = dataBR(a?.atualizadoEm ?? null);
  const texto = quando ? `${corpo}\n\n(Leitura da conversa do WhatsApp em ${quando}.)` : corpo;
  return texto.length > LIMITE_RESUMO_CONVERSA ? texto.slice(0, LIMITE_RESUMO_CONVERSA - 1) + "…" : texto;
}

/** Limpa o que chega do formulário: vazio vira null, e nada passa do teto. */
export function resumoConversaDoForm(bruto: FormDataEntryValue | null): string | null {
  const t = typeof bruto === "string" ? bruto.trim() : "";
  if (!t) return null;
  return t.slice(0, LIMITE_RESUMO_CONVERSA);
}

/**
 * Em que coluna a oportunidade nasce: a primeira "em negociação"; com visita
 * marcada, a de visita pendente (ou a segunda em negociação). Mesmo critério
 * que o pipeline do WhatsApp usava quando abria sozinho. O vendedor troca no
 * formulário antes de salvar.
 */
export function colunaInicialDaOportunidade(
  colunas: { titulo: string; papel: string | null }[],
  temVisita: boolean,
): string {
  const abertas = colunas.filter((c) => papelDaColuna(c) === "em_negociacao");
  const inicial = abertas[0]?.titulo ?? ESTAGIO_INICIAL;
  if (!temVisita) return inicial;
  return abertas.find((c) => /visita/i.test(c.titulo) && /pend/i.test(c.titulo))?.titulo ?? abertas[1]?.titulo ?? inicial;
}
