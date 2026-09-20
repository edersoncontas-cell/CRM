// Validação da data de faturamento.
//
// Por que existe: no seletor de ano do Dashboard aparecia um "20" ao lado de
// 2026 e 2025. Não era enfeite — era uma venda gravada com o ano 20 (uma data
// digitada como "0020-09-15"), que o seletor mostrava como um ano de verdade.
// Pior que o chip feio: aquela venda não entrava em 2026 nem em 2025, então
// sumia do faturamento, da contagem, da meta e do ticket médio.
//
// Aqui ficam as duas pontas: barrar a data impossível na entrada e não
// mostrar ano impossível no seletor.

// A janela precisa conter TUDO que o seletor de roda deixa escolher (ele vai
// de anoAtual-10 a anoAtual+4), senão o servidor recusaria uma data que a
// própria tela ofereceu. Larga de propósito: o objetivo aqui não é apertar o
// que ele digita, é barrar o absurdo — ano 20, ano 205, ano 1900.
const ANO_MIN = 2015;
const anoMax = () => new Date().getFullYear() + 5;

export function anoPlausivel(ano: number): boolean {
  return Number.isInteger(ano) && ano >= ANO_MIN && ano <= anoMax();
}

/** Anos que podem virar chip no seletor. Ano impossível não vira opção. */
export function anosParaSeletor(anos: number[]): number[] {
  return Array.from(new Set(anos.filter(anoPlausivel))).sort((a, b) => b - a);
}

export type DataFaturamento =
  | { ok: true; data: Date }
  | { ok: false; erro: string };

/**
 * Converte a data do formulário (yyyy-mm-dd) em Date, recusando o que não faz
 * sentido. Meio-dia no fuso de Brasília para a data não "andar" um dia.
 */
export function lerDataFaturamento(texto: string): DataFaturamento {
  const t = (texto ?? "").trim();
  if (!t) return { ok: false, erro: "Escolha a data do faturamento." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return { ok: false, erro: "Data em formato inválido. Use o calendário do campo." };
  }
  const data = new Date(`${t}T12:00:00-03:00`);
  if (Number.isNaN(data.getTime())) return { ok: false, erro: "Essa data não existe." };

  // O ano vem ANTES da conferência do dia, para o ano errado receber a
  // mensagem sobre o ano em vez de um genérico "confira o dia".
  const ano = Number(t.slice(0, 4));
  if (!anoPlausivel(ano)) {
    return {
      ok: false,
      erro: `Ano ${ano} não pode ser data de faturamento. Use um ano entre ${ANO_MIN} e ${anoMax()} — foi um ano errado assim que criou aquele "20" no seletor do Dashboard.`,
    };
  }

  // 31 de fevereiro não dá erro em JavaScript: vira 3 de março calado. Sem
  // esta conferência de volta, a venda ficaria gravada num dia que ninguém
  // escolheu. Compara no fuso de Brasília, que é onde o meio-dia foi fixado.
  const emBrasilia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(data);
  if (emBrasilia !== t) return { ok: false, erro: "Essa data não existe (confira o dia do mês)." };

  return { ok: true, data };
}

/** min/max para o atributo do <input type="date"> — barra antes de enviar. */
export const LIMITE_DATA_FATURAMENTO = {
  min: `${ANO_MIN}-01-01`,
  get max() { return `${anoMax()}-12-31`; },
};
