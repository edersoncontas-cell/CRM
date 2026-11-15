// Metas e supermetas — regras PURAS (sem banco): o que é um período, como uma
// meta é validada, como o progresso é calculado e quais metas de exemplo existem.
// Banco em lib/metas-cadastro.ts. Desenho: docs/DESENHO-ADERENCIA.md, seção 6.

import { DIA_MS, diaBR, meiaNoiteBR, MESES_PT } from "@/lib/fuso-brasilia";
import { formatCurrency } from "@/lib/utils";

/** Só a palavra exata "ligado" liga (mesma regra da trava de envio e do suporte). */
export const CHAVE_RECURSO_METAS = "recurso.metas";

export const INDICADORES = ["maquinas_faturadas", "faturamento", "visitas", "negociacoes_novas"] as const;
export type Indicador = (typeof INDICADORES)[number];

export const ROTULO_INDICADOR: Record<Indicador, string> = {
  maquinas_faturadas: "Máquinas faturadas",
  faturamento: "Faturamento",
  visitas: "Visitas realizadas",
  negociacoes_novas: "Negociações novas",
};

export const PERIODOS_META = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;
export type PeriodoMeta = (typeof PERIODOS_META)[number];

export const MESES_DO_PERIODO: Record<PeriodoMeta, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
export const ROTULO_PERIODO: Record<PeriodoMeta, string> = {
  mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual",
};

export const LIMITES_META = {
  valorMax: 1_000_000_000,
  recompensaMax: 120,
  metasNaTela: 100,
} as const;

export type Validado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function metasLigado(valor: unknown): boolean {
  return valor === "ligado";
}

export function valorDoIndicador(i: Indicador, n: number): string {
  if (i === "faturamento") return formatCurrency(n);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

// ── Período ─────────────────────────────────────────────────────────────────

const RE_MES = /^(\d{4})-(\d{2})$/;

/** "2026-11" + período → [inicio, fim) em horário de Brasília. null se o mês for inválido. */
export function intervaloDoPeriodo(periodo: PeriodoMeta, mes: string): { inicio: Date; fim: Date } | null {
  const m = RE_MES.exec(String(mes ?? "").trim());
  if (!m) return null;
  const a = Number(m[1]), mm = Number(m[2]);
  if (a < 2000 || a > 2100 || mm < 1 || mm > 12) return null;
  return { inicio: meiaNoiteBR(a, mm - 1, 1), fim: meiaNoiteBR(a, mm - 1 + MESES_DO_PERIODO[periodo], 1) };
}

/** Primeiro mês do período "natural" que contém hoje (trimestre de jan/abr/jul/out…). */
export function mesInicialSugerido(periodo: PeriodoMeta, agora: Date = new Date()): string {
  const { a, m } = diaBR(agora);
  const n = MESES_DO_PERIODO[periodo];
  const ini = Math.floor(m / n) * n;
  return `${a}-${String(ini + 1).padStart(2, "0")}`;
}

export function rotuloDoIntervalo(inicio: Date, fim: Date): string {
  const i = diaBR(inicio);
  const f = diaBR(new Date(fim.getTime() - DIA_MS)); // fim é exclusivo
  const mes = (x: { a: number; m: number }) => `${MESES_PT[x.m].slice(0, 3)}/${x.a}`;
  return i.a === f.a && i.m === f.m ? `${MESES_PT[i.m]} de ${i.a}` : `${mes(i)} a ${mes(f)}`;
}

// ── Validação ───────────────────────────────────────────────────────────────

export type MetaEntrada = {
  periodo: PeriodoMeta;
  mes: string;                 // AAAA-MM do primeiro mês
  indicador: Indicador;
  meta: number;
  supermeta: number | null;
  recompensa: string;          // texto livre; vazio = sem recompensa
  valorRecompensa: number | null;
};

export type MetaValidada = MetaEntrada & { inicio: Date; fim: Date };

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function validarMeta(e: Record<string, unknown>): Validado<MetaValidada> {
  const periodo = e.periodo;
  if (typeof periodo !== "string" || !(PERIODOS_META as readonly string[]).includes(periodo)) {
    return { ok: false, erro: `Período inválido. Use: ${PERIODOS_META.join(", ")}.` };
  }
  const indicador = e.indicador;
  if (typeof indicador !== "string" || !(INDICADORES as readonly string[]).includes(indicador)) {
    return { ok: false, erro: "Escolha o que a meta mede (máquinas, faturamento, visitas ou negociações)." };
  }
  const intervalo = intervaloDoPeriodo(periodo as PeriodoMeta, String(e.mes ?? ""));
  if (!intervalo) return { ok: false, erro: "Escolha o mês em que a meta começa." };
  if (intervalo.fim <= intervalo.inicio) return { ok: false, erro: "O fim da meta tem que vir depois do início." };

  const meta = numero(e.meta);
  if (meta === null || Number.isNaN(meta)) return { ok: false, erro: "Escreva o número da meta." };
  if (meta <= 0) return { ok: false, erro: "A meta precisa ser maior que zero." };
  if (meta > LIMITES_META.valorMax) return { ok: false, erro: "Número da meta grande demais." };
  if ((indicador as Indicador) !== "faturamento" && !Number.isInteger(meta)) {
    return { ok: false, erro: "Para máquinas, visitas e negociações a meta é um número inteiro." };
  }

  const supermeta = numero(e.supermeta);
  if (Number.isNaN(supermeta)) return { ok: false, erro: "A supermeta não é um número válido." };
  if (supermeta !== null) {
    if (supermeta <= meta) return { ok: false, erro: "A supermeta precisa ser maior que a meta." };
    if (supermeta > LIMITES_META.valorMax) return { ok: false, erro: "Número da supermeta grande demais." };
    if ((indicador as Indicador) !== "faturamento" && !Number.isInteger(supermeta)) {
      return { ok: false, erro: "Para máquinas, visitas e negociações a supermeta é um número inteiro." };
    }
  }

  const recompensa = String(e.recompensa ?? "").trim();
  if (recompensa.length > LIMITES_META.recompensaMax) return { ok: false, erro: `A recompensa aceita até ${LIMITES_META.recompensaMax} letras.` };
  const valorRecompensa = numero(e.valorRecompensa);
  if (Number.isNaN(valorRecompensa) || (valorRecompensa !== null && (valorRecompensa < 0 || valorRecompensa > LIMITES_META.valorMax))) {
    return { ok: false, erro: "O valor da recompensa não é válido." };
  }

  return {
    ok: true,
    valor: {
      periodo: periodo as PeriodoMeta, mes: String(e.mes).trim(), indicador: indicador as Indicador,
      meta, supermeta, recompensa, valorRecompensa: recompensa ? valorRecompensa : null,
      inicio: intervalo.inicio, fim: intervalo.fim,
    },
  };
}

// ── Progresso ───────────────────────────────────────────────────────────────

export type FaseMeta = "futura" | "em_andamento" | "encerrada";
export type RitmoMeta = "adiantado" | "no_ritmo" | "atrasado";

export type ProgressoMeta = {
  atual: number;
  pct: number;                 // 0..∞ (passou de 100 = bateu)
  pctSupermeta: number | null;
  falta: number;               // até a meta (0 se bateu)
  faltaSupermeta: number | null;
  diasRestantes: number;       // 0 se encerrada
  fase: FaseMeta;
  bateu: boolean;
  bateuSupermeta: boolean;
  porSemanaNecessario: number | null; // só em andamento e ainda falta
  ritmo: RitmoMeta | null;     // só em andamento
};

export function calcularProgresso(
  m: { inicio: Date; fim: Date; meta: number; supermeta: number | null },
  atual: number,
  agora: Date = new Date(),
): ProgressoMeta {
  const t = agora.getTime();
  const fase: FaseMeta = t < m.inicio.getTime() ? "futura" : t >= m.fim.getTime() ? "encerrada" : "em_andamento";
  const bateu = atual >= m.meta;
  const bateuSupermeta = m.supermeta != null && atual >= m.supermeta;
  const diasRestantes = fase === "em_andamento" ? Math.max(1, Math.ceil((m.fim.getTime() - t) / DIA_MS)) : 0;
  const falta = Math.max(0, m.meta - atual);

  let ritmo: RitmoMeta | null = null;
  if (fase === "em_andamento") {
    const fracao = (t - m.inicio.getTime()) / (m.fim.getTime() - m.inicio.getTime());
    const esperado = m.meta * fracao;
    // Mesmos limites do ritmo anual (lib/metas.ts): +10% adiantado, −15% atrasado.
    ritmo = esperado < 1e-9 ? "no_ritmo" : atual >= esperado * 1.1 ? "adiantado" : atual <= esperado * 0.85 ? "atrasado" : "no_ritmo";
  }
  return {
    atual,
    pct: m.meta > 0 ? atual / m.meta : 0,
    pctSupermeta: m.supermeta ? atual / m.supermeta : null,
    falta,
    faltaSupermeta: m.supermeta != null ? Math.max(0, m.supermeta - atual) : null,
    diasRestantes,
    fase,
    bateu,
    bateuSupermeta,
    porSemanaNecessario: fase === "em_andamento" && falta > 0 ? falta / Math.max(1 / 7, diasRestantes / 7) : null,
    ritmo,
  };
}

// ── Metas de exemplo ────────────────────────────────────────────────────────

/** Mensal, trimestral, semestral e anual em máquinas faturadas, a partir da meta
 *  anual que o vendedor já tem em Parâmetros — para não perder o número dele. */
export function metasDeExemplo(agora: Date, metaAnualBase: number): MetaValidada[] {
  const anual = Math.max(1, Math.round(Number.isFinite(metaAnualBase) ? metaAnualBase : 1));
  const { a } = diaBR(agora);
  const plano: { periodo: PeriodoMeta; meta: number; mes: string }[] = [
    { periodo: "mensal", meta: Math.max(1, Math.ceil(anual / 12)), mes: mesInicialSugerido("mensal", agora) },
    { periodo: "trimestral", meta: Math.max(1, Math.ceil(anual / 4)), mes: mesInicialSugerido("trimestral", agora) },
    { periodo: "semestral", meta: Math.max(1, Math.ceil(anual / 2)), mes: mesInicialSugerido("semestral", agora) },
    { periodo: "anual", meta: anual, mes: `${a}-01` },
  ];
  return plano.map((p) => {
    const intervalo = intervaloDoPeriodo(p.periodo, p.mes)!;
    return {
      periodo: p.periodo, mes: p.mes, indicador: "maquinas_faturadas" as const,
      meta: p.meta, supermeta: Math.ceil(p.meta * 1.25) > p.meta ? Math.ceil(p.meta * 1.25) : p.meta + 1,
      recompensa: "", valorRecompensa: null, inicio: intervalo.inicio, fim: intervalo.fim,
    };
  });
}

/** Meta anual do ano pedido: a da tela de Metas (anual, máquinas faturadas, que
 *  cobre o ano inteiro) vence; sem ela vale a de Parâmetros. Quando há mais de
 *  uma, a criada por último. */
export function metaAnualEfetiva(
  ano: number,
  metas: { periodo: string; indicador: string; inicio: Date; fim: Date; meta: number; criadoEm: Date }[],
  fallbackParametros: number,
): { valor: number; origem: "metas" | "parametros" } {
  const ini = meiaNoiteBR(ano, 0, 1).getTime();
  const fim = meiaNoiteBR(ano + 1, 0, 1).getTime();
  const achadas = metas
    .filter((m) => m.periodo === "anual" && m.indicador === "maquinas_faturadas" && m.inicio.getTime() === ini && m.fim.getTime() === fim && m.meta > 0)
    .sort((x, y) => y.criadoEm.getTime() - x.criadoEm.getTime());
  return achadas.length ? { valor: achadas[0].meta, origem: "metas" } : { valor: fallbackParametros, origem: "parametros" };
}
