import { describe, expect, it } from "vitest";
import { lerTabelaCCCV } from "@/lib/cafe-parsers";

const TEXTO = `Cotação do café referente ao mês de Setembro de 2026
 Arábica
 Conilon
 Dia
 Bebida "dura", bica corrida
 Bebida "rio", bica corrida
 Bica corrida, tipo 7/8, com até 13% de umidade
 1
 1.603,00
 1.263,00
 963,00
 2
 1.567,00
 1.243,00
 945,00
 5
 -
 -
 -
 14
 1.513,00
 1.210,00
 948,00
 15
 -
 -
 -
 Média Mensal
 1.527,88
 1.225,38
 939,63`;

describe("CCCV", () => {
  it("pega a última linha cotada do mês (dia, dura, rio, conilon)", () => {
    const r = lerTabelaCCCV(TEXTO);
    expect(r).toEqual({ conilon: 948, arabica: 1210, dataReferencia: "14/09/2026", fonte: "CCCV (Vitória)", praca: "Vitória - ES" });
  });
  it("devolve null sem tabela", () => {
    expect(lerTabelaCCCV("nada aqui")).toBeNull();
  });
});
