// "eu coloquei o percentual da entrada e o sistema não atualizou"
//
// O vendedor escreveu "Entrada 10%" na caixa de contexto. A nota foi guardada
// — apareceu certinha em "Já contei ao Orientador" — e o card Negociação
// continuou dizendo "entrada ainda não definida". Causa: quem transforma nota
// em ficha era só a análise do Orientador, e naquele dia a cota diária de IA
// tinha acabado. Do ponto de vista de quem usa, o sistema engoliu o que foi
// digitado.
//
// "Entrada 10%" não precisa de IA. Aqui está a leitura por regra, que roda na
// hora, de graça, e não falha por cota.
//
// O outro lado do risco importa tanto quanto: isto ESCREVE na ficha de uma
// negociação de verdade. Um palpite errado estraga dado real. Por isso metade
// destes testes é sobre o que NÃO pode ser lido.

import { describe, it, expect } from "vitest";
import {
  lerFatosDaNota, temAlgumFato, entradaPercentualDaNota, entradaValorDaNota,
  valorDaNota, modeloDaNota, marcaDaNota, pagamentoDaNota, visitaRealizadaNaNota,
} from "@/lib/nota-fatos";

describe("entrada em percentual — o caso reportado", () => {
  it('"Entrada 10%" é lido na hora', () => {
    expect(entradaPercentualDaNota("Entrada 10%")).toBe(10);
  });

  it("nas formas que o vendedor escreve", () => {
    expect(entradaPercentualDaNota("entrada de 30%")).toBe(30);
    expect(entradaPercentualDaNota("entrada de 30 %")).toBe(30);
    expect(entradaPercentualDaNota("vai dar 25% de entrada")).toBe(25);
    expect(entradaPercentualDaNota("ENTRADA 15%")).toBe(15);
    expect(entradaPercentualDaNota("entrada 12,5%")).toBe(12.5);
  });

  it("percentual que não é de entrada não entra", () => {
    expect(entradaPercentualDaNota("juros de 1,2% ao mês")).toBe(null);
    expect(entradaPercentualDaNota("desconto de 5%")).toBe(null);
    expect(entradaPercentualDaNota("10%")).toBe(null); // sem dizer de quê
  });
});

describe("entrada em reais", () => {
  it("lê o valor quando é dinheiro", () => {
    expect(entradaValorDaNota("entrada de 180 mil")).toBe(180000);
    expect(entradaValorDaNota("entrada R$ 180.000")).toBe(180000);
    expect(entradaValorDaNota("sinal de 200 mil")).toBe(200000);
  });

  it('"entrada 10%" NÃO vira entrada em reais', () => {
    expect(entradaValorDaNota("entrada 10%")).toBe(null);
  });

  it("os dois juntos são lidos cada um no seu campo", () => {
    const f = lerFatosDaNota("entrada de 30%, que dá uns 180 mil");
    expect(f.entradaPercentual).toBe(30);
  });
});

describe("valor da máquina", () => {
  it("exige palavra de fechamento por perto", () => {
    expect(valorDaNota("fechamos o valor em 610 mil")).toBe(610000);
    expect(valorDaNota("valor negociado R$ 610.000")).toBe(610000);
    expect(valorDaNota("ficou em 480 mil")).toBe(480000);
  });

  it("número solto não vira preço de máquina", () => {
    expect(valorDaNota("a máquina tem 900 horas")).toBe(null);
    expect(valorDaNota("610 mil")).toBe(null);
  });

  it("o valor da ENTRADA não é confundido com o da máquina", () => {
    expect(valorDaNota("entrada de 180 mil")).toBe(null);
  });
});

describe("modelo e marca", () => {
  it("código de modelo é reconhecido", () => {
    expect(modeloDaNota("quer a B110")).toBe("B110");
    expect(modeloDaNota("fechou na E145C")).toBe("E145C");
    expect(modeloDaNota("é a D150 mesmo")).toBe("D150");
  });

  it("número que não é modelo não passa", () => {
    expect(modeloDaNota("em 48 parcelas")).toBe(null);
    expect(modeloDaNota("ano 2024")).toBe(null);
    expect(modeloDaNota("entrada 10%")).toBe(null);
    expect(modeloDaNota("quer uma retroescavadeira")).toBe(null); // categoria, não modelo
  });

  it("as duas marcas da casa", () => {
    expect(marcaDaNota("é uma New Holland")).toBe("New Holland");
    expect(marcaDaNota("vai ser dynapac")).toBe("Dynapac");
    expect(marcaDaNota("o cara tem uma Caterpillar")).toBe(null);
  });
});

describe("forma de pagamento", () => {
  it("as pistas viram o código certo", () => {
    expect(pagamentoDaNota("vai ser financiado pelo banco dele")).toBe("financiamento");
    expect(pagamentoDaNota("via Finame")).toBe("financiamento");
    expect(pagamentoDaNota("paga à vista")).toBe("avista");
    expect(pagamentoDaNota("quer consórcio")).toBe("consorcio");
    expect(pagamentoDaNota("parcelado pela casa")).toBe("crd_pme");
  });

  it("texto sem pista não inventa forma de pagamento", () => {
    expect(pagamentoDaNota("ele vai ver com o sócio")).toBe(null);
  });
});

describe("visita já realizada", () => {
  it("o passado marca", () => {
    expect(visitaRealizadaNaNota("já visitei o cliente")).toBe(true);
    expect(visitaRealizadaNaNota("fiz a visita ontem")).toBe(true);
    expect(visitaRealizadaNaNota("estive na obra semana passada")).toBe(true);
  });

  it("o FUTURO não marca — este é o erro que estragaria o roteiro", () => {
    expect(visitaRealizadaNaNota("vou visitar amanhã")).toBe(null);
    expect(visitaRealizadaNaNota("preciso marcar visita")).toBe(null);
    expect(visitaRealizadaNaNota("visita agendada para quinta")).toBe(null);
  });
});

describe("a nota inteira", () => {
  it("o caso real, com tudo junto", () => {
    const f = lerFatosDaNota("já tem proposta, vai ser via finame, fechamos o valor em 610 mil na E145C New Holland, entrada de 30%");
    expect(f.maquinaModelo).toBe("E145C");
    expect(f.marca).toBe("New Holland");
    expect(f.valor).toBe(610000);
    expect(f.condicaoPagamento).toBe("financiamento");
    expect(f.entradaPercentual).toBe(30);
  });

  it("a nota curta do print", () => {
    const f = lerFatosDaNota("Entrada 10%");
    expect(f.entradaPercentual).toBe(10);
    expect(temAlgumFato(f)).toBe(true);
    // e nada mais é inventado a partir dela
    expect(f.valor).toBe(null);
    expect(f.maquinaModelo).toBe(null);
    expect(f.condicaoPagamento).toBe(null);
  });

  it("nota sem nenhum dado não gera escrita no banco", () => {
    const f = lerFatosDaNota("liguei e ele não atendeu, tento de novo amanhã");
    expect(temAlgumFato(f)).toBe(false);
  });

  it("nota vazia não quebra", () => {
    expect(temAlgumFato(lerFatosDaNota(""))).toBe(false);
    expect(temAlgumFato(lerFatosDaNota("   "))).toBe(false);
  });
});
