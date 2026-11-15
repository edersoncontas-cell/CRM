// Relatório sob demanda — regras PURAS (sem banco): quais relatórios existem,
// como "este mês" vira datas (sempre em horário de Brasília) e como um pedido
// é validado. Usado pela rota, pela ferramenta do agente e pelos testes.
//
// O que NÃO entra aqui: consulta ao banco (relatorio-pedido.ts) e a geração do
// arquivo (relatorio-pedido-arquivo.ts).

export const TIPOS_RELATORIO = ["vendas", "funil", "visitas", "parados", "sem_resposta"] as const;
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number];

export const ROTULO_TIPO: Record<TipoRelatorio, string> = {
  vendas: "Vendas fechadas",
  funil: "Funil de negociações",
  visitas: "Visitas",
  parados: "Negociações paradas",
  sem_resposta: "Conversas aguardando resposta",
};

// Quais tipos dependem do período. Funil, parados e sem resposta são um retrato
// de AGORA — pedir "do mês passado" para eles enganaria.
export const TIPOS_COM_PERIODO: readonly TipoRelatorio[] = ["vendas", "visitas"];

export const PERIODOS = ["hoje", "semana", "mes", "mes_passado", "trimestre", "ano", "ultimos_30_dias"] as const;
export type PeriodoNome = (typeof PERIODOS)[number];

export const FORMATOS = ["pdf", "xlsx"] as const;
export type FormatoRelatorio = (typeof FORMATOS)[number];

export const LIMITES_RELATORIO = {
  diasMaximosDoIntervalo: 366,
  diasParadoPadrao: 10,
  diasParadoMax: 365,
  linhasNoArquivo: 1000, // acima disso o arquivo avisa que foi cortado
} as const;

export type Periodo = { de: Date; ate: Date; rotulo: string }; // [de, ate)

export type Validado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export type Pedido = {
  tipo: TipoRelatorio;
  formato: FormatoRelatorio;
  periodo: Periodo | null;     // null nos retratos de agora
  diasParado: number;          // só vale em "parados"
};

const DIA = 24 * 60 * 60 * 1000;
const BRT = 3 * 60 * 60 * 1000; // Brasília = UTC−3 o ano todo

// Dia civil de Brasília de um instante: devolve ano/mês(0-11)/dia.
function diaBR(d: Date): { a: number; m: number; d: number } {
  const x = new Date(d.getTime() - BRT);
  return { a: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() };
}

// 00:00 de Brasília do dia civil dado, como instante UTC. Aceita mês/dia fora
// da faixa (Date.UTC normaliza: mês 12 vira janeiro do ano seguinte).
function meiaNoiteBR(a: number, m: number, d: number): Date {
  return new Date(Date.UTC(a, m, d) + BRT);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function fmtDiaBR(d: Date): string {
  const x = diaBR(d);
  return `${String(x.d).padStart(2, "0")}/${String(x.m + 1).padStart(2, "0")}/${x.a}`;
}

/** "este mês", "a semana"… viram datas. `agora` é injetado para o teste. */
export function resolverPeriodo(nome: PeriodoNome, agora: Date = new Date()): Periodo {
  const { a, m, d } = diaBR(agora);
  switch (nome) {
    case "hoje":
      return { de: meiaNoiteBR(a, m, d), ate: meiaNoiteBR(a, m, d + 1), rotulo: `Hoje, ${fmtDiaBR(agora)}` };
    case "semana": {
      // Semana de segunda a domingo (a do vendedor começa na segunda).
      const dow = new Date(Date.UTC(a, m, d)).getUTCDay(); // 0 = domingo
      const voltar = (dow + 6) % 7;
      const de = meiaNoiteBR(a, m, d - voltar);
      const ate = meiaNoiteBR(a, m, d - voltar + 7);
      return { de, ate, rotulo: `Semana de ${fmtDiaBR(de)} a ${fmtDiaBR(new Date(ate.getTime() - DIA))}` };
    }
    case "mes":
      return { de: meiaNoiteBR(a, m, 1), ate: meiaNoiteBR(a, m + 1, 1), rotulo: `${MESES[m]} de ${a}` };
    case "mes_passado": {
      const de = meiaNoiteBR(a, m - 1, 1);
      const { a: ap, m: mp } = diaBR(new Date(de.getTime() + 12 * 60 * 60 * 1000));
      return { de, ate: meiaNoiteBR(a, m, 1), rotulo: `${MESES[mp]} de ${ap}` };
    }
    case "trimestre": {
      const ini = Math.floor(m / 3) * 3;
      return { de: meiaNoiteBR(a, ini, 1), ate: meiaNoiteBR(a, ini + 3, 1), rotulo: `${Math.floor(m / 3) + 1}º trimestre de ${a}` };
    }
    case "ano":
      return { de: meiaNoiteBR(a, 0, 1), ate: meiaNoiteBR(a + 1, 0, 1), rotulo: `Ano de ${a}` };
    case "ultimos_30_dias": {
      const ate = meiaNoiteBR(a, m, d + 1);
      const de = meiaNoiteBR(a, m, d - 29);
      return { de, ate, rotulo: `Últimos 30 dias (${fmtDiaBR(de)} a ${fmtDiaBR(agora)})` };
    }
  }
}

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-05" → 00:00 de Brasília desse dia. Data inexistente (2026-02-31) é recusada. */
export function diaIsoParaInstante(iso: unknown): Date | null {
  if (typeof iso !== "string") return null;
  const m = RE_DATA.exec(iso.trim());
  if (!m) return null;
  const a = Number(m[1]), mes = Number(m[2]) - 1, d = Number(m[3]);
  const conferir = new Date(Date.UTC(a, mes, d));
  if (conferir.getUTCFullYear() !== a || conferir.getUTCMonth() !== mes || conferir.getUTCDate() !== d) return null;
  if (a < 2000 || a > 2100) return null;
  return meiaNoiteBR(a, mes, d);
}

export function validarPedido(e: Record<string, unknown>, agora: Date = new Date()): Validado<Pedido> {
  const tipo = e.tipo;
  if (typeof tipo !== "string" || !(TIPOS_RELATORIO as readonly string[]).includes(tipo)) {
    return { ok: false, erro: `Tipo de relatório inválido. Use um destes: ${TIPOS_RELATORIO.join(", ")}.` };
  }
  const t = tipo as TipoRelatorio;

  const formato = e.formato == null || e.formato === "" ? "pdf" : e.formato;
  if (typeof formato !== "string" || !(FORMATOS as readonly string[]).includes(formato)) {
    return { ok: false, erro: `Formato inválido. Use pdf ou xlsx.` };
  }

  let diasParado: number = LIMITES_RELATORIO.diasParadoPadrao;
  if (e.dias != null && e.dias !== "") {
    const n = Number(e.dias);
    if (!Number.isInteger(n) || n < 1 || n > LIMITES_RELATORIO.diasParadoMax) {
      return { ok: false, erro: `"dias" precisa ser um número inteiro de 1 a ${LIMITES_RELATORIO.diasParadoMax}.` };
    }
    diasParado = n;
  }

  if (!TIPOS_COM_PERIODO.includes(t)) {
    return { ok: true, valor: { tipo: t, formato: formato as FormatoRelatorio, periodo: null, diasParado } };
  }

  // Intervalo escolhido (de/ate) vence o nome do período.
  if (e.de != null && e.de !== "" || e.ate != null && e.ate !== "") {
    const de = diaIsoParaInstante(e.de);
    const ateDia = diaIsoParaInstante(e.ate);
    if (!de || !ateDia) return { ok: false, erro: "Datas inválidas. Use AAAA-MM-DD em \"de\" e \"ate\" (as duas)." };
    if (ateDia < de) return { ok: false, erro: "A data final vem antes da inicial." };
    const ate = new Date(ateDia.getTime() + DIA);
    if ((ate.getTime() - de.getTime()) / DIA > LIMITES_RELATORIO.diasMaximosDoIntervalo) {
      return { ok: false, erro: `Intervalo grande demais (máximo ${LIMITES_RELATORIO.diasMaximosDoIntervalo} dias).` };
    }
    return {
      ok: true,
      valor: { tipo: t, formato: formato as FormatoRelatorio, periodo: { de, ate, rotulo: `${fmtDiaBR(de)} a ${fmtDiaBR(ateDia)}` }, diasParado },
    };
  }

  const nome = e.periodo == null || e.periodo === "" ? "mes" : e.periodo;
  if (typeof nome !== "string" || !(PERIODOS as readonly string[]).includes(nome)) {
    return { ok: false, erro: `Período inválido. Use um destes: ${PERIODOS.join(", ")} (ou de/ate em AAAA-MM-DD).` };
  }
  return { ok: true, valor: { tipo: t, formato: formato as FormatoRelatorio, periodo: resolverPeriodo(nome as PeriodoNome, agora), diasParado } };
}

/** Mesmo pedido como querystring — só caracteres seguros, para virar link no chat. */
export function linkDoPedido(p: Pedido, entrada: Record<string, unknown>): string {
  const q = new URLSearchParams();
  q.set("tipo", p.tipo);
  q.set("formato", p.formato);
  if (p.periodo) {
    if (entrada.de && entrada.ate) {
      q.set("de", String(entrada.de).trim());
      q.set("ate", String(entrada.ate).trim());
    } else {
      q.set("periodo", entrada.periodo == null || entrada.periodo === "" ? "mes" : String(entrada.periodo));
    }
  }
  if (p.tipo === "parados") q.set("dias", String(p.diasParado));
  return `/api/relatorios?${q.toString()}`;
}

// ── O que um relatório pronto carrega (a rota e os arquivos só leem isto) ──

export type RelatorioPronto = {
  tipo: TipoRelatorio;
  titulo: string;
  subtitulo: string;                       // período ou "retrato de agora"
  resumo: { rotulo: string; valor: string }[];
  colunas: string[];
  linhas: string[][];
  cortado: boolean;                        // havia mais linhas que o limite do arquivo
  aviso?: string;
};

export function nomeDoArquivo(r: Pick<RelatorioPronto, "tipo">, formato: FormatoRelatorio, agora: Date = new Date()): string {
  const x = diaBR(agora);
  const dia = `${x.a}-${String(x.m + 1).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;
  return `relatorio-${r.tipo.replace("_", "-")}-${dia}.${formato}`;
}
