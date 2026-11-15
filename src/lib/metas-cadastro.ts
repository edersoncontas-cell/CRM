// Metas e supermetas — leitura e gravação no banco. Só servidor.
// Regras puras (validação, progresso, exemplos) em lib/metas-regra.ts.

import { cache } from "react";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import {
  CHAVE_RECURSO_METAS, LIMITES_META, metasLigado, calcularProgresso, metaAnualEfetiva, metasDeExemplo,
  type Indicador, type MetaValidada, type ProgressoMeta,
} from "@/lib/metas-regra";
import { diaBR, meiaNoiteBR } from "@/lib/fuso-brasilia";

/** O recurso está ligado? Banco fora do ar ou erro = desligado. Memoizado por requisição. */
export const metasRecursoLigado = cache(async (): Promise<boolean> => {
  try {
    return metasLigado(await getConfig(CHAVE_RECURSO_METAS));
  } catch {
    return false;
  }
});

export type MetaComProgresso = {
  id: string;
  periodo: string;
  indicador: Indicador;
  inicio: string;      // ISO
  fim: string;         // ISO (exclusivo)
  meta: number;
  supermeta: number | null;
  exemplo: boolean;
  recompensa: { descricao: string; valorReais: number | null } | null;
  progresso: ProgressoMeta;
};

/** Quanto já foi feito no período — as MESMAS definições de lib/metas.ts. */
async function valorAtual(indicador: Indicador, inicio: Date, fim: Date): Promise<number> {
  switch (indicador) {
    case "maquinas_faturadas":
      return db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: inicio, lt: fim } } });
    case "faturamento": {
      const r = await db.negociacao.aggregate({ _sum: { valor: true }, where: { status: "ganha", faturadoEm: { gte: inicio, lt: fim } } });
      return r._sum.valor ?? 0;
    }
    case "visitas":
      // Meta de visitas REALIZADAS (confirmadas com o ✓ na tela de Visitas).
      return db.visita.count({ where: { status: "realizada", data: { gte: inicio, lt: fim } } });
    case "negociacoes_novas":
      return db.negociacao.count({ where: { criadoEm: { gte: inicio, lt: fim } } });
  }
}

/** Erro de banco SOBE: a tela mostra que falhou, não uma lista vazia. */
export async function listarMetasComProgresso(agora: Date = new Date()): Promise<MetaComProgresso[]> {
  const metas = await db.meta.findMany({
    orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
    take: LIMITES_META.metasNaTela,
    include: { recompensa: { select: { descricao: true, valorReais: true } } },
  });
  return Promise.all(metas.map(async (m) => {
    const atual = await valorAtual(m.indicador as Indicador, m.inicio, m.fim);
    return {
      id: m.id, periodo: m.periodo, indicador: m.indicador as Indicador,
      inicio: m.inicio.toISOString(), fim: m.fim.toISOString(),
      meta: m.meta, supermeta: m.supermeta, exemplo: m.exemplo,
      recompensa: m.recompensa,
      progresso: calcularProgresso(m, atual, agora),
    };
  }));
}

async function recompensaId(texto: string, valor: number | null, tx: Pick<typeof db, "recompensa">): Promise<string | null> {
  if (!texto) return null;
  const r = await tx.recompensa.create({ data: { descricao: texto, valorReais: valor } });
  return r.id;
}

export async function criarMeta(v: MetaValidada, exemplo = false): Promise<string> {
  return db.$transaction(async (tx) => {
    const rid = await recompensaId(v.recompensa, v.valorRecompensa, tx);
    const m = await tx.meta.create({
      data: { periodo: v.periodo, indicador: v.indicador, inicio: v.inicio, fim: v.fim, meta: v.meta, supermeta: v.supermeta, recompensaId: rid, exemplo },
    });
    return m.id;
  });
}

export async function atualizarMeta(id: string, v: MetaValidada): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const atual = await tx.meta.findUnique({ where: { id }, select: { id: true, recompensaId: true } });
    if (!atual) return false;
    // Recompensa nova a cada edição: a antiga, se ficou sem uso, é apagada.
    const rid = await recompensaId(v.recompensa, v.valorRecompensa, tx);
    await tx.meta.update({
      where: { id },
      data: { periodo: v.periodo, indicador: v.indicador, inicio: v.inicio, fim: v.fim, meta: v.meta, supermeta: v.supermeta, recompensaId: rid, exemplo: false },
    });
    if (atual.recompensaId) await tx.recompensa.deleteMany({ where: { id: atual.recompensaId, metas: { none: {} } } });
    return true;
  });
}

export async function excluirMeta(id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const atual = await tx.meta.findUnique({ where: { id }, select: { recompensaId: true } });
    if (!atual) return false;
    await tx.meta.delete({ where: { id } });
    if (atual.recompensaId) await tx.recompensa.deleteMany({ where: { id: atual.recompensaId, metas: { none: {} } } });
    return true;
  });
}

/** Cria as metas de exemplo SÓ se não existe nenhuma meta (não duplica nem mistura). */
export async function criarMetasDeExemplo(agora: Date, metaAnualBase: number): Promise<{ criadas: number }> {
  return db.$transaction(async (tx) => {
    if ((await tx.meta.count()) > 0) return { criadas: 0 };
    const exemplos = metasDeExemplo(agora, metaAnualBase);
    for (const v of exemplos) {
      await tx.meta.create({
        data: { periodo: v.periodo, indicador: v.indicador, inicio: v.inicio, fim: v.fim, meta: v.meta, supermeta: v.supermeta, exemplo: true },
      });
    }
    return { criadas: exemplos.length };
  });
}

/** Meta anual (máquinas) do ano. Recurso desligado, tabela ausente ou banco fora do
 *  ar = o número de Parâmetros, como sempre foi. Nunca derruba quem chama. */
export async function metaAnualDoAno(ano: number, fallbackParametros: number): Promise<{ valor: number; origem: "metas" | "parametros" }> {
  const padrao = { valor: fallbackParametros, origem: "parametros" as const };
  try {
    if (!(await metasRecursoLigado())) return padrao;
    const inicio = meiaNoiteBR(ano, 0, 1);
    const fim = meiaNoiteBR(ano + 1, 0, 1);
    const metas = await db.meta.findMany({
      where: { periodo: "anual", indicador: "maquinas_faturadas", inicio, fim },
      select: { periodo: true, indicador: true, inicio: true, fim: true, meta: true, criadoEm: true },
      take: 20,
    });
    return metaAnualEfetiva(ano, metas, fallbackParametros);
  } catch {
    return padrao;
  }
}

export function anoDeHoje(agora: Date = new Date()): number {
  return diaBR(agora).a;
}
