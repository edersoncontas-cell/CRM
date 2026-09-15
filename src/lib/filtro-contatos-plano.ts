// Plano de mudança do filtro de contatos (o que o assistente de configuração
// devolve). Módulo PURO — sem IA nem banco — para ser testável; quem chama a
// IA é filtro-contatos-ia.ts.

import { semAcento } from "@/lib/utils";

export type TipoTermoBloqueio = "termo" | "palavra";
export type MudancaFiltro = { tipo: TipoTermoBloqueio; valor: string };
export type PlanoFiltro = { resposta: string; adicionar: MudancaFiltro[]; remover: MudancaFiltro[] };

const limpo = (v: unknown): string => (typeof v === "string" ? semAcento(v).trim() : "");
const tipoValido = (v: unknown): TipoTermoBloqueio => (v === "termo" ? "termo" : "palavra");

// Aceita o JSON da IA com tolerância: ignora entradas vazias/repetidas, força o
// tipo para termo|palavra, não re-adiciona o que já existe e descarta
// "remover" do que nem está na lista.
export function normalizarPlanoFiltro(raw: unknown, atual: { termos: string[]; palavras: string[] }): PlanoFiltro {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lerLista = (v: unknown): MudancaFiltro[] => {
    if (!Array.isArray(v)) return [];
    const vistos = new Set<string>();
    const out: MudancaFiltro[] = [];
    for (const item of v) {
      const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const valor = limpo(o.valor);
      if (!valor || valor.length > 40) continue;
      const tipo = tipoValido(o.tipo);
      const chave = `${tipo}:${valor}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ tipo, valor });
    }
    return out;
  };
  const existe = (m: MudancaFiltro) => (m.tipo === "termo" ? atual.termos : atual.palavras).includes(m.valor);
  const adicionar = lerLista(p.adicionar).filter((m) => !existe(m));
  const remover = lerLista(p.remover).filter(existe);
  return { resposta: typeof p.resposta === "string" ? p.resposta.trim().slice(0, 400) : "", adicionar, remover };
}
