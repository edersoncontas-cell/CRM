// APROVEITE A VIAGEM.
//
// "clientes com mais de 60 dias sem visita, o sistema fará uma sugestão de
//  visita de clientes desta cidade ou próximas"
//
// O risco aqui é GASTAR A VIAGEM DO VENDEDOR. Sugestão errada não é só ruído:
// ele pega a estrada por causa dela. Por isso cliente sem cidade no mapa fica
// de fora em vez de entrar com distância chutada, e quem já está agendado nunca
// é sugerido de novo.

import { describe, it, expect } from "vitest";
import {
  sugerirVisitasNaViagem, rotuloSemVisita, rotuloDistancia,
  DIAS_SEM_VISITA_PADRAO, type ClienteVisitavel, type VisitaMarcada,
} from "@/lib/visitas-na-viagem";

const AGORA = new Date("2026-09-21T12:00:00-03:00");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);
const daquiA = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

// Cachoeiro e Alegre ficam a ~40 km; Vitória fica a ~130 km de Cachoeiro.
const CACHOEIRO = { lat: -20.848, lng: -41.113 };
const ALEGRE = { lat: -20.764, lng: -41.532 };
const VITORIA = { lat: -20.315, lng: -40.313 };

const visita = (over: Partial<VisitaMarcada> = {}): VisitaMarcada => ({
  clienteId: "alvo", data: daquiA(2), cidade: "Cachoeiro de Itapemirim", ponto: CACHOEIRO, ...over,
});
const cliente = (over: Partial<ClienteVisitavel> = {}): ClienteVisitavel => ({
  id: "c1", nome: "Terraplanagem Um", cidade: "Cachoeiro de Itapemirim",
  ponto: CACHOEIRO, ultimaVisita: diasAtras(90), ...over,
});

describe("quem entra na sugestão", () => {
  it("cliente da mesma cidade, esquecido há mais de 60 dias, entra", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente()], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].clientes.map((c) => c.id)).toEqual(["c1"]);
    expect(r[0].clientes[0].km).toBe(0);
  });

  it("visitado há pouco NÃO entra", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ ultimaVisita: diasAtras(10) })], AGORA);
    expect(r).toHaveLength(0);
  });

  it("59 dias não entra, 60 entra — o corte é onde ele pediu", () => {
    const a = sugerirVisitasNaViagem([visita()], [cliente({ ultimaVisita: diasAtras(59) })], AGORA);
    const b = sugerirVisitasNaViagem([visita()], [cliente({ ultimaVisita: diasAtras(60) })], AGORA);
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
    expect(DIAS_SEM_VISITA_PADRAO).toBe(60);
  });

  it("quem nunca foi visitado entra", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ ultimaVisita: null })], AGORA);
    expect(r[0].clientes[0].diasSemVisita).toBeNull();
  });

  it("quem já tem visita marcada na viagem NÃO é sugerido de novo", () => {
    const r = sugerirVisitasNaViagem([visita({ clienteId: "c1" })], [cliente({ id: "c1" })], AGORA);
    expect(r).toHaveLength(0);
  });

  it("cliente sem cidade no mapa fica de fora — melhor uma sugestão a menos que uma errada", () => {
    const r = sugerirVisitasNaViagem([visita()], [cliente({ ponto: null })], AGORA);
    expect(r).toHaveLength(0);
  });

  it("viagem sem cidade no mapa não sugere nada — não há de onde medir", () => {
    const r = sugerirVisitasNaViagem([visita({ ponto: null })], [cliente()], AGORA);
    expect(r).toHaveLength(0);
  });
});

describe("cidade próxima, mas não o estado inteiro", () => {
  it("cidade vizinha entra; cidade longe fica fora", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [
        cliente({ id: "perto", cidade: "Alegre", ponto: ALEGRE }),
        cliente({ id: "longe", cidade: "Vitória", ponto: VITORIA }),
      ],
      AGORA,
      { raioKm: 50 }
    );
    expect(r[0].clientes.map((c) => c.id)).toEqual(["perto"]);
  });

  it("o raio é configurável, e com raio curto só sobra a própria cidade", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [cliente({ id: "mesma" }), cliente({ id: "vizinha", cidade: "Alegre", ponto: ALEGRE })],
      AGORA,
      { raioKm: 5 }
    );
    expect(r[0].clientes.map((c) => c.id)).toEqual(["mesma"]);
  });
});

describe("a ordem da lista", () => {
  it("mesma cidade antes de cidade vizinha", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [cliente({ id: "vizinha", cidade: "Alegre", ponto: ALEGRE }), cliente({ id: "mesma" })],
      AGORA,
      { raioKm: 50 }
    );
    expect(r[0].clientes.map((c) => c.id)).toEqual(["mesma", "vizinha"]);
  });

  it("empatada a distância, quem nunca foi visitado vem antes do esquecido há 300 dias", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [cliente({ id: "velho", ultimaVisita: diasAtras(300) }), cliente({ id: "nunca", ultimaVisita: null })],
      AGORA
    );
    expect(r[0].clientes.map((c) => c.id)).toEqual(["nunca", "velho"]);
  });

  it("entre dois visitados, o mais esquecido vem primeiro", () => {
    const r = sugerirVisitasNaViagem(
      [visita()],
      [cliente({ id: "recente", ultimaVisita: diasAtras(70) }), cliente({ id: "antigo", ultimaVisita: diasAtras(300) })],
      AGORA
    );
    expect(r[0].clientes.map((c) => c.id)).toEqual(["antigo", "recente"]);
  });

  it("a lista tem teto, para o quadro não virar parede de nome", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => cliente({ id: `c${i}`, nome: `Cliente ${i}` }));
    const r = sugerirVisitasNaViagem([visita()], muitos, AGORA, { porViagem: 5 });
    expect(r[0].clientes).toHaveLength(5);
  });
});

describe("duas visitas na mesma cidade no mesmo dia", () => {
  it("sugerem uma lista só, não duas iguais", () => {
    const r = sugerirVisitasNaViagem(
      [visita({ clienteId: "a" }), visita({ clienteId: "b" })],
      [cliente()],
      AGORA
    );
    expect(r).toHaveLength(1);
  });

  it("cidades diferentes no mesmo dia continuam sendo duas viagens", () => {
    const r = sugerirVisitasNaViagem(
      [visita({ clienteId: "a" }), visita({ clienteId: "b", cidade: "Alegre", ponto: ALEGRE })],
      [cliente(), cliente({ id: "c2", cidade: "Alegre", ponto: ALEGRE })],
      AGORA,
      { raioKm: 5 }
    );
    expect(r).toHaveLength(2);
  });
});

describe("como o vendedor lê", () => {
  it("dias sem visita", () => {
    expect(rotuloSemVisita(74)).toBe("há 74 dias");
    expect(rotuloSemVisita(null)).toBe("nunca visitado");
  });

  it("distância", () => {
    expect(rotuloDistancia(0)).toBe("na cidade");
    expect(rotuloDistancia(12)).toBe("a 12 km");
  });
});
