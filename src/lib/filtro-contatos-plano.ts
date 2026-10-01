// Plano de mudança do filtro de contatos (o que o assistente de configuração
// devolve). Módulo PURO — sem IA nem banco — para ser testável; quem chama a
// IA é filtro-contatos-ia.ts.
//
// Uma lista só, de palavras inteiras (01/10). Se a IA ainda mandar "tipo"
// (termo/palavra, do tempo das duas listas), ele é ignorado: tudo vira palavra.

import { semAcento, palavraCurtaDemais } from "@/lib/utils";

export type MudancaFiltro = { valor: string };
export type PlanoFiltro = { resposta: string; adicionar: MudancaFiltro[]; remover: MudancaFiltro[] };

const limpo = (v: unknown): string => (typeof v === "string" ? semAcento(v).trim().replace(/\s+/g, " ") : "");

// Aceita o JSON da IA com tolerância: ignora entradas vazias/repetidas ou
// curtas demais para o filtro, não re-adiciona o que já existe e descarta
// "remover" do que nem está na lista.
export function normalizarPlanoFiltro(raw: unknown, atual: { palavras: string[] }): PlanoFiltro {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lerLista = (v: unknown): MudancaFiltro[] => {
    if (!Array.isArray(v)) return [];
    const vistos = new Set<string>();
    const out: MudancaFiltro[] = [];
    for (const item of v) {
      const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const valor = limpo(o.valor);
      if (!valor || valor.length > 40 || vistos.has(valor)) continue;
      vistos.add(valor);
      out.push({ valor });
    }
    return out;
  };
  const naLista = new Set(atual.palavras.map((x) => semAcento(x).trim()));
  // Para remover, vale o valor como está NA LISTA (com acento, se tiver):
  // "escritório" gravado com acento tem de sair quando a IA disser "escritorio".
  const comoNaLista = new Map(atual.palavras.map((x) => [semAcento(x).trim(), x.trim().toLowerCase()]));
  const adicionar = lerLista(p.adicionar).filter((m) => !naLista.has(m.valor) && !palavraCurtaDemais(m.valor));
  const remover = lerLista(p.remover).filter((m) => naLista.has(m.valor)).map((m) => ({ valor: comoNaLista.get(m.valor)! }));
  return { resposta: typeof p.resposta === "string" ? p.resposta.trim().slice(0, 400) : "", adicionar, remover };
}
