// Motivação do dia — o que conta como "repetido".
//
// O vendedor relatou em 24/09/2026: "a mesma mensagem várias vezes em dias
// diferentes". A conferência antiga olhava só a citação e por igualdade exata;
// a IA devolvia a mesma citação com outras palavras e ela passava. Estes
// testes usam os casos de verdade, inclusive o do print dele.

import { describe, it, expect } from "vitest";
import {
  TEMAS_DO_DIA, temaDoDia, parecidas, aberturaDoTexto, lerHistorico,
  motivoDeRecusa, registroDe, escolherDaReserva, type Registro, type Candidata,
} from "@/lib/frase-dia-regra";

const PRINT: Candidata = {
  texto: "Cada visita ao canteiro é uma oportunidade de mostrar o valor da sua solução; seja preciso e escute o cliente.",
  frase: "A excelência não é um ato, é um hábito constante.",
  autor: "Aristóteles",
};

describe("tema do dia", () => {
  it("mesmo dia, mesmo tema — o Dashboard não muda de assunto ao recarregar", () => {
    expect(temaDoDia("2026-09-24")).toBe(temaDoDia("2026-09-24"));
  });

  it("dias seguidos nunca repetem o tema, nem na virada do ano", () => {
    const dias = ["2026-09-23", "2026-09-24", "2026-09-25", "2026-12-31", "2027-01-01"];
    for (let i = 1; i < dias.length; i++) expect(temaDoDia(dias[i])).not.toBe(temaDoDia(dias[i - 1]));
  });

  it("um mês inteiro passa sem repetir tema", () => {
    const setembro = Array.from({ length: 30 }, (_, i) => temaDoDia(`2026-09-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(setembro).size).toBe(30);
    expect(TEMAS_DO_DIA.length).toBeGreaterThanOrEqual(31);
  });
});

describe("parecença de citações", () => {
  it("o caso do print: a mesma citação com outras palavras É repetida", () => {
    expect(parecidas(PRINT.frase, "A excelência não é um ato, é um hábito")).toBe(true);
    expect(parecidas(PRINT.frase, "Somos o que repetidamente fazemos. A excelência, portanto, não é um ato, mas um hábito.")).toBe(true);
  });

  it("aspas, acento e pontuação diferentes não enganam", () => {
    expect(parecidas("“O sucesso é a soma de pequenos esforços.”", "o sucesso e a soma de pequenos esforcos")).toBe(true);
  });

  it("citações diferentes continuam diferentes — nada de recusar tudo", () => {
    expect(parecidas("A persistência é o caminho do êxito.", "O segredo de ir em frente é começar.")).toBe(false);
    expect(parecidas("Conhecimento é poder.", "A melhor propaganda é um cliente satisfeito.")).toBe(false);
    // uma palavra em comum só não basta
    expect(parecidas("O cliente satisfeito volta.", "Cuide do cliente e ele cuidará de você.")).toBe(false);
  });
});

describe("abertura do texto", () => {
  it("o 'Cada visita…' que se repetia vira a mesma abertura", () => {
    expect(aberturaDoTexto(PRINT.texto)).toBe(aberturaDoTexto("Cada visita que você faz hoje é uma semente."));
  });
  it("aberturas diferentes são diferentes", () => {
    expect(aberturaDoTexto("Proposta clara fecha negócio.")).not.toBe(aberturaDoTexto(PRINT.texto));
  });
});

describe("histórico", () => {
  it("lê o formato antigo (só a citação) e o novo, e ignora lixo", () => {
    const h = lerHistorico(["Frase antiga", { d: "2026-09-23", f: "Frase nova", a: "Autor", t: "cada visita" }, 42, null, { x: 1 }, ""]);
    expect(h).toEqual([{ f: "Frase antiga" }, { d: "2026-09-23", f: "Frase nova", a: "Autor", t: "cada visita" }]);
  });
  it("nada que não seja lista vira histórico vazio, sem quebrar o Dashboard", () => {
    expect(lerHistorico("oi")).toEqual([]);
    expect(lerHistorico(undefined)).toEqual([]);
  });
});

describe("recusa", () => {
  const ontem: Registro[] = [registroDe(PRINT, "2026-09-23")];

  it("a mensagem do print, de novo no dia seguinte, é recusada", () => {
    expect(motivoDeRecusa(PRINT, ontem)).toMatch(/citação/);
  });

  it("mesma citação reescrita pela IA também é recusada", () => {
    expect(motivoDeRecusa({ ...PRINT, frase: "A excelência não é um ato, mas um hábito." }, ontem)).toMatch(/citação/);
  });

  it("citação nova mas o mesmo 'Cada visita…' no começo: recusada", () => {
    const c = { texto: "Cada visita conta muito para o seu mês.", frase: "O segredo de ir em frente é começar.", autor: "Mark Twain" };
    expect(motivoDeRecusa(c, ontem)).toMatch(/começa igual/);
  });

  it("autor repetido dentro de 21 dias: recusado; 'Sabedoria de vendas' pode repetir", () => {
    const c = { texto: "Proposta clara fecha negócio.", frase: "Quem pensa pouco erra muito.", autor: "Aristóteles" };
    expect(motivoDeRecusa(c, ontem)).toMatch(/autor/);
    expect(motivoDeRecusa({ ...c, autor: "Sabedoria de vendas" }, [...ontem, { f: "x", a: "Sabedoria de vendas" }])).toBeNull();
  });

  it("autor usado há mais de 21 dias pode voltar", () => {
    const antigo: Registro[] = [{ f: "Outra coisa", a: "Aristóteles" }, ...Array.from({ length: 21 }, (_, i) => ({ f: `frase ${i} diferente`, a: `Autor ${i}` }))];
    const c = { texto: "Proposta clara fecha negócio.", frase: "Quem pensa pouco erra muito.", autor: "Aristóteles" };
    expect(motivoDeRecusa(c, antigo)).toBeNull();
  });

  it("tudo novo: aceita", () => {
    const c = { texto: "Proposta clara fecha negócio.", frase: "O segredo de ir em frente é começar.", autor: "Mark Twain" };
    expect(motivoDeRecusa(c, ontem)).toBeNull();
  });
});

describe("reserva", () => {
  const RESERVA: Candidata[] = [
    { texto: "Cada visita é uma semente.", frase: "O sucesso é a soma de pequenos esforços.", autor: "Robert Collier" },
    { texto: "O cliente compra certeza.", frase: "As pessoas compram o porquê.", autor: "Simon Sinek" },
    { texto: "Um não é informação.", frase: "Cada não me aproxima do sim.", autor: "Mentalidade de campeão" },
  ];

  it("pula a que já foi usada e pega a próxima boa", () => {
    const h: Registro[] = [registroDe(RESERVA[0], "2026-09-23")];
    expect(escolherDaReserva(RESERVA, h)).toBe(RESERVA[1]);
  });

  it("todas usadas: devolve a usada há mais tempo, nunca a de ontem", () => {
    const h: Registro[] = [registroDe(RESERVA[1], "2026-09-21"), registroDe(RESERVA[2], "2026-09-22"), registroDe(RESERVA[0], "2026-09-23")];
    expect(escolherDaReserva(RESERVA, h)).toBe(RESERVA[1]);
  });
});
