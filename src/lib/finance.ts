// Cálculos de financiamento e consórcio para máquinas pesadas.

export interface ResultadoFinanciamento {
  valorFinanciado: number;
  parcela: number;
  totalPago: number;
  totalJuros: number;
}

// Tabela Price (parcelas fixas). taxaMensal em % (ex.: 1.2 = 1,2% a.m.).
export function calcularFinanciamento(
  valor: number,
  entrada: number,
  taxaMensalPct: number,
  parcelas: number
): ResultadoFinanciamento {
  const principal = Math.max(0, valor - entrada);
  const i = taxaMensalPct / 100;
  const n = Math.max(1, Math.round(parcelas));
  let parcela: number;
  if (i === 0) {
    parcela = principal / n;
  } else {
    parcela = (principal * i) / (1 - Math.pow(1 + i, -n));
  }
  const totalPago = parcela * n;
  return {
    valorFinanciado: principal,
    parcela,
    totalPago,
    totalJuros: totalPago - principal,
  };
}

export interface ResultadoConsorcio {
  parcela: number;
  total: number;
  taxaTotal: number;
}

// Consórcio: parcela = (crédito + taxa adм + fundo) / prazo.
export function calcularConsorcio(
  credito: number,
  prazoMeses: number,
  taxaAdmPct: number,
  fundoReservaPct = 0
): ResultadoConsorcio {
  const n = Math.max(1, Math.round(prazoMeses));
  const taxaTotal = credito * ((taxaAdmPct + fundoReservaPct) / 100);
  const total = credito + taxaTotal;
  return { parcela: total / n, total, taxaTotal };
}

// Linhas de crédito comuns para máquinas agrícolas (taxas de referência, editáveis).
export const LINHAS_CREDITO = [
  { nome: "Moderfrota", taxaAnual: 10.5, descricao: "Linha BNDES para tratores e colheitadeiras." },
  { nome: "Finame Baixo Carbono", taxaAnual: 12.5, descricao: "Financiamento de máquinas novas." },
  { nome: "Pronaf Mais Alimentos", taxaAnual: 6.0, descricao: "Para agricultor familiar." },
  { nome: "CDC / Banco (livre)", taxaAnual: 22.0, descricao: "Crédito direto, aprovação rápida." },
];

export function anualParaMensal(taxaAnualPct: number): number {
  return (Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1) * 100;
}
