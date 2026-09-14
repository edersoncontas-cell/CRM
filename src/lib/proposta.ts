// Proposta comercial de uma página + calculadora de custo por hora / TCO.
// Tipos e cálculo puro (sem banco) — usados no cliente (formulário) e no
// servidor (PDF, envio). O formato segue o que a Academia ensina (módulo 6):
// situação do cliente → solução → retorno em reais → condição → prova → validade.

export type MaquinaCalc = {
  rotulo: string;          // "Retro 2011 (atual)", "B95C nova", "Concorrente X"
  valor: number;           // aquisição (0 para a atual)
  parcelaMes: number;      // parcela mensal (0 se não financiada)
  consumoLh: number;       // litros por hora
  manutencaoMes: number;   // R$/mês
  diasParadosMes: number;  // dias parados por mês
  revendaPct: number;      // % do valor recuperado ao fim do horizonte (0-100)
};

export type CalcProposta = {
  horasMes: number;        // horas trabalhadas por mês
  dieselLitro: number;     // R$/L
  diariaCobertura: number; // R$ por dia parado (aluguel para cobrir + operador parado + atraso)
  diariaAluguel: number;   // R$/dia de aluguel de máquina equivalente (comparação aluguel x parcela)
  diasAluguelMes: number;  // dias/mês que alugaria
  horizonteAnos: number;   // para o TCO
  atual: MaquinaCalc;
  nova: MaquinaCalc;
  concorrente: MaquinaCalc | null;
};

export type CondicaoProposta = {
  valor: number;
  entradaValor: number;
  usadaDescricao: string;  // "Retro Case 580 2012 avaliada em R$ 95 mil"
  instrumento: string;     // "Finame", "Consórcio", "CDC", "Crédito rural", "À vista"
  parcelas: number;
  parcelaValor: number;
  carenciaDias: number;
  entregaDias: number;
  garantiaMeses: number;
  inclusos: string;        // "Treinamento do operador, primeira revisão"
};

export type DadosProposta = {
  titulo: string;
  situacaoAtual: string;
  solucao: string;
  retorno: string;
  condicao: CondicaoProposta;
  prova: string;
  validade: string;        // YYYY-MM-DD
  proximoPasso: string;
  calc: CalcProposta;
};

export type ResultadoMaquina = {
  rotulo: string;
  custoMensalOperacional: number; // diesel + manutenção + paradas (sem parcela)
  custoMensalTotal: number;       // + parcela
  horasEfetivas: number;
  custoHora: number;              // total / horas efetivas
  tcoTotal: number;               // horizonte inteiro
  tcoHora: number;
};

export type ResultadoCalc = {
  atual: ResultadoMaquina;
  nova: ResultadoMaquina;
  concorrente: ResultadoMaquina | null;
  economiaOperacionalMes: number;  // atual.op - nova.op
  diferencaTotalMes: number;       // nova.total - atual.total (negativo = nova custa menos mesmo com parcela)
  paybackMeses: number | null;     // entrada equivalente: valor da nova / economia operacional
  aluguelMes: number;
  aluguelAno: number;
  parcelaAno: number;
  patrimonioAoFim: number;         // valor × revenda% ao fim do horizonte
  tcoDiferencaConcorrente: number | null; // concorrente.tco - nova.tco (positivo = nova mais barata)
};

const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function calcularMaquina(m: MaquinaCalc, c: CalcProposta): ResultadoMaquina {
  const horasEfetivas = Math.max(1, c.horasMes - n(m.diasParadosMes) * 8);
  const diesel = n(m.consumoLh) * c.horasMes * c.dieselLitro;
  const paradas = n(m.diasParadosMes) * c.diariaCobertura;
  const custoMensalOperacional = diesel + n(m.manutencaoMes) + paradas;
  const custoMensalTotal = custoMensalOperacional + n(m.parcelaMes);
  const meses = Math.max(1, Math.round(c.horizonteAnos * 12));
  const tcoTotal = n(m.valor) + custoMensalOperacional * meses - n(m.valor) * (n(m.revendaPct) / 100);
  const horasHorizonte = Math.max(1, horasEfetivas * meses);
  return {
    rotulo: m.rotulo,
    custoMensalOperacional,
    custoMensalTotal,
    horasEfetivas,
    custoHora: custoMensalTotal / horasEfetivas,
    tcoTotal,
    tcoHora: tcoTotal / horasHorizonte,
  };
}

export function calcular(c: CalcProposta): ResultadoCalc {
  const atual = calcularMaquina(c.atual, c);
  const nova = calcularMaquina(c.nova, c);
  const concorrente = c.concorrente ? calcularMaquina(c.concorrente, c) : null;
  const economiaOperacionalMes = atual.custoMensalOperacional - nova.custoMensalOperacional;
  const meses = Math.max(1, Math.round(c.horizonteAnos * 12));
  return {
    atual, nova, concorrente,
    economiaOperacionalMes,
    diferencaTotalMes: nova.custoMensalTotal - atual.custoMensalTotal,
    paybackMeses: economiaOperacionalMes > 0 && c.nova.valor > 0 ? Math.ceil(c.nova.valor / economiaOperacionalMes) : null,
    aluguelMes: c.diariaAluguel * c.diasAluguelMes,
    aluguelAno: c.diariaAluguel * c.diasAluguelMes * 12,
    parcelaAno: c.nova.parcelaMes * 12,
    patrimonioAoFim: c.nova.valor * (n(c.nova.revendaPct) / 100),
    tcoDiferencaConcorrente: concorrente ? concorrente.tcoTotal - nova.tcoTotal : null,
    ...(meses ? {} : {}),
  };
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const brl2 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

// Texto do bloco "Retorno em reais" gerado a partir da calculadora — o
// vendedor pode editar depois.
export function textoRetorno(c: CalcProposta, r: ResultadoCalc): string {
  const linhas: string[] = [];
  linhas.push(`Custo por hora hoje (${c.atual.rotulo}): ${brl2(r.atual.custoHora)} · com a ${c.nova.rotulo}: ${brl2(r.nova.custoHora)} (já com a parcela).`);
  if (r.economiaOperacionalMes > 0) {
    linhas.push(`Economia operacional (diesel + manutenção + paradas): ${brl(r.economiaOperacionalMes)} por mês, ${brl(r.economiaOperacionalMes * 12)} por ano.`);
  }
  if (r.diferencaTotalMes <= 0) {
    linhas.push(`Mesmo com a parcela de ${brl(c.nova.parcelaMes)}, a máquina nova custa ${brl(-r.diferencaTotalMes)} a menos por mês do que manter a atual.`);
  } else {
    linhas.push(`A parcela de ${brl(c.nova.parcelaMes)} fica ${brl(r.diferencaTotalMes)} acima do custo atual por mês — e ao fim de ${c.horizonteAnos} anos a máquina ainda vale cerca de ${brl(r.patrimonioAoFim)}.`);
  }
  if (r.paybackMeses) linhas.push(`Só com a economia operacional, o investimento se paga em cerca de ${r.paybackMeses} meses.`);
  if (c.diariaAluguel > 0 && c.diasAluguelMes > 0) {
    linhas.push(`Aluguel equivalente: ${brl(r.aluguelMes)} por mês (${brl(r.aluguelAno)} por ano) sem ficar com nada; a parcela soma ${brl(r.parcelaAno)} por ano e a máquina é sua.`);
  }
  if (r.concorrente && r.tcoDiferencaConcorrente != null) {
    linhas.push(`Custo total em ${c.horizonteAnos} anos: ${c.nova.rotulo} ${brl(r.nova.tcoTotal)} × ${r.concorrente.rotulo} ${brl(r.concorrente.tcoTotal)} (${r.tcoDiferencaConcorrente >= 0 ? "diferença a favor da nossa" : "diferença contra"}: ${brl(Math.abs(r.tcoDiferencaConcorrente))}).`);
  }
  return linhas.join("\n");
}

export function calcPadrao(): CalcProposta {
  return {
    horasMes: 150, dieselLitro: 6, diariaCobertura: 1500, diariaAluguel: 0, diasAluguelMes: 0, horizonteAnos: 5,
    atual: { rotulo: "Máquina atual", valor: 0, parcelaMes: 0, consumoLh: 6.5, manutencaoMes: 3000, diasParadosMes: 3, revendaPct: 0 },
    nova: { rotulo: "Máquina nova", valor: 0, parcelaMes: 0, consumoLh: 5, manutencaoMes: 800, diasParadosMes: 0.5, revendaPct: 55 },
    concorrente: null,
  };
}

// Normaliza o JSON gravado (campos podem faltar em versões antigas).
export function normalizarDados(raw: unknown, base: DadosProposta): DadosProposta {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<DadosProposta>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const maq = (v: unknown, d: MaquinaCalc): MaquinaCalc => {
    if (!v || typeof v !== "object") return d;
    const m = v as Partial<MaquinaCalc>;
    return { rotulo: str(m.rotulo, d.rotulo), valor: num(m.valor, d.valor), parcelaMes: num(m.parcelaMes, d.parcelaMes), consumoLh: num(m.consumoLh, d.consumoLh), manutencaoMes: num(m.manutencaoMes, d.manutencaoMes), diasParadosMes: num(m.diasParadosMes, d.diasParadosMes), revendaPct: num(m.revendaPct, d.revendaPct) };
  };
  const c = (r.calc ?? {}) as Partial<CalcProposta>;
  const cond = (r.condicao ?? {}) as Partial<CondicaoProposta>;
  return {
    titulo: str(r.titulo, base.titulo),
    situacaoAtual: str(r.situacaoAtual, base.situacaoAtual),
    solucao: str(r.solucao, base.solucao),
    retorno: str(r.retorno, base.retorno),
    prova: str(r.prova, base.prova),
    validade: str(r.validade, base.validade),
    proximoPasso: str(r.proximoPasso, base.proximoPasso),
    condicao: {
      valor: num(cond.valor, base.condicao.valor), entradaValor: num(cond.entradaValor, base.condicao.entradaValor),
      usadaDescricao: str(cond.usadaDescricao, base.condicao.usadaDescricao), instrumento: str(cond.instrumento, base.condicao.instrumento),
      parcelas: num(cond.parcelas, base.condicao.parcelas), parcelaValor: num(cond.parcelaValor, base.condicao.parcelaValor),
      carenciaDias: num(cond.carenciaDias, base.condicao.carenciaDias), entregaDias: num(cond.entregaDias, base.condicao.entregaDias),
      garantiaMeses: num(cond.garantiaMeses, base.condicao.garantiaMeses), inclusos: str(cond.inclusos, base.condicao.inclusos),
    },
    calc: {
      horasMes: num(c.horasMes, base.calc.horasMes), dieselLitro: num(c.dieselLitro, base.calc.dieselLitro),
      diariaCobertura: num(c.diariaCobertura, base.calc.diariaCobertura), diariaAluguel: num(c.diariaAluguel, base.calc.diariaAluguel),
      diasAluguelMes: num(c.diasAluguelMes, base.calc.diasAluguelMes), horizonteAnos: num(c.horizonteAnos, base.calc.horizonteAnos),
      atual: maq(c.atual, base.calc.atual), nova: maq(c.nova, base.calc.nova),
      concorrente: c.concorrente ? maq(c.concorrente, { rotulo: "Concorrente", valor: 0, parcelaMes: 0, consumoLh: 0, manutencaoMes: 0, diasParadosMes: 0, revendaPct: 30 }) : null,
    },
  };
}
