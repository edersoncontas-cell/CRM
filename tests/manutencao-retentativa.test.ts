// O calendário de retentativa da manutenção.
//
// A manutenção que falhava rodava de novo a cada tela, por horas, e esgotou
// a cota do banco: uma semana de CRM fora do ar. O que se prova aqui é que o
// intervalo CRESCE a cada falha e que nada estranho na marca destrava um loop.

import { describe, it, expect } from "vitest";
import { lerMarca, marcaDeFalha, deveRodar, esperaAposFalhas } from "@/lib/manutencao-retentativa";

const MIN = 60_000, H = 60 * MIN;

describe("ler a marca", () => {
  it("ok, vazio e lixo", () => {
    expect(lerMarca("ok")).toEqual({ estado: "ok" });
    expect(lerMarca(null)).toEqual({ estado: "nunca" });
    expect(lerMarca("")).toEqual({ estado: "nunca" });
    expect(lerMarca("qualquer coisa")).toEqual({ estado: "nunca" });
    expect(lerMarca("falhou:x:y:z")).toEqual({ estado: "nunca" });
  });

  it("a falha volta inteira, com o erro", () => {
    const m = lerMarca(marcaDeFalha(2, 1_000, "Coluna  não\n existe"));
    expect(m).toEqual({ estado: "falhou", vezes: 3, em: 1_000, erro: "Coluna não existe" });
  });

  it("o erro gravado é curto — a marca é uma linha de configuração, não um log", () => {
    const m = lerMarca(marcaDeFalha(0, 0, "x".repeat(5_000)));
    if (m.estado !== "falhou") throw new Error("devia ser falha");
    expect(m.erro.length).toBeLessThanOrEqual(300);
  });
});

describe("quando rodar", () => {
  it("em dia não roda; nunca rodou, roda", () => {
    expect(deveRodar({ estado: "ok" }, 0)).toBe(false);
    expect(deveRodar({ estado: "nunca" }, 0)).toBe(true);
  });

  // O loop de ontem, negado: falhou agora → NÃO roda na tela seguinte.
  it("acabou de falhar: a tela seguinte NÃO roda de novo", () => {
    const m = lerMarca(marcaDeFalha(0, 10_000, "erro"));
    expect(deveRodar(m, 10_001)).toBe(false);
    expect(deveRodar(m, 10_000 + 4 * MIN)).toBe(false);
    expect(deveRodar(m, 10_000 + 5 * MIN)).toBe(true);
  });

  it("o intervalo cresce: 5 min, 30 min, 2 h, depois 1 vez por dia", () => {
    expect(esperaAposFalhas(1)).toBe(5 * MIN);
    expect(esperaAposFalhas(2)).toBe(30 * MIN);
    expect(esperaAposFalhas(3)).toBe(2 * H);
    expect(esperaAposFalhas(4)).toBe(24 * H);
    expect(esperaAposFalhas(50)).toBe(24 * H);
  });

  it("depois de muitas falhas, no máximo uma tentativa por dia — e não zero", () => {
    const m = lerMarca(marcaDeFalha(9, 0, "erro"));
    expect(deveRodar(m, 23 * H)).toBe(false);
    expect(deveRodar(m, 24 * H)).toBe(true);
  });

  it("vezes=0 gravado à mão não vira intervalo negativo", () => {
    expect(esperaAposFalhas(0)).toBe(5 * MIN);
  });
});
