// APROVEITE A VIAGEM.
//
// "Vamos alterar, para ficar só os clientes da cidade, e não o filtro de 60
//  dias, e retira essa informação de nunca visita desse card"
//
// A pergunta é direta: estou indo a esta cidade, quem eu tenho aqui? Sem corte
// de tempo e sem cidade vizinha. O que ainda precisa ser garantido é que a
// lista não repita quem já está na agenda — sugestão repetida faz o vendedor
// parar de ler o quadro — e que cliente sem cidade nunca entre por engano.

import { describe, it, expect } from "vitest";
import { sugerirVisitasNaViagem, type ClienteVisitavel, type VisitaMarcada } from "@/lib/visitas-na-viagem";

const HOJE = new Date("2026-09-21T12:00:00-03:00");
const daquiA = (n: number) => new Date(HOJE.getTime() + n * 86_400_000);

const visita = (over: Partial<VisitaMarcada> = {}): VisitaMarcada => ({
  clienteId: "alvo", data: daquiA(3), cidade: "Dores do Rio Preto", ...over,
});
const cliente = (over: Partial<ClienteVisitavel> = {}): ClienteVisitavel => ({
  id: "c1", nome: "Afonsinho Pedra Menina", cidade: "Dores do Rio Preto", ...over,
});

describe("quem entra na lista", () => {
  it("todo cliente da cidade entra, sem olhar quando foi a última visita", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente()]);
    expect(r).toHaveLength(1);
    expect(r[0].clientes.map((c) => c.id)).toEqual(["c1"]);
  });

  it("cliente de outra cidade NÃO entra, nem que seja vizinha", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ id: "fora", cidade: "Guaçuí" })]);
    expect(r).toHaveLength(0);
  });

  it("cliente sem cidade cadastrada fica de fora", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ cidade: null })]);
    expect(r).toHaveLength(0);
  });

  it("o cliente da própria visita não se auto-sugere", () => {
    const r = sugerirVisitasNaViagem([visita({ clienteId: "c1" })], [cliente({ id: "c1" })]);
    expect(r).toHaveLength(0);
  });

  it("quem já tem visita marcada na janela não aparece de novo", () => {
    const r = sugerirVisitasNaViagem(
      [visita(), visita({ clienteId: "c2", data: daquiA(5) })],
      [cliente({ id: "c2" }), cliente({ id: "c3", nome: "Outro" })]
    );
    for (const s of r) expect(s.clientes.map((c) => c.id)).not.toContain("c2");
  });
});

describe("o nome da cidade é comparado sem tropeçar em acento ou caixa", () => {
  it("acento não separa o mesmo município", () => {
    const r = sugerirVisitasNaViagem([visita({ cidade: "Guaçuí" })], [cliente({ cidade: "GUACUI" })]);
    expect(r).toHaveLength(1);
  });

  it("espaço sobrando não separa", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ cidade: "  Dores do Rio Preto  " })]);
    expect(r).toHaveLength(1);
  });

  it("viagem sem cidade não sugere nada", () => {
    const r = sugerirVisitasNaViagem([visita({ cidade: "" })], [cliente()]);
    expect(r).toHaveLength(0);
  });
});

describe("a lista", () => {
  it("vem em ordem alfabética, que é como se procura nome", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [
        cliente({ id: "c3", nome: "Edson Dores Do Rio Preto E145" }),
        cliente({ id: "c1", nome: "Afonsinho Pedra Menina" }),
        cliente({ id: "c2", nome: "Davi E145 Dores Do Rio Preto" }),
      ]
    );
    expect(r[0].clientes.map((c) => c.nome)).toEqual([
      "Afonsinho Pedra Menina",
      "Davi E145 Dores Do Rio Preto",
      "Edson Dores Do Rio Preto E145",
    ]);
  });

  it("tem teto alto: uma cidade com 20 clientes mostra os 20", () => {
    const muitos = Array.from({ length: 20 }, (_, i) =>
      cliente({ id: `c${i}`, nome: `Cliente ${String(i).padStart(2, "0")}` })
    );
    const r = sugerirVisitasNaViagem([visita()], muitos);
    expect(r[0].clientes).toHaveLength(20);
  });

  it("mas não vira parede de nome sem fim", () => {
    const muitos = Array.from({ length: 200 }, (_, i) => cliente({ id: `c${i}`, nome: `Cliente ${i}` }));
    const r = sugerirVisitasNaViagem([visita()], muitos);
    expect(r[0].clientes.length).toBeLessThanOrEqual(30);
  });
});

describe("duas visitas no mesmo dia", () => {
  it("na mesma cidade viram uma lista só", () => {
    const r = sugerirVisitasNaViagem(
      [visita({ clienteId: "a" }), visita({ clienteId: "b" })],
      [cliente()]
    );
    expect(r).toHaveLength(1);
  });

  it("em cidades diferentes continuam sendo duas viagens", () => {
    const r = sugerirVisitasNaViagem(
      [visita({ clienteId: "a" }), visita({ clienteId: "b", cidade: "Guaçuí" })],
      [cliente(), cliente({ id: "c2", cidade: "Guaçuí", nome: "Outro" })]
    );
    expect(r).toHaveLength(2);
  });

  it("as viagens saem na ordem do calendário", () => {
    const r = sugerirVisitasNaViagem(
      [
        visita({ clienteId: "b", cidade: "Guaçuí", data: daquiA(9) }),
        visita({ clienteId: "a", data: daquiA(2) }),
      ],
      [cliente(), cliente({ id: "c2", cidade: "Guaçuí", nome: "Outro" })]
    );
    expect(r.map((s) => s.cidade)).toEqual(["Dores do Rio Preto", "Guaçuí"]);
  });
});
