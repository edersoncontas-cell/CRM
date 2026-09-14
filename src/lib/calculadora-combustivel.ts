// Calculadora de economia de combustível: New Holland × concorrente.
//
// Regra combinada com o Edy:
//   diferença de consumo (L/h) = concorrente − New Holland
//   economia/mês  = diferença × preço do diesel × horas trabalhadas no mês
//   economia/ano  = economia/mês × 12
//   no horizonte  = economia/ano × anos que o cliente fica com a máquina
//   resultado     = economia no horizonte − (preço New Holland − preço concorrente)

export type MaquinaCombustivel = { nome: string; valor: number; consumoLh: number };

export type CalcCombustivel = {
  horasMes: number;
  dieselLitro: number;
  horizonteAnos: number;
  concorrente: MaquinaCombustivel;
  newHolland: MaquinaCombustivel;
};

export const calcCombustivelPadrao = (): CalcCombustivel => ({
  horasMes: 150,
  dieselLitro: 6,
  horizonteAnos: 5,
  concorrente: { nome: "", valor: 0, consumoLh: 12 },
  newHolland: { nome: "", valor: 0, consumoLh: 10 },
});

export function calcularCombustivel(c: CalcCombustivel) {
  const difLh = c.concorrente.consumoLh - c.newHolland.consumoLh;
  const litrosMes = difLh * c.horasMes;
  const mes = litrosMes * c.dieselLitro;
  const ano = mes * 12;
  const horizonte = ano * c.horizonteAnos;
  const diferencaPreco = c.newHolland.valor - c.concorrente.valor;
  const liquido = horizonte - diferencaPreco;
  const paybackMeses = diferencaPreco > 0 && mes > 0 ? Math.ceil(diferencaPreco / mes) : 0;
  return { difLh, litrosMes, mes, ano, horizonte, diferencaPreco, liquido, paybackMeses };
}
