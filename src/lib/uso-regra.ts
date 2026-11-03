// RELATÓRIO DE USO (03/11) — a regra, pura (sem banco, sem React).
//
//   "preciso de dados pra entender o que está funcionando e o que não está,
//    pra ver se tais sessões precisam mesmo, ou o que eu posso melhorar"
//
// Quem usa:
//   · components/RegistroDeUso.tsx (navegador) — conta as aberturas e o tempo;
//   · app/api/uso/route.ts — confere o que chegou antes de somar no banco;
//   · app/(app)/relatorio/page.tsx — resume e sugere.
//
// O que é contado, e só isso:
//   · ABERTURA: cada vez que uma tela do CRM aparece (troca de endereço).
//   · TEMPO: segundos com a tela à vista (aba escondida ou celular bloqueado
//     não conta) e com ele mexendo — 5 min sem toque, tecla ou rolagem, o
//     relógio para. CRM esquecido aberto na mesa não vira "6 h no Dashboard".
//   · ENTRADA: voltar ao CRM depois de 30 min sem ele na tela (ou parado
//     nele). É o "quantas vezes entrei no dia".
// Nada de conteúdo: só o endereço da tela, a hora e se é PC ou celular.

export const TELA_ENTRADA = "(entrada)";
export const PAUSA_NOVA_ENTRADA_MS = 30 * 60 * 1000;
export const APARELHOS = ["pc", "celular"] as const;
export type Aparelho = (typeof APARELHOS)[number];

/** Itens por envio e janela aceita (o aparelho pode guardar dias sem sinal). */
export const MAX_ITENS_ENVIO = 200;
export const DIAS_ACEITOS_ATRAS = 35;

/**
 * Uma linha da contagem. aberturas e segundos são o TOTAL da linha naquele
 * dispositivo (não o que mudou desde o último envio): o banco guarda o maior,
 * então reenviar é inofensivo e o que não chegou vai na próxima vez.
 */
export type ItemUso = { dia: string; hora: number; tela: string; aparelho: Aparelho; dispositivo: string; aberturas: number; segundos: number };

/** Identificador sorteado do navegador (não identifica pessoa nem aparelho de fato). */
export const RE_DISPOSITIVO = /^[a-z0-9]{8,24}$/;

const BRASILIA_MS = -3 * 60 * 60 * 1000; // UTC−3 o ano todo (sem horário de verão desde 2019)

/** Dia (AAAA-MM-DD) e hora (0–23) de Brasília de um instante. */
export function diaHoraBrasilia(ms: number): { dia: string; hora: number } {
  const d = new Date(ms + BRASILIA_MS);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}

/** Soma dias a um AAAA-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana do dia (a semana do CRM começa na segunda). */
export function segundaDaSemana(dia: string): string {
  const dow = new Date(`${dia}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(dia, -((dow + 6) % 7));
}

/**
 * A tela que conta para um endereço: o item do menu mais específico que o
 * contém ("/clientes/abc" → "/clientes"; "/maquinas/fichas/x" →
 * "/maquinas/fichas"). Fora do menu, o primeiro pedaço do endereço. null para
 * o que não é tela do CRM.
 */
export function telaDoCaminho(caminho: string, hrefs: readonly string[]): string | null {
  if (typeof caminho !== "string" || !caminho.startsWith("/")) return null;
  const limpo = caminho.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  if (!limpo) return null;
  const doMenu = hrefs.filter((h) => limpo === h || limpo.startsWith(`${h}/`));
  if (doMenu.length) return doMenu.reduce((a, b) => (b.length > a.length ? b : a));
  const primeiro = limpo.split("/")[1];
  if (!primeiro || ["login", "api", "_next", "config-necessaria"].includes(primeiro)) return null;
  return `/${primeiro}`;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_TELA = /^\/[a-z0-9-]{1,40}(\/[a-z0-9-]{1,40})?$/;

/**
 * Confere o que o navegador mandou. Item estranho é descartado (não derruba
 * o resto): o pior que um pedido torto consegue é não ser contado. Linha
 * repetida no mesmo envio: fica a maior (são totais, não acréscimos).
 */
export function limparItens(corpo: unknown, hojeBrasilia: string): ItemUso[] {
  const lista = (corpo as { itens?: unknown })?.itens;
  if (!Array.isArray(lista)) return [];
  const minimo = somarDias(hojeBrasilia, -DIAS_ACEITOS_ATRAS);
  const maximo = somarDias(hojeBrasilia, 1); // relógio do celular um pouco adiantado
  const juntos = new Map<string, ItemUso>();
  for (const bruto of lista.slice(0, MAX_ITENS_ENVIO)) {
    const i = bruto as Partial<ItemUso>;
    if (typeof i?.dia !== "string" || !RE_DIA.test(i.dia) || i.dia < minimo || i.dia > maximo) continue;
    if (!Number.isInteger(i.hora) || (i.hora as number) < 0 || (i.hora as number) > 23) continue;
    if (typeof i.tela !== "string" || (i.tela !== TELA_ENTRADA && !RE_TELA.test(i.tela))) continue;
    if (!APARELHOS.includes(i.aparelho as Aparelho)) continue;
    if (typeof i.dispositivo !== "string" || !RE_DISPOSITIVO.test(i.dispositivo)) continue;
    const aberturas = Number.isFinite(i.aberturas) ? Math.max(0, Math.min(500, Math.floor(i.aberturas as number))) : 0;
    // Uma linha é uma HORA de um dispositivo: mais de 3.600 s nela é impossível.
    const segundos = Number.isFinite(i.segundos) ? Math.max(0, Math.min(3_600, Math.floor(i.segundos as number))) : 0;
    if (!aberturas && !segundos) continue;
    const k = chaveItem(i as ItemUso);
    const ja = juntos.get(k);
    if (ja) { ja.aberturas = Math.max(ja.aberturas, aberturas); ja.segundos = Math.max(ja.segundos, segundos); }
    else juntos.set(k, { dia: i.dia, hora: i.hora as number, tela: i.tela, aparelho: i.aparelho as Aparelho, dispositivo: i.dispositivo, aberturas, segundos });
  }
  return [...juntos.values()];
}

export function chaveItem(i: Pick<ItemUso, "dia" | "hora" | "tela" | "aparelho"> & { dispositivo?: string }): string {
  return `${i.dia}|${i.hora}|${i.tela}|${i.aparelho}|${i.dispositivo ?? ""}`;
}

// ── O resumo da tela ────────────────────────────────────────────────────────

export type ItemDoMenu = { href: string; label: string; fixo?: boolean };

export type UsoDaTela = {
  href: string;
  label: string;
  noMenu: boolean;
  fixo: boolean;
  aberturas30: number;
  segundos30: number;
  dias30: number;          // em quantos dias diferentes abriu (30 dias)
  mediaSeg: number;        // segundos por abertura (30 dias)
  ultimoUso: string | null; // AAAA-MM-DD, em toda a contagem
};

export type ResumoUso = {
  hoje: string;
  inicioContagem: string | null;
  diasDeDados: number;      // de inicioContagem até hoje, contando os dois
  entradas: { hoje: number; semana: number; mes: number };
  tempo: { hoje: number; semana: number; mes: number }; // segundos
  diasComUsoSemana: number;
  aparelho30: Record<Aparelho, { aberturas: number; segundos: number }>;
  porHora30: number[];      // aberturas por hora do dia (0–23)
  ultimos14: { dia: string; entradas: number; segundos: number }[];
  telas: UsoDaTela[];       // as do menu (mesmo zeradas) + as de fora com uso
};

type Linha = Omit<ItemUso, "aparelho" | "dispositivo"> & { aparelho: string };

/**
 * `inicio`: o primeiro dia da contagem inteira, quando as linhas vêm só de uma
 * janela recente (a tela lê 60 dias; o começo vem de um MIN à parte).
 */
export function resumirUso(linhas: Linha[], hoje: string, menu: ItemDoMenu[], inicio?: string | null): ResumoUso {
  const segunda = segundaDaSemana(hoje);
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
  const desde30 = somarDias(hoje, -29);
  const desde14 = somarDias(hoje, -13);

  let inicioContagem: string | null = null;
  const entradas = { hoje: 0, semana: 0, mes: 0 };
  const tempo = { hoje: 0, semana: 0, mes: 0 };
  const diasSemana = new Set<string>();
  const aparelho30: ResumoUso["aparelho30"] = { pc: { aberturas: 0, segundos: 0 }, celular: { aberturas: 0, segundos: 0 } };
  const porHora30 = new Array(24).fill(0);
  const ultimos = new Map<string, { entradas: number; segundos: number }>();
  for (let i = 0; i < 14; i++) ultimos.set(somarDias(desde14, i), { entradas: 0, segundos: 0 });
  const porTela = new Map<string, { aberturas30: number; segundos30: number; dias30: Set<string>; ultimoUso: string | null }>();

  for (const l of linhas) {
    if (l.dia > hoje) continue;
    if (!inicioContagem || l.dia < inicioContagem) inicioContagem = l.dia;
    const entrada = l.tela === TELA_ENTRADA;
    const u = ultimos.get(l.dia);
    if (entrada) {
      if (l.dia === hoje) entradas.hoje += l.aberturas;
      if (l.dia >= segunda) { entradas.semana += l.aberturas; if (l.aberturas > 0) diasSemana.add(l.dia); }
      if (l.dia >= primeiroDoMes) entradas.mes += l.aberturas;
      if (u) u.entradas += l.aberturas;
      continue;
    }
    if (l.dia === hoje) tempo.hoje += l.segundos;
    if (l.dia >= segunda) { tempo.semana += l.segundos; diasSemana.add(l.dia); }
    if (l.dia >= primeiroDoMes) tempo.mes += l.segundos;
    if (u) u.segundos += l.segundos;

    let t = porTela.get(l.tela);
    if (!t) { t = { aberturas30: 0, segundos30: 0, dias30: new Set(), ultimoUso: null }; porTela.set(l.tela, t); }
    if (!t.ultimoUso || l.dia > t.ultimoUso) t.ultimoUso = l.dia;
    if (l.dia >= desde30) {
      t.aberturas30 += l.aberturas;
      t.segundos30 += l.segundos;
      if (l.aberturas > 0) t.dias30.add(l.dia);
      porHora30[l.hora] += l.aberturas;
      const ap = (APARELHOS as readonly string[]).includes(l.aparelho) ? (l.aparelho as Aparelho) : "pc";
      aparelho30[ap].aberturas += l.aberturas;
      aparelho30[ap].segundos += l.segundos;
    }
  }

  const virar = (href: string, label: string, noMenu: boolean, fixo: boolean): UsoDaTela => {
    const t = porTela.get(href);
    const ab = t?.aberturas30 ?? 0, seg = t?.segundos30 ?? 0;
    return { href, label, noMenu, fixo, aberturas30: ab, segundos30: seg, dias30: t?.dias30.size ?? 0, mediaSeg: ab ? Math.round(seg / ab) : 0, ultimoUso: t?.ultimoUso ?? null };
  };
  const doMenu = new Set(menu.map((m) => m.href));
  const telas = [
    ...menu.map((m) => virar(m.href, m.label, true, !!m.fixo)),
    ...[...porTela.keys()].filter((h) => !doMenu.has(h)).map((h) => virar(h, h, false, false)),
  ].sort((a, b) => b.aberturas30 - a.aberturas30 || b.segundos30 - a.segundos30 || a.label.localeCompare(b.label, "pt-BR"));

  if (inicio && (!inicioContagem || inicio < inicioContagem)) inicioContagem = inicio;
  const diasDeDados = inicioContagem
    ? Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${inicioContagem}T12:00:00Z`)) / 86_400_000) + 1
    : 0;

  return {
    hoje, inicioContagem, diasDeDados, entradas, tempo,
    diasComUsoSemana: diasSemana.size,
    aparelho30, porHora30,
    ultimos14: [...ultimos.entries()].map(([dia, v]) => ({ dia, ...v })),
    telas,
  };
}

// ── Metas ───────────────────────────────────────────────────────────────────

export type Sinal = "verde" | "amarelo" | "vermelho";

/**
 * Sinal de uma meta no meio do período: compara com o que já era de esperar
 * até ontem (meta × fração do período que terminou), não com a meta cheia —
 * na quarta, com meta de 20 visitas, o esperado é 8 (seg + ter).
 */
export function sinalMeta(valor: number, meta: number, fracao: number): Sinal {
  if (meta <= 0 || valor >= meta) return "verde";
  const esperado = meta * Math.min(1, Math.max(0, fracao));
  if (valor >= esperado) return "verde";
  if (valor >= esperado * 0.6) return "amarelo";
  return "vermelho";
}

// As frações contam os dias que JÁ TERMINARAM (até ontem): na segunda de
// manhã ainda não há cobrança nenhuma, e o dia de hoje não pesa contra ele
// antes de acabar.

/** Quanto da semana útil (seg–sex) já terminou. Sábado e domingo: a semana inteira. */
export function fracaoSemanaUtil(hoje: string): number {
  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6 ? 1 : (dow - 1) / 5;
}

/** Quanto da semana (seg–dom) já terminou. */
export function fracaoSemana(hoje: string): number {
  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  return ((dow + 6) % 7) / 7;
}

/** Quanto do mês já terminou. */
export function fracaoMes(hoje: string): number {
  const [a, m, d] = hoje.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return (d - 1) / diasNoMes;
}

// ── O que melhorar ──────────────────────────────────────────────────────────

/** Antes disso, "não usou" é só "ainda não deu tempo". */
export const DIAS_MINIMOS_SUGESTAO = 7;

export type Sugestao = {
  tipo: "sair" | "pouco" | "rapido" | "meta" | "aviso";
  texto: string;
  href?: string;
  /** "sair": as telas paradas, uma lista só. */
  telas?: { href: string; label: string }[];
};

export type MetaParaSugestao = { rotulo: string; valor: number; meta: number; sinal: Sinal; href: string; dica: string };

export function sugerir(r: ResumoUso, metas: MetaParaSugestao[]): Sugestao[] {
  const s: Sugestao[] = [];
  for (const m of metas) {
    if (m.sinal === "vermelho") s.push({ tipo: "meta", href: m.href, texto: `${m.rotulo}: ${m.valor} de ${m.meta} — abaixo do ritmo. ${m.dica}` });
  }
  if (r.diasDeDados < DIAS_MINIMOS_SUGESTAO) {
    s.push({ tipo: "aviso", texto: `A contagem tem ${r.diasDeDados} dia(s). As sugestões de tela sem uso começam com ${DIAS_MINIMOS_SUGESTAO} dias de dados — antes disso, "não abriu" é só "ainda não deu tempo".` });
    return s;
  }
  const janela = Math.min(30, r.diasDeDados);
  // As paradas vão juntas numa sugestão só: a mesma frase repetida dez vezes
  // esconde as outras sugestões, que são mais raras e mais importantes.
  const paradas = r.telas.filter((t) => t.noMenu && t.aberturas30 === 0 && !t.fixo);
  if (paradas.length) {
    s.push({
      tipo: "sair",
      telas: paradas.map((t) => ({ href: t.href, label: t.label })),
      texto: `${paradas.length === 1 ? "Uma tela não abriu" : `${paradas.length} telas não abriram`} em ${janela} dias. Se não fazem falta, esconda do menu (Configurações → menu); se fazem e você não usa, diga o que falta nelas.`,
    });
  }
  for (const t of r.telas) {
    if (!t.noMenu || t.aberturas30 === 0) continue;
    if (t.aberturas30 <= 2 && r.diasDeDados >= 14) {
      s.push({ tipo: "pouco", href: t.href, texto: `${t.label}: só ${t.aberturas30} abertura(s) em ${janela} dias. Vale manter no menu?` });
    } else if (t.aberturas30 >= 5 && t.mediaSeg > 0 && t.mediaSeg < 8) {
      s.push({ tipo: "rapido", href: t.href, texto: `${t.label}: você abre e sai em ${t.mediaSeg} s, em média (${t.aberturas30} vezes). O que procura nela pode não estar à vista — diga o que é, que dá para trazer para cima.` });
    }
  }
  return s;
}

/** "1 h 05 min", "12 min", "40 s". */
export function duracaoPorExtenso(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), resto = min % 60;
  return resto ? `${h} h ${String(resto).padStart(2, "0")} min` : `${h} h`;
}
